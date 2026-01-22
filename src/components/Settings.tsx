import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { Input, Label, Button } from './ui-elements';
import { Card } from './ui-misc';
import { Eye, EyeOff, Save } from 'lucide-react';

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

    const handleSave = () => {
        saveSettings(keys);
        if (onClose) onClose();
    };

    return (
        <Card className="p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    LLM Settings
                </h2>
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
                        <div className="relative">
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
                                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                            >
                                {showKeys[field.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Proxy URL Configuration */}
            <div className="space-y-1 pt-4 border-t border-white/5">
                <Label htmlFor="proxyUrl">CORS Proxy URL (Optional)</Label>
                <p className="text-xs text-slate-500 mb-2">Required for Anthropic/xAI on standard web hosting.</p>
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
