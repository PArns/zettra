import { Injectable, Logger } from '@nestjs/common';
import { AiChatMessage } from '@zettra/shared';
import { loadConfig } from '../../config/configuration';
import { AiProvider, StructuredRequest } from './ai-provider.interface';

/**
 * Local provider backed by Ollama's OpenAI-compatible `/v1` endpoint (§14.3). Keep the model
 * resident via OLLAMA_KEEP_ALIVE to avoid bimodal latency (§14.5).
 */
@Injectable()
export class OllamaProvider implements AiProvider {
  readonly kind = 'local' as const;
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl = loadConfig().ollamaUrl;
  private readonly model = loadConfig().llmModel;

  async chat(messages: AiChatMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, keep_alive: '30m' }),
    });
    if (!res.ok) throw new Error(`Ollama chat failed: ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? '';
  }

  async structured<T>(req: StructuredRequest<T>): Promise<T> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        // Ask for JSON; the parse() call is the authoritative schema gate (§14.5).
        response_format: { type: 'json_object' },
        keep_alive: '30m',
      }),
    });
    if (!res.ok) throw new Error(`Ollama structured failed: ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return req.parse(json.choices?.[0]?.message?.content ?? '');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      return res.ok;
    } catch (err) {
      this.logger.warn(`Ollama unavailable: ${(err as Error).message}`);
      return false;
    }
  }
}
