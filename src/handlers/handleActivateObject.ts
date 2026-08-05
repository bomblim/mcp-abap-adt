import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';
import { getObjectUri, escapeXmlAttribute } from '../lib/objectTypes';

/**
 * Activates an inactive ABAP object (e.g. after SaveObjectSource).
 * Returns the raw ADT activation response, which lists any activation errors/warnings.
 */
export async function handleActivateObject(args: any) {
    try {
        const { path, name } = await getObjectUri(args);
        const activationUrl = `${await getBaseUrl()}/sap/bc/adt/activation`;

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
<adtcore:objectReference adtcore:uri="${escapeXmlAttribute(path)}" adtcore:name="${escapeXmlAttribute(name)}"/>
</adtcore:objectReferences>`;

        const response = await makeAdtRequest(
            activationUrl,
            'POST',
            30000,
            body,
            { method: 'activate', preauditRequested: true },
            {
                'Content-Type': 'application/xml',
                'X-sap-adt-sessiontype': 'stateful'
            }
        );

        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
