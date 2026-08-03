import { makeAdtRequest, return_error, return_response } from '../lib/utils';
import { buildCreatePayload } from '../lib/objectCreate';

/**
 * Creates a new ABAP object (program, class, interface, function group, or include).
 * The object is created without source; use LockObject -> SaveObjectSource ->
 * ActivateObject -> UnlockObject to add and activate its source afterwards.
 */
export async function handleCreateObject(args: any) {
    try {
        const { collectionUrl, contentType, body } = await buildCreatePayload(args);

        const params: Record<string, any> = {};
        if (args?.transport_request) {
            params.corrNr = args.transport_request;
        }

        const response = await makeAdtRequest(
            collectionUrl,
            'POST',
            30000,
            body,
            params,
            { 'Content-Type': contentType }
        );

        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
