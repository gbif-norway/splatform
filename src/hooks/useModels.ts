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
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const key = (settings as any)[`${p}Key`];
                    // If no key, basic static list usually returned immediately by provider.
                    const provider = LLMService.getProvider(p);
                    const pModels = await provider.listModels(key, settings.proxyUrl);
                    all.push(...pModels);
                } catch (err) {
                    console.warn(`Failed to list models for ${p}`, err);
                    // Could optionally push defaults here if provider.listModels throws instead of returning defaults
                }
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
