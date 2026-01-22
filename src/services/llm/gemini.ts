import { type LLMProvider, type LLMModel, LLMError } from './types';

export const GeminiProvider: LLMProvider = {
    id: 'gemini',
    name: 'Google Gemini',

    listModels: async (apiKey: string, _proxyUrl?: string): Promise<LLMModel[]> => {
        // Gemini API list_models requires a different endpoint style, often complex to list just compatible ones.
        // We'll stick to a solid static list + basic fetch check if possible, but for now specific models are safer.
        const defaultModels: LLMModel[] = [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
            { id: 'gemini-1.0-pro-vision', name: 'Gemini 1.0 Pro Vision', provider: 'gemini' },
        ];
        // We verify key validity by just returning defaults or attempting a dummy call? 
        // For now, static list is fine for Gemini as models are stable.
        if (!apiKey) return defaultModels;
        return defaultModels;
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
