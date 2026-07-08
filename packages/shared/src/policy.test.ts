import { describe, expect, it } from 'vitest';
import { decideLink, PolicyRow, resolveThresholds } from './policy';
import { DEFAULT_THRESHOLDS } from './approval';
import { PolicyScope } from './enums';

describe('resolveThresholds', () => {
  it('falls back to defaults with no policies', () => {
    expect(resolveThresholds([])).toEqual(DEFAULT_THRESHOLDS);
  });

  it('space policy wins over user and system (invariant 9)', () => {
    const rows: PolicyRow[] = [
      { scope: PolicyScope.System, autoApprove: 0.9, suggest: 0.5 },
      { scope: PolicyScope.User, autoApprove: 0.8, suggest: 0.4 },
      { scope: PolicyScope.Space, autoApprove: 0.95, suggest: 0.6 },
    ];
    expect(resolveThresholds(rows)).toEqual({ autoApprove: 0.95, suggest: 0.6 });
  });

  it('user policy wins over system when no space policy', () => {
    const rows: PolicyRow[] = [
      { scope: PolicyScope.System, autoApprove: 0.9, suggest: 0.5 },
      { scope: PolicyScope.User, autoApprove: 0.8, suggest: 0.4 },
    ];
    expect(resolveThresholds(rows)).toEqual({ autoApprove: 0.8, suggest: 0.4 });
  });
});

describe('decideLink', () => {
  const t = { autoApprove: 0.9, suggest: 0.5 };
  it('confirms at/above autoApprove', () => {
    expect(decideLink(0.9, t).action).toBe('confirm');
    expect(decideLink(0.95, t).action).toBe('confirm');
  });
  it('suggests in the middle band', () => {
    expect(decideLink(0.5, t).action).toBe('suggest');
    expect(decideLink(0.89, t).action).toBe('suggest');
  });
  it('drops below suggest', () => {
    expect(decideLink(0.49, t).action).toBe('drop');
    expect(decideLink(0, t).action).toBe('drop');
  });
  it('echoes the confidence for the audit trail', () => {
    expect(decideLink(0.72, t).confidence).toBe(0.72);
  });
});
