import { Global, Module } from '@nestjs/common';
import { AiRouterService } from './ai-router.service';
import { OllamaProvider } from './ollama.provider';
import { AnthropicProvider } from './anthropic.provider';
import { LOCAL_PROVIDER, REMOTE_PROVIDER } from './ai-provider.interface';

/** Wires the local/remote providers behind the AiRouter (§14). Global: many subsystems use it. */
@Global()
@Module({
  providers: [
    OllamaProvider,
    AnthropicProvider,
    { provide: LOCAL_PROVIDER, useExisting: OllamaProvider },
    { provide: REMOTE_PROVIDER, useExisting: AnthropicProvider },
    AiRouterService,
  ],
  exports: [AiRouterService],
})
export class AiModule {}
