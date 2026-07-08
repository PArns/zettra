import { describe, expect, it } from 'vitest';
import { DEFAULT_TASK_PROFILES, resolveProvider } from './routing';
import { AiTaskDescriptor } from './ai';
import { AiPrivacyScope, AiProviderKind, AiStakes, AiTaskType } from './enums';

const base = (over: Partial<AiTaskDescriptor> = {}): AiTaskDescriptor => ({
  type: AiTaskType.RelationCuration,
  privacyScope: AiPrivacyScope.Default,
  estimatedTokens: 1000,
  stakes: AiStakes.Low,
  ...over,
});

const profile = (t: AiTaskType) => DEFAULT_TASK_PROFILES[t];

describe('resolveProvider', () => {
  it('uses the task default when nothing escalates', () => {
    const d = resolveProvider(base(), profile(AiTaskType.RelationCuration));
    expect(d.provider).toBe(AiProviderKind.Local);
    expect(d.reason).toBe('task_default');
  });

  it('privacy gate keeps a high-stakes task local and flags a downgrade', () => {
    const d = resolveProvider(
      base({ privacyScope: AiPrivacyScope.LocalOnly, stakes: AiStakes.High }),
      profile(AiTaskType.RelationCuration),
    );
    expect(d.provider).toBe(AiProviderKind.Local);
    expect(d.reason).toBe('privacy_gate');
    expect(d.privacyDowngraded).toBe(true);
  });

  it('privacy gate without any escalation does not flag a downgrade', () => {
    const d = resolveProvider(
      base({ privacyScope: AiPrivacyScope.LocalOnly }),
      profile(AiTaskType.RelationCuration),
    );
    expect(d.provider).toBe(AiProviderKind.Local);
    expect(d.privacyDowngraded).toBe(false);
  });

  it('escalates to remote when context exceeds the local window', () => {
    const d = resolveProvider(
      base({ estimatedTokens: 999_999 }),
      profile(AiTaskType.CaptureTagging),
    );
    expect(d.provider).toBe(AiProviderKind.Remote);
    expect(d.reason).toBe('escalate_context');
  });

  it('prefers schema-validation failure as the escalation signal', () => {
    const d = resolveProvider(
      base({ schemaValidationFailed: true }),
      profile(AiTaskType.CaptureTagging),
    );
    expect(d.provider).toBe(AiProviderKind.Remote);
    expect(d.reason).toBe('escalate_schema_failure');
  });

  it('escalates on local unavailability and on high stakes', () => {
    expect(
      resolveProvider(base({ localUnavailable: true }), profile(AiTaskType.RelationCuration))
        .reason,
    ).toBe('escalate_unavailable');
    expect(
      resolveProvider(base({ stakes: AiStakes.High }), profile(AiTaskType.RelationCuration)).reason,
    ).toBe('escalate_stakes');
  });
});
