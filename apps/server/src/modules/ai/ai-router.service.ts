import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AiRoutingDecision,
  AiTaskDescriptor,
  AiChatMessage,
  DEFAULT_TASK_PROFILES,
  resolveProvider,
} from '@zettra/shared';
import {
  AiProvider,
  LOCAL_PROVIDER,
  REMOTE_PROVIDER,
  StructuredRequest,
} from './ai-provider.interface';

/**
 * The single entry point for generative/reasoning calls (§14). Callers pass a task
 * descriptor, never a provider. Routing policy is the pure `resolveProvider` (shared);
 * this service only wires providers and handles the escalation-on-schema-failure retry.
 */
@Injectable()
export class AiRouterService {
  private readonly logger = new Logger(AiRouterService.name);

  constructor(
    @Inject(LOCAL_PROVIDER) private readonly local: AiProvider,
    @Inject(REMOTE_PROVIDER) private readonly remote: AiProvider,
  ) {}

  route(descriptor: AiTaskDescriptor): AiRoutingDecision {
    return resolveProvider(descriptor, DEFAULT_TASK_PROFILES[descriptor.type]);
  }

  private providerFor(decision: AiRoutingDecision): AiProvider {
    return decision.provider === 'remote' ? this.remote : this.local;
  }

  async chat(descriptor: AiTaskDescriptor, messages: AiChatMessage[]): Promise<string> {
    const decision = this.route(descriptor);
    this.logger.debug(`AI chat routed ${decision.provider} (${decision.reason})`);
    return this.providerFor(decision).chat(messages);
  }

  /**
   * Structured call with the §14.5 escalation-on-schema-failure retry: try the routed
   * provider; if local output fails schema validation AND the privacy gate permits, retry
   * remote. Privacy always beats quality — a `local_only` scope never escalates.
   */
  async structured<T>(
    descriptor: AiTaskDescriptor,
    req: StructuredRequest<T>,
  ): Promise<{
    result: T;
    decision: AiRoutingDecision;
  }> {
    const decision = this.route(descriptor);
    const provider = this.providerFor(decision);
    try {
      return { result: await provider.structured(req), decision };
    } catch (err) {
      const canRetryRemote =
        provider.kind === 'local' &&
        !decision.privacyDowngraded &&
        descriptor.privacyScope !== 'local_only';
      if (!canRetryRemote) throw err;

      this.logger.warn(
        `Local structured call failed schema validation; escalating to remote (§14.5): ${(err as Error).message}`,
      );
      const retried = this.route({ ...descriptor, schemaValidationFailed: true });
      return { result: await this.remote.structured(req), decision: retried };
    }
  }
}
