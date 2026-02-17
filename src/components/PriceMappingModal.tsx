
import { useState, useEffect, useMemo } from 'react';
import { Button, Input } from './ui-elements';
import { Card } from './ui-misc';
import { X, Save, Search } from 'lucide-react';
import { PricingService } from '../services/llm/pricing';

interface PriceMappingModalProps {
    unknownModelId: string;
    onSave: () => void;
    onClose: () => void;
}

export function PriceMappingModal({ unknownModelId, onSave, onClose }: PriceMappingModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [availableModels, setAvailableModels] = useState<any[]>([]);

    useEffect(() => {
        setAvailableModels(PricingService.getAllModels());
    }, []);

    const filteredModels = useMemo(() => {
        if (!searchTerm) return availableModels;
        const lower = searchTerm.toLowerCase();
        return availableModels.filter(m =>
            m.id.toLowerCase().includes(lower) ||
            m.name.toLowerCase().includes(lower) ||
            m.vendor.toLowerCase().includes(lower)
        );
    }, [availableModels, searchTerm]);

    const handleSave = () => {
        if (selectedModel) {
            PricingService.addAlias(unknownModelId, selectedModel);
            onSave();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg p-6 space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-border pb-3">
                    <h3 className="text-lg font-bold">Map Pricing for "{unknownModelId}"</h3>
                    <button onClick={onClose} className="text-foreground-muted hover:text-foreground">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-2">
                    <p className="text-sm text-foreground-muted">
                        This model does not have a known price. Please select a compatible pricing model to use for cost estimation.
                    </p>

                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-foreground-muted" />
                        <Input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search known models..."
                            className="pl-9"
                        />
                    </div>

                    <div className="h-64 overflow-y-auto border border-border rounded-md bg-surface/50">
                        {filteredModels.length === 0 ? (
                            <div className="p-4 text-center text-foreground-muted text-sm">No models found.</div>
                        ) : (
                            <div className="divide-y divide-border">
                                {filteredModels.map(model => (
                                    <div
                                        key={model.id}
                                        onClick={() => setSelectedModel(model.id)}
                                        className={`p-3 cursor-pointer text-sm flex justify-between items-center transition-colors ${selectedModel === model.id ? 'bg-primary/10' : 'hover:bg-surface-hover'}`}
                                    >
                                        <div>
                                            <div className="font-medium">{model.name}</div>
                                            <div className="text-xs text-foreground-muted">{model.id} • {model.vendor}</div>
                                        </div>
                                        <div className="text-xs text-foreground-muted text-right">
                                            <div>In: ${model.input}</div>
                                            <div>Out: ${model.output}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!selectedModel}>
                        <Save size={16} className="mr-2" /> Save Mapping
                    </Button>
                </div>
            </Card>
        </div>
    );
}
