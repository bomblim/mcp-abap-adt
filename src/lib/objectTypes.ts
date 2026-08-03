import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getBaseUrl } from './utils';

// ABAP object types supported by the write-capable tools (Lock/Unlock/Activate/SaveObjectSource).
// Paths mirror the ones already used by the corresponding Get* handlers.
export const OBJECT_TYPES = [
    'program',
    'class',
    'interface',
    'include',
    'function_group',
    'function_module',
    'structure',
    'table',
    'cds_view',
    'behavior_definition',
    'service_definition',
] as const;

export type ObjectType = typeof OBJECT_TYPES[number];

export interface ResolvedObject {
    /** Absolute URL of the object (no /source/main suffix), e.g. https://host:port/sap/bc/adt/programs/programs/ZFOO */
    uri: string;
    /** Path of the object relative to the host, used e.g. as adtcore:uri in activation requests. */
    path: string;
    /** The primary object name (as passed in object_name). */
    name: string;
}

/**
 * Resolves the ADT object URI for a given object_type/object_name (and, for function
 * modules, function_group) pair. Used by the Lock/Unlock/Activate/SaveObjectSource tools.
 */
export async function getObjectUri(args: any): Promise<ResolvedObject> {
    const objectType = args?.object_type as ObjectType;
    if (!objectType || !(OBJECT_TYPES as readonly string[]).includes(objectType)) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `object_type is required and must be one of: ${OBJECT_TYPES.join(', ')}`
        );
    }
    if (!args?.object_name) {
        throw new McpError(ErrorCode.InvalidParams, 'object_name is required');
    }

    const baseUrl = String(await getBaseUrl());
    const name = String(args.object_name);
    const encodedName = encodeURIComponent(name);

    let path: string;
    switch (objectType) {
        case 'program':
            path = `/sap/bc/adt/programs/programs/${encodedName}`;
            break;
        case 'class':
            path = `/sap/bc/adt/oo/classes/${encodedName}`;
            break;
        case 'interface':
            path = `/sap/bc/adt/oo/interfaces/${encodedName}`;
            break;
        case 'include':
            path = `/sap/bc/adt/programs/includes/${encodedName}`;
            break;
        case 'function_group':
            path = `/sap/bc/adt/functions/groups/${encodedName}`;
            break;
        case 'function_module': {
            if (!args?.function_group) {
                throw new McpError(ErrorCode.InvalidParams, 'function_group is required for object_type "function_module"');
            }
            const encodedGroup = encodeURIComponent(String(args.function_group));
            path = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
            break;
        }
        case 'structure':
            path = `/sap/bc/adt/ddic/structures/${encodedName}`;
            break;
        case 'table':
            path = `/sap/bc/adt/ddic/tables/${encodedName}`;
            break;
        case 'cds_view':
            path = `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
            break;
        case 'behavior_definition':
            path = `/sap/bc/adt/bo/behaviordefinitions/${encodedName}`;
            break;
        case 'service_definition':
            path = `/sap/bc/adt/ddic/srvd/sources/${encodedName}`;
            break;
    }

    return { uri: `${baseUrl}${path}`, path, name };
}

export function escapeXmlAttribute(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Shared input schema fragment for the object_type/object_name/function_group triple,
// reused by the Lock/Unlock/Activate/SaveObjectSource tool definitions in index.ts.
export const objectLocatorSchemaProperties = {
    object_type: {
        type: 'string',
        enum: OBJECT_TYPES as unknown as string[],
        description: 'Type of the ABAP object'
    },
    object_name: {
        type: 'string',
        description: 'Name of the ABAP object (e.g. program name, class name, function module name, ...)'
    },
    function_group: {
        type: 'string',
        description: 'Name of the function group. Required only when object_type is "function_module".'
    }
};
