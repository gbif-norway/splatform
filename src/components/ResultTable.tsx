import { Card } from './ui-misc';
import { Button } from './ui-elements';
import { Copy, Check, AlertTriangle, FileJson, FileText } from 'lucide-react';
import { useState, useMemo } from 'react';

interface ResultTableProps {
    step1Result: string;
    step2Result: string;
    isLoading: boolean;
    currentStep: number;
}

export function ResultTable({ step1Result, step2Result, isLoading, currentStep }: ResultTableProps) {
    const [copied, setCopied] = useState<string | null>(null);
    const [showRaw, setShowRaw] = useState(false);

    const { isValidJson, parsedJson } = useMemo(() => {
        if (!step2Result) return { isValidJson: false, parsedJson: null };
        try {
            // Try to find JSON object if it's wrapped in markdown code blocks
            let clean = step2Result.trim();
            if (clean.startsWith('```json')) {
                clean = clean.replace(/^```json/, '').replace(/```$/, '');
            } else if (clean.startsWith('```')) {
                clean = clean.replace(/^```/, '').replace(/```$/, '');
            }

            const obj = JSON.parse(clean);
            return { isValidJson: true, parsedJson: obj };
        } catch {
            return { isValidJson: false, parsedJson: null };
        }
    }, [step2Result]);

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
                    <h3 className="font-semibold text-indigo-400 flex items-center gap-2">
                        Step 2: Standardization
                        {step2Result && (
                            isValidJson ?
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                    <Check size={10} /> Valid JSON
                                </span> :
                                <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1">
                                    <AlertTriangle size={10} /> Invalid JSON
                                </span>
                        )}
                    </h3>
                    {step2Result && (
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)} className="h-8 w-8 p-0" title={showRaw ? "Show Formatted" : "Show Raw"}>
                                {showRaw ? <FileJson size={14} /> : <FileText size={14} />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(step2Result, 'step2')} className="h-8 w-8 p-0">
                                {copied === 'step2' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </Button>
                        </div>
                    )}
                </div>

                <div className={`flex-1 min-h-[200px] overflow-auto rounded bg-slate-950/50 p-4 border border-slate-800 font-mono text-sm whitespace-pre-wrap ${isValidJson && !showRaw ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {isLoading && currentStep === 2 ? (
                        <div className="animate-pulse flex space-x-4">
                            <div className="flex-1 space-y-4 py-1">
                                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                                <div className="h-4 bg-slate-800 rounded"></div>
                                <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                            </div>
                        </div>
                    ) : (
                        step2Result ? (
                            isValidJson && !showRaw ? (
                                <pre className="text-xs">{JSON.stringify(parsedJson, null, 2)}</pre>
                            ) : (
                                <>
                                    {!isValidJson && step2Result && (
                                        <div className="mb-4 bg-red-900/20 border border-red-900/50 p-3 rounded text-red-200 text-xs flex items-start gap-2">
                                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-bold">Parsing Error</p>
                                                <p>The output is not valid JSON. Showing raw text below.</p>
                                            </div>
                                        </div>
                                    )}
                                    {step2Result}
                                </>
                            )
                        ) : (isLoading && currentStep < 2 ? "Pending Step 1..." : "No result yet")
                    )}
                </div>
            </Card>
        </div>
    );
}
