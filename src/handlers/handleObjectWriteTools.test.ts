import { handleLockObject } from './handleLockObject';
import { handleUnlockObject } from './handleUnlockObject';
import { handleSaveObjectSource } from './handleSaveObjectSource';
import { handleActivateObject } from './handleActivateObject';
import { cleanup } from '../lib/utils';

// These tests only cover input validation, since exercising the real ADT
// lock/save/activate flow requires a live SAP system.
describe('object write tools - input validation', () => {
  afterAll(() => {
    cleanup();
  });

  describe('handleLockObject', () => {
    it('rejects a missing object_type', async () => {
      const result = await handleLockObject({ object_name: 'ZFOO' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('object_type');
    });

    it('rejects an unknown object_type', async () => {
      const result = await handleLockObject({ object_type: 'nonsense', object_name: 'ZFOO' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('object_type');
    });

    it('rejects function_module without function_group', async () => {
      const result = await handleLockObject({ object_type: 'function_module', object_name: 'ZFOO' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('function_group');
    });
  });

  describe('handleUnlockObject', () => {
    it('rejects a missing lock_handle', async () => {
      const result = await handleUnlockObject({ object_type: 'program', object_name: 'ZFOO' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('lock_handle');
    });
  });

  describe('handleSaveObjectSource', () => {
    it('rejects a missing lock_handle', async () => {
      const result = await handleSaveObjectSource({ object_type: 'program', object_name: 'ZFOO', source_code: 'REPORT zfoo.' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('lock_handle');
    });

    it('rejects a missing source_code', async () => {
      const result = await handleSaveObjectSource({ object_type: 'program', object_name: 'ZFOO', lock_handle: 'abc' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('source_code');
    });
  });

  describe('handleActivateObject', () => {
    it('rejects a missing object_name', async () => {
      const result = await handleActivateObject({ object_type: 'program' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('object_name');
    });
  });
});
