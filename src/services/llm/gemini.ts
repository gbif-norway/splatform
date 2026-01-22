import { type LLMProvider, type LLMModel, LLMError } from './types';

export const GeminiProvider: LLMProvider = {
    id: 'gemini',
    name: 'Google Gemini',

    listModels: async (apiKey: string, proxyUrl?: string): Promise<LLMModel[]> => {
        const defaultModels: LLMModel[] = [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
            { id: 'gemini-1.0-pro-vision', name: 'Gemini 1.0 Pro Vision', provider: 'gemini' },
        ];

        if (!apiKey) return defaultModels;

        try {
            const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            // Note: Google Cloud API often does NOT support CORS for listing models from browser 
            // unless proxied. Direct requests might fail without a proxy.
            const response = await fetch(endpoint);

            if (!response.ok) return defaultModels;

            const data = await response.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const models = data.models
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((m: any) => m.name.includes('gemini') && (m.supportedGenerationMethods?.includes('generateContent')))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((m: any): LLMModel => {
                    const id = m.name.replace('models/', '');
                    return {
                        id: id,
                        name: m.displayName || id,
                        provider: 'gemini'
                    };
                });

            return models.length > 0 ? models : defaultModels;
        } catch {
            return defaultModels;
        }
    },

    generateTranscription: async (apiKey: string, modelId: string, imageBase64: string, prompt: string, proxyUrl?: string): Promise<string> => {
        // imageBase64 is data:image/jpeg;base64,.... we need to strip preamble
        const match = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!match) throw new LLMError("Invalid image format", 'gemini');
        const mimeType = match[1];
        const data = match[2];

        try {
            const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: data } }
                        ]
                    }]
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'gemini');
            }

            const resData = await response.json();
            return resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'gemini');
        }
    },

    standardizeText: async (apiKey: string, modelId: string, text: string, prompt: string, proxyUrl?: string): Promise<string> => {
        try {
            const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
            const endpoint = proxyUrl ? `${proxyUrl}/${baseUrl}` : baseUrl;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            // For Gemini, system prompt is different in 1.5, effectively it's safer to just user prompt it or use system_instruction if available.
                            // We will put prompt first then text.
                            { text: `${prompt}\n\nHere is the text to standardize:\n${text}` }
                        ]
                    }]
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new LLMError(err.error?.message || response.statusText, 'gemini');
            }

            const resData = await response.json();
            return resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } catch (e: unknown) {
            if (e instanceof LLMError) throw e;
            throw new LLMError(e instanceof Error ? e.message : 'Unknown error', 'gemini');
        }
    }
};
