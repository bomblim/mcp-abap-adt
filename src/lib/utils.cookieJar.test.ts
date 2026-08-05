import { storeSetCookieHeaders, getCookieHeader, cleanup } from './utils';

describe('cookie jar (Set-Cookie -> Cookie header)', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns null when nothing has been stored', () => {
    expect(getCookieHeader()).toBeNull();
  });

  it('extracts only the name=value pair, dropping attributes like Path/HttpOnly', () => {
    storeSetCookieHeaders(['SAP_SESSIONID_ABC_100=deadbeef; path=/; HttpOnly; SameSite=None; Secure']);
    expect(getCookieHeader()).toBe('SAP_SESSIONID_ABC_100=deadbeef');
  });

  it('merges multiple Set-Cookie entries by name', () => {
    storeSetCookieHeaders([
      'SAP_SESSIONID_ABC_100=deadbeef; path=/; HttpOnly',
      'sap-usercontext=sap-client=100; path=/'
    ]);
    expect(getCookieHeader()).toBe('SAP_SESSIONID_ABC_100=deadbeef; sap-usercontext=sap-client=100');
  });

  it('overrides an existing cookie value when the same name is set again', () => {
    storeSetCookieHeaders(['SAP_SESSIONID_ABC_100=first; path=/']);
    storeSetCookieHeaders(['SAP_SESSIONID_ABC_100=second; path=/']);
    expect(getCookieHeader()).toBe('SAP_SESSIONID_ABC_100=second');
  });

  it('ignores malformed entries without an "=" while keeping valid ones', () => {
    storeSetCookieHeaders(['not-a-valid-cookie', 'valid=1; path=/']);
    expect(getCookieHeader()).toBe('valid=1');
  });

  it('is a no-op for undefined/empty input', () => {
    storeSetCookieHeaders(undefined);
    storeSetCookieHeaders([]);
    expect(getCookieHeader()).toBeNull();
  });
});
