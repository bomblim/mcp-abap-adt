import { McpError, ErrorCode, makeAdtRequest, return_error } from '../lib/utils';
import { getObjectUri } from '../lib/objectTypes';

/**
 * Releases a lock previously acquired with LockObject.
 */
export async function handleUnlockObject(args: any) {
    try {
        if (!args?.lock_handle) {
            throw new McpError(ErrorCode.InvalidParams, 'lock_handle is required');
        }

        const { uri } = await getObjectUri(args);

        await makeAdtRequest(
            uri,
            'POST',
            30000,
            undefined,
            { _action: 'UNLOCK', lockHandle: args.lock_handle },
            { 'X-sap-adt-sessiontype': 'stateful' }
        );

        return {
            isError: false,
            content: [{ type: 'text', text: 'Object unlocked successfully' }]
        };
    } catch (error) {
        return return_error(error);
    }
}
