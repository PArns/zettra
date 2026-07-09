import { describe, expect, it } from 'vitest';
import { UploadsService } from './uploads.service';

// The service reads APP_SECRET via loadConfig(); the dev default is deterministic in tests.
const svc = new UploadsService();

describe('UploadsService signature (§8.3 signed URLs)', () => {
  it('verify accepts a signature produced by sign', () => {
    const key = 'tenant-1/abc.png';
    expect(() => svc.verify(key, svc.sign(key))).not.toThrow();
  });

  it('rejects a tampered key (signature bound to the exact key)', () => {
    const sig = svc.sign('tenant-1/abc.png');
    expect(() => svc.verify('tenant-1/other.png', sig)).toThrow();
  });

  it('rejects a missing or wrong signature', () => {
    const key = 'tenant-1/abc.png';
    expect(() => svc.verify(key, undefined)).toThrow();
    expect(() => svc.verify(key, 'deadbeef')).toThrow();
  });

  it('signature is URL-safe base64url (no +/= chars)', () => {
    expect(svc.sign('t/x.png')).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
