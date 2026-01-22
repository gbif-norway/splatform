import { useState, useEffect } from 'react';
import { LLMService, type LLMModel } from '../services/llm';
import { useSettings } from './useSettings';

export function useModels() {
    const { settings } = useSettings();
    const [models, setModels] = useState<LLMModel[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchModels = async () => {
        setLoading(true);
        try {
            const providers = ['openai', 'gemini', 'anthropic', 'xai'];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const all: LLMModel[] = [];

            await Promise.all(providers.map(async (p) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const key = (settings as any)[`${p}Key`];
                const provider = LLMService.getProvider(p);
                const pModels = await provider.listModels(key, settings.proxyUrl);
                all.push(...pModels);
            }));

            setModels(all);
        } catch (e) {
            console.error("Failed to fetch models", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.openaiKey, settings.geminiKey, settings.anthropicKey, settings.xaiKey, settings.proxyUrl]);

    return { models, refreshModels: fetchModels, loading };
}
