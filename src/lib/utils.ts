import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';
import { AxiosResponse } from 'axios';
import { getConfig, SapConfig } from '../index'; // getConfig needs to be exported from index.ts

export { McpError, ErrorCode, AxiosResponse };

export function return_response(response: AxiosResponse) {
    return {
        isError: false,
        content: [{
            type: 'text',
            text: response.data
        }]
    };
}
export function return_error(error: any) {
    return {
        isError: true,
        content: [{
            type: 'text',
            text: `Error: ${error instanceof AxiosError ? String(error.response?.data)
                : error instanceof Error ? error.message
                    : String(error)}`
        }]
    };
}

let axiosInstance: AxiosInstance | null = null;
export function createAxiosInstance() {
    if (!axiosInstance) {
        axiosInstance = axios.create({
            httpsAgent: new Agent({
                rejectUnauthorized: false // Allow self-signed certificates
            })
        });
    }
    return axiosInstance;
}

// Cleanup function for tests
export function cleanup() {
    if (axiosInstance) {
        // Clear any interceptors
        const reqInterceptor = axiosInstance.interceptors.request.use((config) => config);
        const resInterceptor = axiosInstance.interceptors.response.use((response) => response);
        axiosInstance.interceptors.request.eject(reqInterceptor);
        axiosInstance.interceptors.response.eject(resInterceptor);
    }
    axiosInstance = null;
    config = undefined;
    csrfToken = null;
    cookies = null;
    sapContextId = null;
}

let config: SapConfig | undefined;
let csrfToken: string | null = null;
let cookies: string | null = null; // Variable to store cookies
// In a load-balanced SAP system, a stateful session (created by LockObject) lives on
// one specific application server instance. SAP returns a "sap-contextid" response
// header to pin subsequent requests to that same instance; without echoing it back,
// the next stateful call (e.g. SaveObjectSource) can be routed to a different
// instance that has never heard of the session, failing with "Session not found"
// even immediately after a successful lock.
let sapContextId: string | null = null;

// Set SAP_ADT_DEBUG=1 to log stateful-session diagnostics (method/url/status plus a
// short fingerprint of the cookie/sap-contextid/csrf-token involved) to stderr. This
// never touches stdout, which is reserved for the MCP JSON-RPC stream. Values are
// fingerprinted (short prefix/suffix only), never printed in full, since they are
// live session credentials.
const DEBUG_ENABLED = process.env.SAP_ADT_DEBUG === '1' || process.env.SAP_ADT_DEBUG === 'true';

function fingerprint(value: string | null | undefined): string {
    if (!value) {
        return '(none)';
    }
    return value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-6)} (len ${value.length})` : value;
}

function debugLog(label: string, details: Record<string, unknown>) {
    if (!DEBUG_ENABLED) {
        return;
    }
    console.error(`[mcp-abap-adt][SAP_ADT_DEBUG] ${label}`, details);
}

export async function getBaseUrl() {
    if (!config) {
        config = getConfig();
    }
    const { url } = config;
    try {
        const urlObj = new URL(url);
        const baseUrl = Buffer.from(`${urlObj.origin}`);
        return baseUrl;
    } catch (error) {
        const errorMessage = `Invalid URL in configuration: ${error instanceof Error ? error.message : error}`;
        throw new Error(errorMessage);
    }
}

export async function getAuthHeaders() {
    if (!config) {
        config = getConfig();
    }
    const { username, password, client } = config;
    const auth = Buffer.from(`${username}:${password}`).toString('base64'); // Create Basic Auth string
    return {
        'Authorization': `Basic ${auth}`, // Basic Authentication header
        'X-SAP-Client': client            // SAP client header
    };
}

async function fetchCsrfToken(url: string, stateful: boolean = false): Promise<string> {
    if (!config) {
        config = getConfig();
    }
    try {
        const response = await createAxiosInstance()({
            method: 'GET',
            url,
            // sap-client must be a query parameter; ICF ignores the X-SAP-Client header,
            // so without it the session would be opened in the system default client
            params: { 'sap-client': config.client },
            headers: {
                ...(await getAuthHeaders()),
                'x-csrf-token': 'fetch',
                // When this handshake is for a stateful call (e.g. the first LockObject
                // of a process), declare it stateful too, so SAP pins the session/
                // context id starting here instead of opening a throwaway stateless
                // session that gets replaced a moment later by the real request.
                ...(stateful ? { 'X-sap-adt-sessiontype': 'stateful' } : {})
            }
        });

        const token = response.headers['x-csrf-token'];
        if (!token) {
            throw new Error('No CSRF token in response headers');
        }

        // Extract and store cookies (and, for stateful handshakes, the sap-contextid pin)
        if (response.headers['set-cookie']) {
            cookies = response.headers['set-cookie'].join('; ');
        }
        if (stateful && response.headers['sap-contextid']) {
            sapContextId = response.headers['sap-contextid'];
        }
        debugLog('csrf-fetch', {
            url,
            stateful,
            receivedSetCookie: fingerprint(response.headers['set-cookie']?.join('; ')),
            receivedContextId: fingerprint(response.headers['sap-contextid'])
        });

        return token;
    } catch (error) {
        // Even if the request fails, try to get token from error response
        if (error instanceof AxiosError && error.response?.headers['x-csrf-token']) {
            const token = error.response.headers['x-csrf-token'];
            if (token) {
                 // Extract and store cookies from the error response as well
                if (error.response.headers['set-cookie']) {
                    cookies = error.response.headers['set-cookie'].join('; ');
                }
                if (stateful && error.response.headers['sap-contextid']) {
                    sapContextId = error.response.headers['sap-contextid'];
                }
                return token;
            }
        }
        // If we couldn't get token from error response either, throw the original error
        throw new Error(`Failed to fetch CSRF token: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function makeAdtRequest(url: string, method: string, timeout: number, data?: any, params?: any, headers?: any) {
    if (!config) {
        config = getConfig();
    }

    // Only requests that are part of a stateful edit session (Lock/Save/Check/
    // Activate/Unlock) should carry/update the sap-contextid pin and trigger a
    // stateful CSRF handshake. Attaching it to unrelated stateless calls (e.g.
    // GetProgram) would be meaningless and, on the update side, an interleaved
    // stateless call getting its own context id must not overwrite the one the
    // open edit session depends on.
    const isStatefulRequest = (headers || {})['X-sap-adt-sessiontype'] === 'stateful';

    // For POST/PUT requests, ensure we have a CSRF token
    if ((method === 'POST' || method === 'PUT') && !csrfToken) {
        try {
            csrfToken = await fetchCsrfToken(url, isStatefulRequest);
        } catch (error) {
            throw new Error('CSRF token is required for POST/PUT requests but could not be fetched');
        }
    }

    const requestHeaders = {
        ...(await getAuthHeaders()),
        ...(headers || {})
    };

    // Add CSRF token for POST/PUT requests
    if ((method === 'POST' || method === 'PUT') && csrfToken) {
        requestHeaders['x-csrf-token'] = csrfToken;
    }

    // Add cookies if available
    if (cookies) {
        requestHeaders['Cookie'] = cookies;
    }

    if (isStatefulRequest && sapContextId) {
        requestHeaders['sap-contextid'] = sapContextId;
    }

    const requestConfig: any = {
        method,
        url,
        headers: requestHeaders,
        timeout,
        // sap-client must be a query parameter on every request; ICF ignores the
        // X-SAP-Client header and would otherwise log on to the system default client
        params: { 'sap-client': config.client, ...(params || {}) }
    };

    // Include data in the request configuration if provided
    if (data) {
        requestConfig.data = data;
    }

    if (isStatefulRequest) {
        debugLog('request', {
            method,
            url,
            sentCookie: fingerprint(cookies),
            sentContextId: fingerprint(sapContextId),
            sentCsrfToken: fingerprint(csrfToken)
        });
    }

    try {
        const response = await createAxiosInstance()(requestConfig);
        // SAP may rotate/assign the stateful session cookie and sap-contextid on any
        // response in the stateful chain (most notably the first one, LockObject);
        // keep both up to date so later calls in the same edit session land on the
        // same backend instance instead of being treated as a different editor.
        if (isStatefulRequest) {
            const newCookies = response.headers['set-cookie'] ? response.headers['set-cookie'].join('; ') : null;
            const newContextId = response.headers['sap-contextid'] ?? null;
            debugLog('response', {
                method,
                url,
                status: response.status,
                receivedSetCookie: fingerprint(newCookies),
                receivedContextId: fingerprint(newContextId)
            });
            if (newCookies) {
                cookies = newCookies;
            }
            if (newContextId) {
                sapContextId = newContextId;
            }
        }
        return response;
    } catch (error) {
        if (isStatefulRequest && error instanceof AxiosError) {
            debugLog('error-response', {
                method,
                url,
                status: error.response?.status,
                data: typeof error.response?.data === 'string' ? error.response.data.slice(0, 500) : error.response?.data,
                receivedSetCookie: fingerprint(error.response?.headers['set-cookie']?.join('; ')),
                receivedContextId: fingerprint(error.response?.headers['sap-contextid'])
            });
        }
        // If we get a 403 with "CSRF token validation failed", try to fetch a new token and retry
        if (error instanceof AxiosError && error.response?.status === 403 &&
            error.response.data?.includes('CSRF')) {
            csrfToken = await fetchCsrfToken(url);
            requestConfig.headers['x-csrf-token'] = csrfToken;
            return await createAxiosInstance()(requestConfig);
        }
        throw error;
    }
}
