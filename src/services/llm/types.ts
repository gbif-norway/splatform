export interface LLMModel {
    id: string;
    name: string;
    provider: 'openai' | 'gemini' | 'anthropic' | 'xai';
}

export interface LLMOptions {
    temperature?: number;
}

export interface LLMProvider {
    id: string;
    name: string;

    // List available models (dynamic or static fallback)
    listModels(apiKey: string, proxyUrl?: string, strict?: boolean): Promise<LLMModel[]>;

    // Step 1: Transcription
    // Image is passed as a base64 string (including data URI prefix)
    generateTranscription(apiKey: string, modelId: string, imageBase64: string, prompt: string, proxyUrl?: string, options?: LLMOptions): Promise<LLMResponse>;

    // Step 2: Standardization
    standardizeText(apiKey: string, modelId: string, text: string, prompt: string, proxyUrl?: string, options?: LLMOptions): Promise<LLMResponse>;
}

export interface LLMResponse {
    text: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}

export class LLMError extends Error {
    public provider: string;
    constructor(message: string, provider: string) {
        super(message);
        this.name = 'LLMError';
        this.provider = provider;
    }
}
