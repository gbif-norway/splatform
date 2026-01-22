import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { AnthropicProvider } from './anthropic';
import { XAIProvider } from './xai';

export const LLMService = {
    getProvider: (providerId: string): LLMProvider => {
        switch (providerId) {
            case 'openai': return OpenAIProvider;
            case 'gemini': return GeminiProvider;
            case 'anthropic': return AnthropicProvider;
            case 'xai': return XAIProvider;
            default: throw new Error(`Provider ${providerId} not found`);
        }
    }
};

export { OpenAIProvider, GeminiProvider, AnthropicProvider, XAIProvider };
export * from './types';
