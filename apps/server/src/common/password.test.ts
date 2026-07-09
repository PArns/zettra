import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing (scrypt)', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a salted format with a unique hash each time', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(a).not.toBe(b); // random salt
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$deadbeef')).toBe(false);
  });
});
