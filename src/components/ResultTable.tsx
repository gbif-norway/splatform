import { Card } from './ui-misc';
import { Button } from './ui-elements';
import { Copy, Check, AlertTriangle, FileJson, FileText, ArrowRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { GBIFOccurrence } from '../services/gbif';

interface ResultTableProps {
    step1Result: string;
    step2Result: string;
    isLoading: boolean;
    currentStep: number;
    gbifData?: GBIFOccurrence;
}

export function ResultTable({ step1Result, step2Result, isLoading, currentStep, gbifData }: ResultTableProps) {
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
            <Card className="p-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                    <h3 className="font-semibold text-primary">Step 1: Transcription</h3>
                    {step1Result && (
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(step1Result, 'step1')} className="h-8 w-8 p-0">
                            {copied === 'step1' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </Button>
                    )}
                </div>

                <div className="flex-1 min-h-[200px] overflow-auto rounded bg-surface p-4 border border-border font-mono text-sm whitespace-pre-wrap text-foreground">
                    {isLoading && currentStep === 1 ? (
                        <div className="animate-pulse flex space-x-4">
                            <div className="flex-1 space-y-4 py-1">
                                <div className="h-4 bg-surface-hover rounded w-3/4"></div>
                                <div className="h-4 bg-surface-hover rounded"></div>
                                <div className="h-4 bg-surface-hover rounded w-5/6"></div>
                            </div>
                        </div>
                    ) : step1Result || (isLoading ? "Waiting..." : "No result yet")}
                </div>
            </Card>

            {/* Step 2 Result */}
            <Card className="p-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                    <h3 className="font-semibold text-accent flex items-center gap-2">
                        Step 2: Standardization
                        {step2Result && (
                            isValidJson ?
                                <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full border border-success/20 flex items-center gap-1">
                                    <Check size={10} /> Valid JSON
                                </span> :
                                <span className="text-[10px] bg-error/10 text-error px-2 py-0.5 rounded-full border border-error/20 flex items-center gap-1">
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
                                {copied === 'step2' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                            </Button>
                        </div>
                    )}
                </div>

                <div className={`flex-1 min-h-[200px] overflow-auto rounded bg-surface p-4 border border-border font-mono text-sm whitespace-pre-wrap ${isValidJson && !showRaw ? 'text-success' : 'text-foreground'}`}>
                    {isLoading && currentStep === 2 ? (
                        <div className="animate-pulse flex space-x-4">
                            <div className="flex-1 space-y-4 py-1">
                                <div className="h-4 bg-surface-hover rounded w-3/4"></div>
                                <div className="h-4 bg-surface-hover rounded"></div>
                                <div className="h-4 bg-surface-hover rounded w-5/6"></div>
                            </div>
                        </div>
                    ) : (
                        step2Result ? (
                            isValidJson && !showRaw ? (
                                <pre className="text-xs">{JSON.stringify(parsedJson, null, 2)}</pre>
                            ) : (
                                <>
                                    {!isValidJson && step2Result && (
                                        <div className="mb-4 bg-error/10 border border-error/20 p-3 rounded text-error text-xs flex items-start gap-2">
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

            {/* Comparison Section (Full Width) */}
            {gbifData && step2Result && isValidJson && (
                <Card className="md:col-span-2 p-6 bg-surface shadow-lg overflow-hidden">
                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-border">
                        <ArrowRight className="text-primary" size={20} />
                        <h3 className="text-lg font-bold text-foreground">Comparison: AI Result vs. Official GBIF Data</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-border">
                                    <th className="pb-3 font-semibold text-foreground-muted w-1/4">Term</th>
                                    <th className="pb-3 font-semibold text-primary w-3/8">AI Extracted</th>
                                    <th className="pb-3 font-semibold text-success w-3/8">GBIF Official</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {[
                                    { term: 'Scientific Name', key: 'dwc:scientificName', gbif: gbifData.scientificName },
                                    { term: 'Event Date', key: 'dwc:eventDate', gbif: gbifData.eventDate },
                                    { term: 'Country', key: 'dwc:country', gbif: gbifData.country },
                                    { term: 'Locality', key: 'dwc:locality', gbif: gbifData.locality },
                                    { term: 'Recorded By', key: 'dwc:recordedBy', gbif: gbifData.recordedBy },
                                    { term: 'Catalog Number', key: 'dwc:catalogNumber', gbif: gbifData.catalogNumber },
                                    { term: 'Institution Code', key: 'dwc:institutionCode', gbif: gbifData.institutionCode },
                                    { term: 'Collection Code', key: 'dwc:collectionCode', gbif: gbifData.collectionCode },
                                ].map((row) => {
                                    const aiVal = parsedJson[row.key] || parsedJson[row.key.replace('dwc:', '')] || '-';
                                    const gbifVal = row.gbif || '-';
                                    const isMatch = aiVal.toString().toLowerCase() === gbifVal.toString().toLowerCase();

                                    return (
                                        <tr key={row.key} className="group hover:bg-surface-hover transition-colors">
                                            <td className="py-3 font-mono text-xs text-foreground-muted group-hover:text-foreground">
                                                {row.key}
                                                <div className="text-[10px] text-foreground-muted/60 mt-0.5">{row.term}</div>
                                            </td>
                                            <td className={`py-3 pr-4 align-top ${!isMatch && aiVal !== '-' ? 'text-primary font-medium' : 'text-foreground'}`}>
                                                {aiVal}
                                            </td>
                                            <td className={`py-3 align-top ${!isMatch && gbifVal !== '-' ? 'text-success font-medium' : 'text-foreground'}`}>
                                                {gbifVal}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
