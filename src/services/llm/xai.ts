import { type LLMProvider, type LLMModel, type LLMOptions, LLMError } from './types';

// xAI uses OpenAI compatible API
export const XAIProvider: LLMProvider = {
    id: 'xai',
    name: 'xAI',

    listModels: async (apiKey: string, proxyUrl?: string, _strict?: boolean): Promise<LLMModel[]> => {
        const defaultModels: LLMModel[] = [
            { id: 'grok-vision-beta', name: 'Grok Vision Beta', provider: 'xai' },
            { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', provider: 'xai' },
        ];

        if (!apiKey) return defaultModels;

        try {
            const baseUrl = 'https://api.x.ai/v1/models';
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!response.ok) return defaultModels;

            const data = await response.json();
            const models = data.data
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((m: any) => m.id.includes('grok'))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((m: any): LLMModel => ({
                    id: m.id,
                    name: m.id,
                    provider: 'xai'
                }));

            return models.length > 0 ? models : defaultModels;
        } catch {
            return defaultModels;
        }
    },

    generateTranscription: async (apiKey: string, modelId: string, imageBase64: string, prompt: string, proxyUrl?: string, options?: LLMOptions): Promise<string> => {
        try {
            const baseUrl = 'https://api.x.ai/v1/chat/completions';
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: imageBase64,
                                        detail: "high"
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: options?.temperature,
                    stream: false
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'xai');
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'xai');
        }
    },

    standardizeText: async (apiKey: string, modelId: string, text: string, prompt: string, proxyUrl?: string, options?: LLMOptions): Promise<string> => {
        try {
            const baseUrl = 'https://api.x.ai/v1/chat/completions';
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [
                        { role: "system", content: prompt },
                        { role: "user", content: text }
                    ],
                    temperature: options?.temperature
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'xai');
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'xai');
        }
    }
};
