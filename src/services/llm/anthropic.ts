import { type LLMProvider, type LLMModel, LLMError } from './types';

export const AnthropicProvider: LLMProvider = {
    id: 'anthropic',
    name: 'Anthropic',

    listModels: async (apiKey: string, _proxyUrl?: string): Promise<LLMModel[]> => {
        // Anthropic list models API might be complex or just easier to static list valid vision models.
        const defaultModels: LLMModel[] = [
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' },
        ];
        if (!apiKey) return defaultModels;
        return defaultModels;
    },

    generateTranscription: async (apiKey: string, modelId: string, imageBase64: string, prompt: string, proxyUrl?: string): Promise<string> => {
        const match = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!match) throw new LLMError("Invalid image format", 'anthropic');
        const mimeType = match[1];
        const data = match[2];

        try {
            const baseUrl = 'https://api.anthropic.com/v1/messages';
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                    'anthropic-dangerously-allow-browser': 'true' // Required for browser usage
                },
                body: JSON.stringify({
                    model: modelId,
                    max_tokens: 4096,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "image",
                                    source: {
                                        type: "base64",
                                        media_type: mimeType,
                                        data: data
                                    }
                                },
                                { type: "text", text: prompt }
                            ]
                        }
                    ]
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'anthropic');
            }

            const resData = await response.json();
            return resData.content?.[0]?.text || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'anthropic');
        }
    },

    standardizeText: async (apiKey: string, modelId: string, text: string, prompt: string, proxyUrl?: string): Promise<string> => {
        try {
            const baseUrl = 'https://api.anthropic.com/v1/messages';
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                    'anthropic-dangerously-allow-browser': 'true'
                },
                body: JSON.stringify({
                    model: modelId,
                    max_tokens: 4096,
                    messages: [
                        { role: "user", content: `${prompt}\n\n${text}` }
                    ]
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'anthropic');
            }

            const resData = await response.json();
            return resData.content?.[0]?.text || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'anthropic');
        }
    }
};
