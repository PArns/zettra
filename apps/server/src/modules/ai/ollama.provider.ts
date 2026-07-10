import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiChatMessage } from '@zettra/shared';
import { loadConfig } from '../../config/configuration';
import { AiProvider, StructuredRequest } from './ai-provider.interface';

/**
 * Hold the model resident indefinitely. On a memory-tight box a *cold* 5 GB reload is what OOMs
 * the runner (a 7B loading while the embed model is active spikes past the cap); keeping it loaded
 * avoids the reload entirely. Trades ~5 GB of steady RAM for reliable, low-latency AI (§14.5).
 */
const KEEP_ALIVE = '24h';

/**
 * Local provider backed by Ollama's OpenAI-compatible `/v1` endpoint (§14.3). Keep the model
 * resident via `keep_alive` to avoid bimodal latency and cold-load OOMs (§14.5).
 */
@Injectable()
export class OllamaProvider implements AiProvider, OnModuleInit {
  readonly kind = 'local' as const;
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl = loadConfig().ollamaUrl;
  private readonly model = loadConfig().llmModel;

  /**
   * Warm the LLM on boot: a cold 4.7 GB model load on the *first* user chat reads as "assistant
   * unavailable" (the request outlives its tolerance). Preloading here — fire-and-forget, retried
   * a few times because the pull may still be finishing — means the first real chat is warm.
   * `keep_alive` then holds it resident (§14.5).
   */
  onModuleInit(): void {
    void this.warm(0);
  }

  private async warm(attempt: number): Promise<void> {
    try {
      // Empty prompt = Ollama loads the model into memory and returns without generating.
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: '', keep_alive: KEEP_ALIVE }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      this.logger.log(`Warmed LLM ${this.model}`);
    } catch (err) {
      // The model may still be pulling on a fresh volume; back off and retry a handful of times.
      if (attempt < 10) {
        setTimeout(() => void this.warm(attempt + 1), 30_000);
      } else {
        this.logger.warn(`LLM warm-up gave up: ${(err as Error).message}`);
      }
    }
  }

  async chat(messages: AiChatMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, keep_alive: KEEP_ALIVE }),
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
        keep_alive: KEEP_ALIVE,
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
