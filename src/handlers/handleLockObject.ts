import convert from 'xml-js';
import { makeAdtRequest, return_error } from '../lib/utils';
import { getObjectUri } from '../lib/objectTypes';

/**
 * Locks an ABAP object for editing (SAP ADT stateful edit session).
 * The returned lock_handle must be passed to SaveObjectSource and UnlockObject.
 */
export async function handleLockObject(args: any) {
    try {
        const { uri } = await getObjectUri(args);

        const response = await makeAdtRequest(
            uri,
            'POST',
            30000,
            undefined,
            { _action: 'LOCK', accessMode: 'MODIFY' },
            {
                'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result2',
                'X-sap-adt-sessiontype': 'stateful'
            }
        );

        const parsed: any = convert.xml2js(response.data, { compact: true });
        const data = parsed?.['asx:abap']?.['asx:values']?.DATA;
        const lockHandle = data?.LOCK_HANDLE?._text;

        if (!lockHandle) {
            throw new Error('Lock request succeeded but the server did not return a lock handle');
        }

        return {
            isError: false,
            content: [{
                type: 'text',
                text: JSON.stringify({
                    lockHandle,
                    corrUser: data?.CORRUSER?._text,
                    corrNr: data?.CORRNR?._text
                })
            }]
        };
    } catch (error) {
        return return_error(error);
    }
}
