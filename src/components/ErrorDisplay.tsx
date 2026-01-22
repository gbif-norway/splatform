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
            <Card className="w-full max-w-2xl bg-background border-red-500/50 shadow-2xl shadow-red-500/10 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-red-500/10">
                    <h2 className="text-lg font-bold text-red-500 flex items-center gap-2">
                        Runtime Error
                    </h2>
                    <button onClick={onClose} className="text-foreground-muted hover:text-foreground"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-lg">
                        <p className="text-red-600 dark:text-red-400 font-medium text-lg">{error.message}</p>
                    </div>

                    <p className="text-foreground-muted text-sm">
                        An error occurred while communicating with the AI provider.
                        Below is the technical information useful for debugging.
                        You can copy this and send it to your developer or AI assistant to fix the issue.
                    </p>

                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider">Technical Details</h3>
                        <div className="bg-surface rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto border border-border">
                            <div className="grid grid-cols-[100px_1fr] gap-2 mb-4">
                                <span className="text-foreground-muted">Provider:</span>
                                <span className="text-primary font-bold">{context?.provider}</span>

                                <span className="text-foreground-muted">Model:</span>
                                <span className="text-accent font-bold">{context?.model}</span>

                                <span className="text-foreground-muted">Stage:</span>
                                <span className="text-primary">{context?.stage}</span>
                            </div>

                            <div className="border-t border-border pt-3 mt-2">
                                <span className="text-foreground-muted block mb-2">Full Error:</span>
                                <pre className="whitespace-pre-wrap text-foreground-muted">
                                    {JSON.stringify(context?.rawError, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-surface/50 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    <Button onClick={handleCopy}>
                        {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
                        {copied ? 'Copied Report' : 'Copy Debug Report'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
