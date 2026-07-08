import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiChatMessage } from '@zettra/shared';
import { loadConfig } from '../../config/configuration';
import { AiProvider, StructuredRequest } from './ai-provider.interface';

/**
 * Remote provider backed by Claude (§14.4). Reached only via capability escalation and never
 * when the privacy gate forbids it (§14.2). Batch calls and enforce a per-tenant budget
 * upstream (§14.5) — this class is the transport, not the policy.
 */
@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly kind = 'remote' as const;
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic | null;
  private readonly model = 'claude-sonnet-5';

  constructor() {
    const apiKey = loadConfig().anthropicApiKey;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  private requireClient(): Anthropic {
    if (!this.client) {
      throw new Error('ANTHROPIC_API_KEY not configured — remote provider unavailable.');
    }
    return this.client;
  }

  private split(messages: AiChatMessage[]): {
    system: string | undefined;
    rest: Anthropic.MessageParam[];
  } {
    const system = messages.find((m) => m.role === 'system')?.content;
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    return { system, rest };
  }

  async chat(messages: AiChatMessage[]): Promise<string> {
    const { system, rest } = this.split(messages);
    const res = await this.requireClient().messages.create({
      model: this.model,
      max_tokens: 2048,
      system,
      messages: rest,
    });
    const block = res.content.find((b) => b.type === 'text');
    return block && block.type === 'text' ? block.text : '';
  }

  async structured<T>(req: StructuredRequest<T>): Promise<T> {
    const raw = await this.chat(req.messages);
    return req.parse(raw);
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }
}
