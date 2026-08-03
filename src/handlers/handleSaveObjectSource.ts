import { McpError, ErrorCode, makeAdtRequest, return_error, return_response } from '../lib/utils';
import { getObjectUri } from '../lib/objectTypes';

/**
 * Writes new source code to an already-locked ABAP object.
 * Requires a lock_handle obtained from LockObject; does not activate the object.
 */
export async function handleSaveObjectSource(args: any) {
    try {
        if (!args?.lock_handle) {
            throw new McpError(ErrorCode.InvalidParams, 'lock_handle is required');
        }
        if (typeof args?.source_code !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'source_code is required');
        }

        const { uri } = await getObjectUri(args);
        const sourceUrl = `${uri}/source/main`;

        const params: Record<string, any> = { lockHandle: args.lock_handle };
        if (args.transport_request) {
            params.corrNr = args.transport_request;
        }

        const response = await makeAdtRequest(
            sourceUrl,
            'PUT',
            30000,
            args.source_code,
            params,
            {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-sap-adt-sessiontype': 'stateful'
            }
        );

        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
