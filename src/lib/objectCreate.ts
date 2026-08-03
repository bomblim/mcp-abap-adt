import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getBaseUrl } from './utils';
import { getConfig } from '../index';
import { escapeXmlAttribute } from './objectTypes';

// ABAP object types the CreateObject tool knows how to build a creation payload for.
export const CREATABLE_OBJECT_TYPES = [
    'program',
    'class',
    'interface',
    'function_group',
    'include',
] as const;

export type CreatableObjectType = typeof CREATABLE_OBJECT_TYPES[number];

export interface CreatePayload {
    /** Collection URL the creation POST is sent to, e.g. https://host:port/sap/bc/adt/programs/programs */
    collectionUrl: string;
    contentType: string;
    body: string;
}

/**
 * Builds the ADT "create object" request (collection URL, Content-Type and XML body)
 * for the given object_type/object_name/package_name. Each ABAP object type has its
 * own XML namespace/schema, mirrored here from the well-known SAP ADT REST protocol
 * (as used by Eclipse ADT and other ADT clients). Content-Type version suffixes
 * (v2/v3/...) can vary slightly across NetWeaver releases; v2 is used here as the
 * most broadly compatible baseline.
 */
export async function buildCreatePayload(args: any): Promise<CreatePayload> {
    const objectType = args?.object_type as CreatableObjectType;
    if (!objectType || !(CREATABLE_OBJECT_TYPES as readonly string[]).includes(objectType)) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `object_type is required and must be one of: ${CREATABLE_OBJECT_TYPES.join(', ')}`
        );
    }
    if (!args?.object_name) {
        throw new McpError(ErrorCode.InvalidParams, 'object_name is required');
    }
    if (!args?.package_name) {
        throw new McpError(ErrorCode.InvalidParams, 'package_name is required');
    }

    const baseUrl = String(await getBaseUrl());
    const name = escapeXmlAttribute(String(args.object_name));
    const packageName = escapeXmlAttribute(String(args.package_name));
    const description = escapeXmlAttribute(String(args.description ?? args.object_name));
    const masterLanguage = escapeXmlAttribute(String(args.master_language ?? 'EN'));
    const responsible = escapeXmlAttribute(String(args.responsible ?? getConfig().username));

    const commonAttrs = `adtcore:name="${name}" adtcore:masterLanguage="${masterLanguage}" adtcore:description="${description}" adtcore:responsible="${responsible}"`;
    const packageRef = `<adtcore:packageRef adtcore:name="${packageName}"/>`;

    switch (objectType) {
        case 'program':
            return {
                collectionUrl: `${baseUrl}/sap/bc/adt/programs/programs`,
                contentType: 'application/vnd.sap.adt.programs.programs.v2+xml',
                body: `<?xml version="1.0" encoding="UTF-8"?>
<program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:adtcore="http://www.sap.com/adt/core" ${commonAttrs} adtcore:type="PROG/P">
${packageRef}
</program:abapProgram>`
            };

        case 'class': {
            const isFinal = args?.class_final === undefined ? true : Boolean(args.class_final);
            const visibility = String(args?.class_visibility ?? 'public');
            if (!['public', 'private', 'protected'].includes(visibility)) {
                throw new McpError(ErrorCode.InvalidParams, 'class_visibility must be one of: public, private, protected');
            }
            return {
                collectionUrl: `${baseUrl}/sap/bc/adt/oo/classes`,
                contentType: 'application/vnd.sap.adt.oo.classes.v2+xml',
                body: `<?xml version="1.0" encoding="UTF-8"?>
<class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="http://www.sap.com/adt/core" ${commonAttrs} adtcore:type="CLAS/OC" class:final="${isFinal}" class:visibility="${visibility}">
${packageRef}
</class:abapClass>`
            };
        }

        case 'interface':
            return {
                collectionUrl: `${baseUrl}/sap/bc/adt/oo/interfaces`,
                contentType: 'application/vnd.sap.adt.oo.interfaces.v2+xml',
                body: `<?xml version="1.0" encoding="UTF-8"?>
<intf:abapInterface xmlns:intf="http://www.sap.com/adt/oo/interfaces" xmlns:adtcore="http://www.sap.com/adt/core" ${commonAttrs} adtcore:type="INTF/OI">
${packageRef}
</intf:abapInterface>`
            };

        case 'function_group':
            return {
                collectionUrl: `${baseUrl}/sap/bc/adt/functions/groups`,
                contentType: 'application/vnd.sap.adt.functions.groups.v2+xml',
                body: `<?xml version="1.0" encoding="UTF-8"?>
<group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups" xmlns:adtcore="http://www.sap.com/adt/core" ${commonAttrs} adtcore:type="FUGR/F">
${packageRef}
</group:abapFunctionGroup>`
            };

        case 'include':
            return {
                collectionUrl: `${baseUrl}/sap/bc/adt/programs/includes`,
                contentType: 'application/vnd.sap.adt.programs.includes.v2+xml',
                body: `<?xml version="1.0" encoding="UTF-8"?>
<include:abapInclude xmlns:include="http://www.sap.com/adt/programs/includes" xmlns:adtcore="http://www.sap.com/adt/core" ${commonAttrs} adtcore:type="PROG/I">
${packageRef}
</include:abapInclude>`
            };
    }
}

export const createObjectSchemaProperties = {
    object_type: {
        type: 'string',
        enum: CREATABLE_OBJECT_TYPES as unknown as string[],
        description: 'Type of the ABAP object to create'
    },
    object_name: {
        type: 'string',
        description: 'Name of the new ABAP object'
    },
    package_name: {
        type: 'string',
        description: 'Package the object is created in (e.g. $TMP for a local object)'
    },
    description: {
        type: 'string',
        description: 'Short description of the object. Defaults to object_name if omitted.'
    },
    responsible: {
        type: 'string',
        description: 'Responsible user. Defaults to the configured SAP_USERNAME if omitted.'
    },
    master_language: {
        type: 'string',
        description: 'Master language of the object. Defaults to "EN".'
    },
    transport_request: {
        type: 'string',
        description: 'Transport request number, required if package_name is not a local ($ prefixed) package'
    },
    class_final: {
        type: 'boolean',
        description: 'Whether the class is FINAL. Only used when object_type is "class". Defaults to true.'
    },
    class_visibility: {
        type: 'string',
        enum: ['public', 'private', 'protected'],
        description: 'Visibility of the class. Only used when object_type is "class". Defaults to "public".'
    }
};
