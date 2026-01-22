import { Textarea, Label } from './ui-elements';
import { Select, Card } from './ui-misc';
import { useModels } from '../hooks/useModels';

interface PromptConfigProps {
    step: 1 | 2;
    prompt: string;
    setPrompt: (val: string) => void;
    selectedModel: string;
    setSelectedModel: (val: string) => void;
    selectedProvider: string;
    setSelectedProvider: (val: string) => void;
}

export function PromptConfig({
    step,
    prompt,
    setPrompt,
    selectedModel,
    setSelectedModel,
    selectedProvider,
    setSelectedProvider
}: PromptConfigProps) {
    const { models } = useModels();

    // Filter available providers from model list
    const providers = Array.from(new Set(models.map(m => m.provider)));

    // Filter models for selected provider
    const filteredModels = models.filter(m => m.provider === selectedProvider);

    // Set default model when provider changes if current model is invalid
    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProvider = e.target.value;
        setSelectedProvider(newProvider);
        const firstModel = models.find(m => m.provider === newProvider);
        if (firstModel) setSelectedModel(firstModel.id);
    };

    return (
        <Card className="p-4 space-y-4 border-l-4 border-l-blue-500 bg-slate-900/60">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Step {step}: {step === 1 ? 'Transcription' : 'Standardization'}</h3>
                <div className="flex gap-2">
                    <Select
                        value={selectedProvider}
                        onChange={handleProviderChange}
                        className="w-32 bg-slate-800 border-slate-600"
                    >
                        {providers.length === 0 && <option value="openai">OpenAI</option>}
                        {providers.map(p => (
                            <option key={p} value={p}>{p.toUpperCase()}</option>
                        ))}
                    </Select>
                    <Select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-48 bg-slate-800 border-slate-600"
                    >
                        {filteredModels.length === 0 ? (
                            <option value="">No models (Check API Key)</option>
                        ) : (
                            filteredModels.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))
                        )}
                    </Select>
                </div>
            </div>

            <div className="space-y-1">
                <Label>System Prompt</Label>
                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={step === 1 ? "Example: Transcribe all text..." : "Example: Standardize to DWC JSON..."}
                    className="min-h-[100px] font-mono text-sm"
                />
            </div>
        </Card>
    );
}
