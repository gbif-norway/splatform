import { Card } from './ui-misc';
import { Button } from './ui-elements';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ResultTableProps {
    step1Result: string;
    step2Result: string;
    isLoading: boolean;
    currentStep: number;
}

export function ResultTable({ step1Result, step2Result, isLoading, currentStep }: ResultTableProps) {
    const [copied, setCopied] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!step1Result && !step2Result && !isLoading) return null;

    return (
        <div className="grid md:grid-cols-2 gap-6 w-full">
            {/* Step 1 Result */}
            <Card className="p-4 flex flex-col h-full bg-slate-900/40 border-slate-700">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                    <h3 className="font-semibold text-blue-400">Step 1: Transcription</h3>
                    {step1Result && (
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(step1Result, 'step1')} className="h-8 w-8 p-0">
                            {copied === 'step1' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </Button>
                    )}
                </div>

                <div className="flex-1 min-h-[200px] overflow-auto rounded bg-slate-950/50 p-4 border border-slate-800 font-mono text-sm whitespace-pre-wrap text-slate-300">
                    {isLoading && currentStep === 1 ? (
                        <div className="animate-pulse flex space-x-4">
                            <div className="flex-1 space-y-4 py-1">
                                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                                <div className="h-4 bg-slate-800 rounded"></div>
                                <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                            </div>
                        </div>
                    ) : step1Result || (isLoading ? "Waiting..." : "No result yet")}
                </div>
            </Card>

            {/* Step 2 Result */}
            <Card className="p-4 flex flex-col h-full bg-slate-900/40 border-slate-700">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                    <h3 className="font-semibold text-indigo-400">Step 2: Standardization</h3>
                    {step2Result && (
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(step2Result, 'step2')} className="h-8 w-8 p-0">
                            {copied === 'step2' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </Button>
                    )}
                </div>

                <div className="flex-1 min-h-[200px] overflow-auto rounded bg-slate-950/50 p-4 border border-slate-800 font-mono text-sm whitespace-pre-wrap text-slate-300">
                    {isLoading && currentStep === 2 ? (
                        <div className="animate-pulse flex space-x-4">
                            <div className="flex-1 space-y-4 py-1">
                                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                                <div className="h-4 bg-slate-800 rounded"></div>
                                <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                            </div>
                        </div>
                    ) : step2Result || (isLoading && currentStep < 2 ? "Pending Step 1..." : "No result yet")}
                </div>
            </Card>
        </div>
    );
}
