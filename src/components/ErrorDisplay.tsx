import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui-elements';
import { Card } from './ui-misc';

interface ErrorContext {
    provider: string;
    model: string;
    stage: 'transcription' | 'standardization';
    prompt: string;
    rawError: any;
}

interface ErrorDisplayProps {
    error: Error | null;
    context: ErrorContext | null;
    onClose: () => void;
}

export function ErrorDisplay({ error, context, onClose }: ErrorDisplayProps) {
    const [copied, setCopied] = useState(false);

    if (!error) return null;

    const generateReport = () => {
        return `### Bug Report
**Error**: ${error.message}
**Time**: ${new Date().toISOString()}

**Context**:
- **Operation**: ${context?.stage}
- **Provider**: ${context?.provider}
- **Model**: ${context?.model}

**Raw Error Object**:
\`\`\`json
${JSON.stringify(context?.rawError || {}, null, 2)}
\`\`\`

**Stack Trace**:
\`\`\`
${error.stack}
\`\`\`
`;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateReport());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl bg-slate-900 border-red-500/50 shadow-2xl shadow-red-900/20 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-red-500/10">
                    <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                        Runtime Error
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-lg">
                        <p className="text-red-200 font-medium text-lg">{error.message}</p>
                    </div>

                    <p className="text-slate-400 text-sm">
                        An error occurred while communicating with the AI provider.
                        Below is the technical information useful for debugging.
                        You can copy this and send it to your developer or AI assistant to fix the issue.
                    </p>

                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Technical Details</h3>
                        <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
                            <div className="grid grid-cols-[100px_1fr] gap-2 mb-4">
                                <span className="text-slate-500">Provider:</span>
                                <span className="text-blue-400">{context?.provider}</span>

                                <span className="text-slate-500">Model:</span>
                                <span className="text-blue-400">{context?.model}</span>

                                <span className="text-slate-500">Stage:</span>
                                <span className="text-yellow-400">{context?.stage}</span>
                            </div>

                            <div className="border-t border-slate-800 pt-3 mt-2">
                                <span className="text-slate-500 block mb-2">Full Error:</span>
                                <pre className="whitespace-pre-wrap text-slate-400">
                                    {JSON.stringify(context?.rawError, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-slate-900/50 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    <Button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-500 text-white border-none">
                        {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
                        {copied ? 'Copied Report' : 'Copy Debug Report'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
