import { type LLMProvider, type LLMModel, LLMError } from './types';

export const OpenAIProvider: LLMProvider = {
    id: 'openai',
    name: 'OpenAI',

    listModels: async (apiKey: string, proxyUrl?: string): Promise<LLMModel[]> => {
        // Default fallback models if fetch fails
        const defaultModels: LLMModel[] = [
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
        ];

        if (!apiKey) return defaultModels;

        try {
            const baseUrl = 'https://api.openai.com/v1/models';
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!response.ok) return defaultModels; // Fallback on error (CORS or auth)

            const data = await response.json();
            const models = data.data
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((m: any) => m.id.includes('gpt')) // Basic filter
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((m: any): LLMModel => ({
                    id: m.id,
                    name: m.id,
                    provider: 'openai'
                }));

            return models.length > 0 ? models : defaultModels;
        } catch {
            return defaultModels;
        }
    },

    generateTranscription: async (apiKey: string, modelId: string, imageBase64: string, prompt: string): Promise<string> => {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                                        url: imageBase64, // Expecting data:image/jpeg;base64,...
                                        detail: "high"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 4096
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'openai');
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'openai');
        }
    },

    standardizeText: async (apiKey: string, modelId: string, text: string, prompt: string, proxyUrl?: string): Promise<string> => {
        try {
            const baseUrl = 'https://api.openai.com/v1/chat/completions';
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
                    max_tokens: 4096
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'openai');
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'openai');
        }
    }
};
