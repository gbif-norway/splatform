import { LLMService } from '../services/llm';
import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { Input, Label, Button } from './ui-elements';
import { Card } from './ui-misc';
import { Eye, EyeOff, Save, X } from 'lucide-react';

export function Settings({ onClose }: { onClose?: () => void }) {
    const { settings, saveSettings } = useSettings();
    const [keys, setKeys] = useState(settings);
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

    const handleChange = (key: keyof typeof keys, value: string) => {
        setKeys(prev => ({ ...prev, [key]: value }));
    };

    const toggleShow = (key: string) => {
        setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const [validating, setValidating] = useState<Record<string, boolean>>({});
    const [validationStatus, setValidationStatus] = useState<Record<string, 'success' | 'error' | null>>({});

    const handleValidate = async (fieldId: string) => {
        const providerId = fieldId.replace('Key', '');
        const apiKey = keys[fieldId as keyof typeof keys];

        if (!apiKey) return;

        setValidating(prev => ({ ...prev, [fieldId]: true }));
        setValidationStatus(prev => ({ ...prev, [fieldId]: null }));

        try {
            const provider = LLMService.getProvider(providerId);
            // Try to list models as a lightweight test
            const models = await provider.listModels(apiKey as string, keys.proxyUrl);
            if (models.length > 0) {
                setValidationStatus(prev => ({ ...prev, [fieldId]: 'success' }));
            } else {
                // Some providers might return empty list but valid connection, but usually not.
                setValidationStatus(prev => ({ ...prev, [fieldId]: 'success' }));
            }
        } catch (e) {
            console.error(e);
            setValidationStatus(prev => ({ ...prev, [fieldId]: 'error' }));
        } finally {
            setValidating(prev => ({ ...prev, [fieldId]: false }));
        }
    };

    const handleSave = () => {
        saveSettings(keys);
        if (onClose) onClose();
    };

    return (
        <Card className="p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
                <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    LLM Settings
                </h2>
                {onClose && (
                    <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
                        <X size={20} />
                    </button>
                )}
            </div>

            <div className="grid gap-4">
                {[
                    { id: 'openaiKey', label: 'OpenAI API Key', placeholder: 'sk-...' },
                    { id: 'geminiKey', label: 'Google Gemini API Key', placeholder: 'AIza...' },
                    { id: 'anthropicKey', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
                    { id: 'xaiKey', label: 'xAI API Key', placeholder: 'key...' },
                ].map((field) => (
                    <div key={field.id} className="space-y-1">
                        <Label htmlFor={field.id}>{field.label}</Label>
                        <div className="relative flex gap-2">
                            <div className="relative flex-grow">
                                <Input
                                    id={field.id}
                                    type={showKeys[field.id] ? "text" : "password"}
                                    value={keys[field.id as keyof typeof keys]}
                                    onChange={(e) => handleChange(field.id as keyof typeof keys, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => toggleShow(field.id)}
                                    className="absolute right-3 top-2.5 text-foreground-muted hover:text-foreground"
                                >
                                    {showKeys[field.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <Button
                                variant="secondary"
                                className="px-3"
                                onClick={() => handleValidate(field.id)}
                                disabled={validating[field.id] || !keys[field.id as keyof typeof keys]}
                                title="Test connection"
                            >
                                {validating[field.id] ? (
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <span className={validationStatus[field.id] === 'success' ? 'text-success' : validationStatus[field.id] === 'error' ? 'text-error' : 'text-foreground-muted'}>
                                        Test
                                    </span>
                                )}
                            </Button>
                        </div>
                        {validationStatus[field.id] === 'success' && <p className="text-xs text-success">Connection successful!</p>}
                        {validationStatus[field.id] === 'error' && <p className="text-xs text-error">Connection failed. Check key or proxy settings.</p>}
                    </div>
                ))}
            </div>

            {/* Proxy URL Configuration */}
            <div className="space-y-1 pt-4 border-t border-border">
                <Label htmlFor="proxyUrl">CORS Proxy URL (Optional)</Label>
                <p className="text-xs text-foreground-muted mb-2">Required for Anthropic/xAI on standard web hosting.</p>
                <Input
                    id="proxyUrl"
                    type="text"
                    value={keys.proxyUrl || ''}
                    onChange={(e) => handleChange('proxyUrl', e.target.value)}
                    placeholder="https://your-proxy.com"
                />
            </div>

            <div className="pt-4 flex justify-end">
                <Button onClick={handleSave} className="w-full sm:w-auto">
                    <Save size={16} className="mr-2" />
                    Save Settings
                </Button>
            </div>
        </Card>
    );
}
