import { McpError, ErrorCode, makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';
import { getObjectUri, escapeXmlAttribute } from '../lib/objectTypes';

/**
 * Runs an ADT syntax check (the same check Eclipse ADT runs on save) against an
 * object's source, without activating it. Useful to validate a SaveObjectSource
 * result before calling ActivateObject.
 */
export async function handleCheckObject(args: any) {
    try {
        const { path } = await getObjectUri(args);

        const version = args?.version ?? 'inactive';
        if (!['active', 'inactive'].includes(version)) {
            throw new McpError(ErrorCode.InvalidParams, 'version must be one of: active, inactive');
        }

        const checkUrl = `${await getBaseUrl()}/sap/bc/adt/checkruns`;
        const sourcePath = `${path}/source/main`;

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:adtcore="http://www.sap.com/adt/core" xmlns:chkrun="http://www.sap.com/adt/checkrun">
<chkrun:checkObject adtcore:uri="${escapeXmlAttribute(sourcePath)}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;

        const response = await makeAdtRequest(
            checkUrl,
            'POST',
            30000,
            body,
            { reporters: 'abapCheckRun' },
            {
                'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
                'X-sap-adt-sessiontype': 'stateful'
            }
        );

        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
