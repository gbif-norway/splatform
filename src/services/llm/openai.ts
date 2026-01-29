import { type LLMProvider, type LLMModel, type LLMOptions, LLMError } from './types';

const getEndpointInfo = (modelId: string, proxyUrl?: string) => {
    const baseUrl = 'https://api.openai.com/v1';
    let path = 'chat/completions';
    let mode: 'chat' | 'completion' | 'responses' = 'chat';

    if (modelId.includes('gpt-5') || modelId.includes('responses')) {
        path = 'responses';
        mode = 'responses';
    } else if (modelId.includes('-instruct') || /davinci|curie|babbage|ada/.test(modelId)) {
        path = 'completions';
        mode = 'completion';
    }

    const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}/${path}` : `${baseUrl}/${path}`;
    return { endpoint, mode };
};

export const OpenAIProvider: LLMProvider = {
    id: 'openai',
    name: 'OpenAI',

    listModels: async (apiKey: string, proxyUrl?: string, _strict?: boolean): Promise<LLMModel[]> => {
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
                .filter((m: any) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3')) // Basic filter
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

    generateTranscription: async (apiKey: string, modelId: string, imageBase64: string, prompt: string, proxyUrl?: string, options?: LLMOptions): Promise<string> => {
        try {
            const { endpoint, mode } = getEndpointInfo(modelId, proxyUrl);

            const isModern = modelId.includes('o1') || modelId.includes('o3') || modelId.includes('gpt-4o') || modelId.includes('gpt-5') || modelId.includes('chat-latest');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let body: any;

            if (mode === 'responses') {
                body = {
                    model: modelId,
                    input: [
                        {
                            type: "message",
                            role: "user",
                            content: [
                                { type: "input_text", text: prompt },
                                {
                                    type: "input_image",
                                    image_url: imageBase64 // Pass as string directly
                                }
                            ]
                        }
                    ]
                };
            } else if (mode === 'completion') {
                body = {
                    model: modelId,
                    prompt: `${prompt}\n\n[Image provided but legacy completions do not support visual inputs natively. Attempting as text-only or proxy-supported vision.]`,
                };
            } else {
                body = {
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
                    ]
                };
            }

            if (options?.temperature !== undefined) {
                body.temperature = options.temperature;
            }

            if (mode === 'responses') {
                body.max_output_tokens = 4096;
            } else if (isModern) {
                body.max_completion_tokens = 4096;
            } else {
                body.max_tokens = 4096;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'openai');
            }

            const data = await response.json();
            if (mode === 'responses') {
                // OpenAI Responses API structure can vary.
                // It might be output[0].content or output[0].message.content or output[0].text depending on configuration.
                // We'll try to find the content in a few likely places.
                // Filter out reasoning chunks which might come first in gpt-5/reasoning models
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const output = (data.output as any[])?.find((o: any) => o.type !== 'reasoning') || data.output?.[0];
                if (!output) return "";

                // Case 1: output itself has content array (User's case)
                if (output.content && Array.isArray(output.content)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return output.content.map((c: any) => c.text || '').join('');
                }

                // Case 2: output has message object
                if (output.message?.content) {
                    if (typeof output.message.content === 'string') return output.message.content;
                    if (Array.isArray(output.message.content)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return output.message.content.map((c: any) => c.text || '').join('');
                    }
                }

                // Case 3: simple text field
                if (typeof output.text === 'string') return output.text;

                return JSON.stringify(output); // Fallback for debugging
            } else if (mode === 'completion') {
                return data.choices[0]?.text || "";
            }
            return data.choices[0]?.message?.content || "";
        } catch (e: unknown) {
            console.error('[OpenAI] Transcription Error:', e);
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'openai');
        }
    },

    standardizeText: async (apiKey: string, modelId: string, text: string, prompt: string, proxyUrl?: string, options?: LLMOptions): Promise<string> => {
        try {
            const { endpoint, mode } = getEndpointInfo(modelId, proxyUrl);

            const isModern = modelId.includes('o1') || modelId.includes('o3') || modelId.includes('gpt-4o') || modelId.includes('gpt-5') || modelId.includes('chat-latest');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let body: any;

            if (mode === 'responses') {
                body = {
                    model: modelId,
                    input: [
                        {
                            type: "message",
                            role: "user",
                            content: [
                                { type: "input_text", text: `${prompt}\n\nText to standardize:\n${text}` }
                            ]
                        }
                    ]
                };
            } else if (mode === 'completion') {
                body = {
                    model: modelId,
                    prompt: `${prompt}\n\nText to standardize:\n${text}`
                };
            } else {
                body = {
                    model: modelId,
                    messages: [
                        { role: "system", content: prompt },
                        { role: "user", content: text }
                    ]
                };
            }

            if (options?.temperature !== undefined) {
                body.temperature = options.temperature;
            }

            if (mode === 'responses') {
                body.max_output_tokens = 4096;
            } else if (isModern) {
                body.max_completion_tokens = 4096;
            } else {
                body.max_tokens = 4096;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'openai');
            }

            const data = await response.json();
            if (mode === 'responses') {
                // OpenAI Responses API structure can vary.
                // It might be output[0].content or output[0].message.content or output[0].text depending on configuration.
                // We'll try to find the content in a few likely places.
                // Filter out reasoning chunks which might come first in gpt-5/reasoning models
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const output = (data.output as any[])?.find((o: any) => o.type !== 'reasoning') || data.output?.[0];
                if (!output) return "";

                // Case 1: output itself has content array (User's case)
                if (output.content && Array.isArray(output.content)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return output.content.map((c: any) => c.text || '').join('');
                }

                // Case 2: output has message object
                if (output.message?.content) {
                    if (typeof output.message.content === 'string') return output.message.content;
                    if (Array.isArray(output.message.content)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return output.message.content.map((c: any) => c.text || '').join('');
                    }
                }

                // Case 3: simple text field
                if (typeof output.text === 'string') return output.text;

                return JSON.stringify(output); // Fallback for debugging
            } else if (mode === 'completion') {
                return data.choices[0]?.text || "";
            }
            return data.choices[0]?.message?.content || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'openai');
        }
    }
};
