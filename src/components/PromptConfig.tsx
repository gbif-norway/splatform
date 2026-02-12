import { Textarea, Label } from './ui-elements';
import { Select, Card } from './ui-misc';
import { useModels } from '../hooks/useModels';
import { cn } from '../utils/cn';

interface PromptConfigProps {
    step: 1 | 2;
    prompt: string;
    setPrompt: (val: string) => void;
    selectedModel: string;
    setSelectedModel: (val: string) => void;
    selectedProvider: string;
    setSelectedProvider: (val: string) => void;
    temperature: number;
    setTemperature: (val: number) => void;
    compact?: boolean;
}

export function PromptConfig({
    step,
    prompt,
    setPrompt,
    selectedModel,
    setSelectedModel,
    selectedProvider,
    setSelectedProvider,
    temperature,
    setTemperature,
    compact = false
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
        <Card className={cn(
            "space-y-4 border-l-4 bg-surface/60",
            step === 1 ? "border-l-primary" : "border-l-accent",
            compact ? "p-3 space-y-2" : "p-4"
        )}>
            <div className="flex items-center justify-between">
                <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-lg")}>
                    Step {step}: {step === 1 ? 'Transcription' : 'Standardization'}
                </h3>
                <div className="flex gap-2">
                    <Select
                        value={selectedProvider}
                        onChange={handleProviderChange}
                        className={cn(compact ? "w-24 text-xs" : "w-32")}
                    >
                        {providers.length === 0 && <option value="" disabled>No configured providers</option>}
                        {providers.map(p => (
                            <option key={p} value={p}>{p.toUpperCase()}</option>
                        ))}
                    </Select>
                    <Select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className={cn(compact ? "w-32 text-xs" : "w-48")}
                    >
                        {filteredModels.length === 0 ? (
                            <option value="">No models</option>
                        ) : (
                            filteredModels.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))
                        )}
                    </Select>
                </div>
            </div>

            <div className="space-y-1">
                {!compact && <Label>System Prompt</Label>}
                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={step === 1 ? "Example: Transcribe all text..." : "Example: Standardize to DWC JSON..."}
                    className={cn("font-mono text-sm", compact ? "min-h-[60px]" : "min-h-[100px]")}
                />
            </div>

            {!compact && <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                    <Label className="mb-0">Model Temperature</Label>
                    <span className="text-xs font-mono bg-surface px-2 py-0.5 rounded border border-border text-primary">{temperature.toFixed(2)}</span>
                </div>
                <div className="flex gap-4 items-center">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="flex-1 accent-primary bg-surface h-1.5 rounded-lg appearance-none cursor-pointer border border-border"
                    />
                </div>
            </div>}
        </Card>
    );
}
