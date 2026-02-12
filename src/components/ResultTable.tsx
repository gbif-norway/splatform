import { Card } from './ui-misc';
import { Button } from './ui-elements';
import { Copy, Check, AlertTriangle, FileJson, Table as TableIcon, ArrowRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '../utils/cn';
import type { GBIFOccurrence } from '../services/gbif';

interface ResultTableProps {
    step1Result: string;
    step2Result: string;
    isLoading: boolean;
    currentStep: number;
    gbifData?: GBIFOccurrence;
    detectedBarcodes?: string[];
}

export function ResultTable({ step1Result, step2Result, isLoading, currentStep, gbifData, detectedBarcodes }: ResultTableProps) {
    const [copied, setCopied] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'json'>('table');

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
        <div className="flex flex-col gap-6 w-full">
            {/* Detected Barcodes */}
            {detectedBarcodes && detectedBarcodes.length > 0 && (
                <Card className="p-4 flex flex-col bg-accent/5 border-accent/20">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-accent/20 p-1 rounded text-accent">
                            <TableIcon size={14} />
                        </div>
                        <h3 className="font-semibold text-accent text-sm uppercase tracking-wide">Detected Barcodes</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {detectedBarcodes.map((code, idx) => (
                            <div key={idx} className="bg-background border border-accent/30 rounded px-3 py-1.5 font-mono text-sm shadow-sm flex items-center gap-2">
                                {code}
                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(code, `code-${idx}`)} className="h-6 w-6 p-0 opacity-50 hover:opacity-100">
                                    {copied === `code-${idx}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                                </Button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Step 1 Result */}
            <Card className="p-4 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                    <h3 className="font-semibold text-primary">Step 1: Transcription</h3>
                    {step1Result && (
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(step1Result, 'step1')} className="h-8 w-8 p-0">
                            {copied === 'step1' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </Button>
                    )}
                </div>

                <div className="flex-1 min-h-[150px] overflow-auto rounded bg-surface p-4 border border-border font-mono text-sm whitespace-pre-wrap text-foreground">
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
            <Card className="p-4 flex flex-col">
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
                        <div className="flex items-center gap-2">
                            {isValidJson && (
                                <div className="flex items-center bg-surface-hover rounded-lg border border-border p-0.5 mr-2">
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                            viewMode === 'table'
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-foreground-muted hover:text-foreground"
                                        )}
                                    >
                                        <TableIcon size={14} /> Table
                                    </button>
                                    <button
                                        onClick={() => setViewMode('json')}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                            viewMode === 'json'
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-foreground-muted hover:text-foreground"
                                        )}
                                    >
                                        <FileJson size={14} /> JSON
                                    </button>
                                </div>
                            )}

                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(step2Result, 'step2')} className="h-8 w-8 p-0" title="Copy Result">
                                {copied === 'step2' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                            </Button>
                        </div>
                    )}
                </div>

                <div className={cn(
                    "flex-1 min-h-[150px] overflow-auto rounded bg-surface border border-border",
                    viewMode === 'json' ? "p-4 font-mono text-sm whitespace-pre-wrap" : "p-0",
                    isValidJson && viewMode === 'json' ? 'text-success' : 'text-foreground'
                )}>
                    {isLoading && currentStep === 2 ? (
                        <div className="p-4 animate-pulse flex space-x-4">
                            <div className="flex-1 space-y-4 py-1">
                                <div className="h-4 bg-surface-hover rounded w-3/4"></div>
                                <div className="h-4 bg-surface-hover rounded"></div>
                                <div className="h-4 bg-surface-hover rounded w-5/6"></div>
                            </div>
                        </div>
                    ) : (
                        step2Result ? (
                            isValidJson ? (
                                viewMode === 'table' ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-foreground-muted uppercase bg-surface-hover border-b border-border">
                                                <tr>
                                                    <th className="px-6 py-3 font-semibold w-1/3">Field</th>
                                                    <th className="px-6 py-3 font-semibold">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {Object.entries(parsedJson).map(([key, value]) => (
                                                    <tr key={key} className="bg-surface hover:bg-surface-hover transition-colors">
                                                        <td className="px-6 py-4 font-medium text-primary font-mono whitespace-nowrap align-top">
                                                            {key}
                                                        </td>
                                                        <td className="px-6 py-4 text-foreground whitespace-pre-wrap break-words align-top">
                                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <pre className="text-xs">{JSON.stringify(parsedJson, null, 2)}</pre>
                                )
                            ) : (
                                <div className="p-4">
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
                                </div>
                            )
                        ) : (isLoading && currentStep < 2 ? <div className="p-4">Pending Step 1...</div> : <div className="p-4">No result yet</div>)
                    )}
                </div>
            </Card>

            {/* Comparison Section (Full Width) */}
            {gbifData && step2Result && isValidJson && (
                <Card className="p-6 bg-surface shadow-lg">
                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-border">
                        <ArrowRight className="text-primary" size={20} />
                        <h3 className="text-lg font-bold text-foreground">Detailed Comparison: AI vs. GBIF</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-border">
                                    <th className="pb-3 font-semibold text-foreground-muted w-1/4">Darwin Core Term</th>
                                    <th className="pb-3 font-semibold text-primary w-3/8 text-center bg-primary/5 rounded-t-lg">AI Extracted</th>
                                    <th className="pb-3 font-semibold text-success w-3/8 text-center bg-success/5 rounded-t-lg">GBIF Official</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(() => {
                                    // 1. Define Core DWC Terms we always want to see first if they exist
                                    const CORE_TERMS = [
                                        'dwc:scientificName', 'dwc:eventDate', 'dwc:recordedBy',
                                        'dwc:locality', 'dwc:country', 'dwc:catalogNumber',
                                        'dwc:institutionCode', 'dwc:collectionCode'
                                    ];

                                    // 2. Identify all keys from AI
                                    const aiKeys = Object.keys(parsedJson).map(k => k.startsWith('dwc:') ? k : `dwc:${k}`);

                                    // 3. Identify relevant keys from GBIF (exclude internal stuff)
                                    const IGNORE_GBIF = [
                                        'key', 'media', 'extensions', 'identifiers', 'allLines', 'verbatim',
                                        'networkKeys', 'datasetKey', 'publishingOrgKey', 'installationKey',
                                        'protocol', 'lastCrawled', 'lastParsed', 'crawlId', 'issues',
                                        'modified', 'lastInterpreted', 'references', 'license', 'facts', 'relations'
                                    ];
                                    const gbifKeys = Object.keys(gbifData)
                                        .filter(k => !IGNORE_GBIF.includes(k) && typeof gbifData[k] !== 'object')
                                        .map(k => k.startsWith('dwc:') ? k : `dwc:${k}`);

                                    // 4. Create unique set of all keys
                                    const allKeys = Array.from(new Set([...CORE_TERMS, ...aiKeys, ...gbifKeys]));

                                    // 5. Divide into Match, Mismatch, and Unique
                                    return allKeys.map(fullKey => {
                                        const shortKey = fullKey.replace('dwc:', '');

                                        // Try to find value in AI (check both prefixed and non-prefixed)
                                        const aiVal = parsedJson[fullKey] !== undefined ? parsedJson[fullKey] : (parsedJson[shortKey] !== undefined ? parsedJson[shortKey] : undefined);

                                        // Try to find value in GBIF
                                        const gbifVal = gbifData[fullKey] !== undefined ? gbifData[fullKey] : (gbifData[shortKey] !== undefined ? gbifData[shortKey] : undefined);

                                        if (aiVal === undefined && gbifVal === undefined) return null;

                                        const isMatch = aiVal?.toString().toLowerCase() === gbifVal?.toString().toLowerCase();
                                        const isCore = CORE_TERMS.includes(fullKey);

                                        return (
                                            <tr key={fullKey} className={cn(
                                                "group transition-colors",
                                                isCore ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-surface-hover"
                                            )}>
                                                <td className="py-3 px-2 font-mono text-xs text-foreground-muted group-hover:text-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        {isCore && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                                        {fullKey}
                                                    </div>
                                                </td>
                                                <td className={cn(
                                                    "py-3 px-4 align-top text-center border-x border-border/50",
                                                    aiVal === undefined ? "text-foreground-muted/30 italic" :
                                                        (!isMatch && gbifVal !== undefined ? "text-primary font-bold bg-primary/10" : "text-foreground")
                                                )}>
                                                    {aiVal !== undefined ? String(aiVal) : 'not found'}
                                                </td>
                                                <td className={cn(
                                                    "py-3 px-4 align-top text-center",
                                                    gbifVal === undefined ? "text-foreground-muted/30 italic" :
                                                        (!isMatch && aiVal !== undefined ? "text-success font-bold bg-success/10" : "text-foreground")
                                                )}>
                                                    {gbifVal !== undefined ? String(gbifVal) : 'not recorded'}
                                                </td>
                                            </tr>
                                        );
                                    }).filter(Boolean);
                                })()}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 p-3 bg-surface-hover rounded-lg border border-border text-[11px] text-foreground-muted flex gap-4">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /> Core Term</div>
                        <div className="flex items-center gap-1"><span className="p-0.5 bg-primary/10 text-primary font-bold rounded">Bold</span> Mismatch</div>
                        <div className="flex items-center gap-1"><span className="italic opacity-30">Italic</span> Missing in Source</div>
                    </div>
                </Card>
            )}
        </div>
    );
}
