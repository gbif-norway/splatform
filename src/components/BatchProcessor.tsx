
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui-elements';
import { Card } from './ui-misc';
import { Trash2, Play, CheckCircle, XCircle, Download, RefreshCw, Clock, DollarSign, Loader } from 'lucide-react';
import { GBIFService } from '../services/gbif';
import { LLMService } from '../services/llm';
import { BarcodeService } from '../services/barcode';
import { processImage } from '../utils/image';
import { cn } from '../utils/cn';

import { StorageService } from '../services/storage';
import { robustJSONParse, type JSONParseStatus } from '../utils/json';
import { pLimit, retryWithBackoff } from '../utils/async';
import { PricingService } from '../services/llm/pricing';

interface BatchItem {
    id: string;
    originalInput: string;
    imageUrl?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    step: 'resolving' | 'scanning' | 'transcribing' | 'standardizing' | 'done';
    transcription?: string;
    standardization?: string; // Raw output
    parsedData?: any; // The actual JSON object
    parsingStatus?: JSONParseStatus;
    detectedCodes?: string[];
    error?: string;
    gbifData?: any;
    timings?: {
        resolveDuration?: number;
        scanDuration?: number;
        transcribeDuration?: number;
        standardizeDuration?: number;
        totalDuration?: number;
    };
    usage?: {
        transcription?: { input: number, output: number, model: string };
        standardization?: { input: number, output: number, model: string };
        totalInput: number;
        totalOutput: number;
        estimatedCost?: number | null;
    };
}

interface BatchProcessorProps {
    settings: any;
    prompt1: string;
    provider1: string;
    model1: string;
    temp1: number;
    prompt2: string;
    provider2: string;
    model2: string;
    temp2: number;
}

export function BatchProcessor({
    settings,
    prompt1, provider1, model1, temp1,
    prompt2, provider2, model2, temp2
}: BatchProcessorProps) {
    const [input, setInput] = useState('');

    // Initialize items from storage directly
    const [items, setItems] = useState<BatchItem[]>(() => {
        const saved = StorageService.getBatchSession();
        if (saved && saved.length > 0) {
            return saved.map((i: BatchItem) => ({
                ...i,
                status: i.status === 'processing' ? 'pending' : i.status,
                step: i.status === 'processing' ? 'resolving' : i.step
            }));
        }
        return [];
    });

    const [isProcessing, setIsProcessing] = useState(false);
    const stopRef = useRef(false);
    const [concurrency, setConcurrency] = useState(3);

    useEffect(() => {
        // Initialize pricing service
        PricingService.initialize().catch(err => console.error("Failed to init pricing:", err));
    }, []);

    // Load saved settings
    useEffect(() => {
        // This useEffect is for loading settings, not for pricing init.
        // The pricing init useEffect is above.
    }, []);

    // Stats
    const total = items.length;
    const success = items.filter(i => i.status === 'completed').length;
    const failed = items.filter(i => i.status === 'failed').length;

    // Persist changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (items.length > 0) {
                StorageService.saveBatchSession(items);
            } else {
                // If empty, we might want to clear, but handleClearSession does explicit clear.
                // If user deletes all text input, items becomes empty on parse?
                // Actually items only changes via handleParse or updateItem.
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [items]);

    const parseInputToItems = (text: string): BatchItem[] => {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        return lines.map(line => ({
            id: crypto.randomUUID(),
            originalInput: line.trim(),
            status: 'pending',
            step: 'resolving'
        }));
    };

    const handleParse = () => {
        const newItems = parseInputToItems(input);
        setItems(newItems);
    };

    const handleClearSession = () => {
        if (confirm("Clear the current batch session? This will remove all items from the list.")) {
            setItems([]);
            setInput('');
            StorageService.clearBatchSession();
        }
    };


    const processItem = async (item: BatchItem, updateItem: (id: string, updates: Partial<BatchItem>) => void) => {
        if (stopRef.current) return;

        updateItem(item.id, { status: 'processing', error: undefined, step: 'resolving' });

        try {
            // 1. Resolve Image
            let imageUrl = item.originalInput;
            let gbifData = null;

            // Check if it's a GBIF ID or URL
            const gbifId = GBIFService.parseOccurrenceId(item.originalInput);
            if (gbifId) {
                try {
                    const occurrence = await GBIFService.fetchOccurrence(gbifId);
                    const extractedImg = GBIFService.extractImage(occurrence);
                    if (!extractedImg) throw new Error("No image found in GBIF occurrence");
                    imageUrl = extractedImg;
                    gbifData = occurrence;
                } catch (e: any) {
                    throw new Error(`GBIF Resolution Failed: ${e.message} `);
                }
            }

            // Process Image (standardize/resize/base64)
            const base64Image = await processImage(imageUrl, 0); // 0 rotation

            const tScanStart = performance.now();
            updateItem(item.id, { imageUrl: imageUrl, gbifData, step: 'scanning' });

            // 1.5 Scan for Barcodes
            let detectedCodes: string[] = [];
            if (settings.enableBarcodeScanning) {
                try {
                    // For batch items, we usually have a URL.
                    // To get best results, we should try to fetch the blob to scan it directly, rather than using the potentially resized base64Image
                    // However, we already validated/processed it. 
                    // processImage returns a resized base64. 

                    // If we want high-res scanning, we should fetch the blob.
                    // But we don't want to double-fetch if we can avoid it. 
                    // processImage (utils) handles the fetch internally.

                    // Optimization: Let's use the base64Image we have (from processImage).
                    // If the user says "it didn't find them", it might be resolution.
                    // Let's rely on processImage's max width (2048) which should be enough for most barcodes.
                    // IF we want to be super safe, we fetch blob here.

                    // Let's try to fetch blob for scanning specifically to ensure quality.
                    // This adds a network request but ensures we scan the original.
                    try {
                        const response = await fetch(imageUrl);
                        const blob = await response.blob();
                        const file = new File([blob], "scan.jpg", { type: blob.type });
                        // Pass base64Image as fallback
                        detectedCodes = await BarcodeService.scanImage(file, base64Image);
                    } catch (fetchErr) {
                        // Fallback to base64 if fetch fails (cors?)
                        detectedCodes = await BarcodeService.scanImage(base64Image);
                    }
                } catch (scanErr) {
                    console.warn("Barcode scanning failed for item", item.id, scanErr);
                }
            }

            const tScanEnd = performance.now();
            updateItem(item.id, { detectedCodes, step: 'transcribing' });

            // 2. Transcribe (step 1)
            const tTranscribeStart = performance.now();
            const p1Key = settings[`${provider1}Key`];
            if (!p1Key) throw new Error(`Missing API Key for ${provider1}`);

            const provider1Inst = LLMService.getProvider(provider1);
            const m1 = model1 || (provider1 === 'openai' ? 'gpt-4o' : provider1 === 'gemini' ? 'gemini-1.5-flash' : provider1 === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'grok-vision-beta');

            const r1 = await provider1Inst.generateTranscription(
                p1Key,
                m1,
                base64Image,
                prompt1,
                settings.proxyUrl,
                { temperature: temp1 }
            );

            const tTranscribeEnd = performance.now();
            updateItem(item.id, { transcription: r1.text, step: 'standardizing' });

            // 3. Standardize (step 2)
            const tStandardizeStart = performance.now();
            const p2Key = settings[`${provider2}Key`] || p1Key;
            if (!p2Key && provider1 !== provider2) throw new Error(`Missing API Key for ${provider2}`);

            const provider2Inst = LLMService.getProvider(provider2);
            const m2 = model2 || (provider2 === 'openai' ? 'gpt-4o' : provider2 === 'gemini' ? 'gemini-1.5-flash' : provider2 === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'grok-vision-beta');

            const r2 = await provider2Inst.standardizeText(
                p2Key,
                m2,
                r1.text,
                prompt2,
                settings.proxyUrl,
                { temperature: temp2 }
            );

            const tStandardizeEnd = performance.now();

            // Parse JSON immediately
            const { data, status: parseStatus } = robustJSONParse(r2.text);

            // Calculate Stats
            const timingStats = {
                resolveDuration: 0, // Not strictly tracked yet but could be
                scanDuration: tScanEnd - tScanStart,
                transcribeDuration: tTranscribeEnd - tTranscribeStart,
                standardizeDuration: tStandardizeEnd - tStandardizeStart,
                totalDuration: tStandardizeEnd - tScanStart // Rough total
            };

            // Calculate Costs
            const transcriptionCost = r1.usage ? PricingService.calculateCost(m1, r1.usage.inputTokens, r1.usage.outputTokens) : null;
            const standardizationCost = r2.usage ? PricingService.calculateCost(m2, r2.usage.inputTokens, r2.usage.outputTokens) : null;
            const totalCost = (transcriptionCost !== null && standardizationCost !== null) ? transcriptionCost + standardizationCost : null;

            const usageStats = {
                transcription: r1.usage ? { input: r1.usage.inputTokens, output: r1.usage.outputTokens, model: m1 } : undefined,
                standardization: r2.usage ? { input: r2.usage.inputTokens, output: r2.usage.outputTokens, model: m2 } : undefined,
                totalInput: (r1.usage?.inputTokens || 0) + (r2.usage?.inputTokens || 0),
                totalOutput: (r1.usage?.outputTokens || 0) + (r2.usage?.outputTokens || 0),
                estimatedCost: totalCost
            };

            updateItem(item.id, {
                standardization: r2.text,
                parsedData: data,
                parsingStatus: parseStatus,
                status: 'completed',
                step: 'done',
                timings: timingStats,
                usage: usageStats
            });

            // Save to History
            StorageService.addToHistory({
                id: item.id,
                timestamp: Date.now(),
                filename: item.originalInput, // Use input as filename
                prompt1,
                result1: r1.text,
                prompt2,
                result2: r2.text,
                provider1: `${provider1}/${m1}`,
                temp1,
                provider2: `${provider2}/${m2}`,
                temp2,
                mode: 'batch',
                detectedCodes
            });

        } catch (e: any) {
            console.error(`Item ${item.id} failed:`, e);
            updateItem(item.id, { status: 'failed', error: e.message || String(e) });
        }
    };

    const handleRunBatch = async () => {
        let batchItems = items;
        if (batchItems.length === 0) {
            batchItems = parseInputToItems(input);
            if (batchItems.length === 0) return;
            setItems(batchItems);
        }

        setIsProcessing(true);
        stopRef.current = false;

        const queue = batchItems.filter(i => i.status === 'pending' || i.status === 'failed');

        const updateItem = (id: string, updates: Partial<BatchItem>) => {
            setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
        };

        const limit = pLimit(concurrency);
        const promises = queue.map(item => limit(() =>
            retryWithBackoff(async () => {
                if (stopRef.current) return;
                await processItem(item, updateItem);
            })
        ));

        await Promise.all(promises);

        setIsProcessing(false);
    };

    const handleRetry = (id: string) => {
        const itemIndex = items.findIndex(i => i.id === id);
        if (itemIndex === -1) return;

        const item = items[itemIndex];
        const updateItem = (id: string, updates: Partial<BatchItem>) => {
            setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
        };

        processItem(item, updateItem);
    };

    const handleDownload = () => {

        const allKeys = new Set<string>();
        items.forEach(item => {
            if (item.parsedData) {
                Object.keys(item.parsedData).forEach(k => allKeys.add(k));
            }
        });

        const sortedKeys = Array.from(allKeys).sort();

        const baseHeaders = ["ID", "Input", "Status", "JSON Status", "Detected Barcodes", "Transcription", "GBIF Specific Name", "Error"];
        const headers = [...baseHeaders, ...sortedKeys];

        const rows = items.map(item => {
            const json: any = item.parsedData || {};

            const rowData = [
                item.id,
                item.originalInput,
                item.status,
                item.parsingStatus || "",
                (item.detectedCodes || []).join("; "),
                item.transcription || "",
                item.gbifData?.scientificName || "",
                item.error || ""
            ];

            sortedKeys.forEach(key => {
                const val = json[key];
                rowData.push(val !== undefined && val !== null ? String(val) : "");
            });

            return rowData.map(val => `"${String(val).replace(/"/g, '""')}"`);
        });

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `batch_results_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <Card className="p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Batch Input</h3>
                    <div className="text-xs text-foreground-muted">Supported: Direct Image URLs, GBIF Occurrence URLs</div>
                </div>
                <textarea
                    className="w-full h-32 bg-background border border-border rounded-lg p-3 text-sm font-mono"
                    placeholder="https://example.com/image1.jpg&#10;https://www.gbif.org/occurrence/123456"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={isProcessing}
                />
                <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-2 text-sm text-foreground-muted">
                        <span>Concurrency: {concurrency}</span>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={concurrency}
                            onChange={(e) => setConcurrency(parseInt(e.target.value))}
                            className="w-24 h-2 bg-border rounded-lg appearance-none cursor-pointer"
                            disabled={isProcessing}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={handleClearSession} disabled={isProcessing || items.length === 0} title="Clear Session" className="mr-auto text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 size={16} className="mr-2" /> Clear Session
                        </Button>
                        <Button variant="secondary" onClick={handleParse} disabled={isProcessing || !input.trim()}>
                            Reset / Parse
                        </Button>
                        <Button onClick={handleRunBatch} disabled={isProcessing || (!items.length && !input.trim())}>
                            {isProcessing ? <Loader className="animate-spin mr-2" size={16} /> : <Play className="mr-2" size={16} />}
                            {isProcessing ? 'Processing...' : 'Run Batch'}
                        </Button>
                        {isProcessing && (
                            <Button variant="danger" onClick={() => (stopRef.current = true)}>Stop</Button>
                        )}
                    </div>
                </div>
            </Card>

            {items.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                    <Card className="p-4 flex items-center justify-between border-l-4 border-l-primary">
                        <div>
                            <div className="text-xs text-foreground-muted uppercase font-bold">Total</div>
                            <div className="text-2xl font-bold">{total}</div>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-full text-primary"><Clock size={20} /></div>
                    </Card>
                    <Card className="p-4 flex items-center justify-between border-l-4 border-l-success">
                        <div>
                            <div className="text-xs text-foreground-muted uppercase font-bold">Success</div>
                            <div className="text-2xl font-bold">{success}</div>
                        </div>
                        <div className="p-2 bg-success/10 rounded-full text-success"><CheckCircle size={20} /></div>
                    </Card>
                    <Card className="p-4 flex items-center justify-between border-l-4 border-l-destructive">
                        <div>
                            <div className="text-xs text-foreground-muted uppercase font-bold">Failed</div>
                            <div className="text-2xl font-bold">{failed}</div>
                        </div>
                        <div className="p-2 bg-destructive/10 rounded-full text-destructive"><XCircle size={20} /></div>
                    </Card>
                    <Card className="p-4 flex items-center justify-between border-l-4 border-l-info">
                        <div>
                            <div className="text-xs text-foreground-muted uppercase font-bold">Total Tokens</div>
                            <div className="text-sm">
                                In: {items.reduce((acc, i) => acc + (i.usage?.totalInput || 0), 0).toLocaleString()} <br />
                                Out: {items.reduce((acc, i) => acc + (i.usage?.totalOutput || 0), 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="p-2 bg-info/10 rounded-full text-info"><Clock size={20} /></div>
                    </Card>
                    <Card className="p-4 flex items-center justify-between border-l-4 border-l-success">
                        <div>
                            <div className="text-xs text-foreground-muted uppercase font-bold">Est. Cost</div>
                            <div className="text-2xl font-bold">
                                ${items.reduce((acc, i) => acc + (i.usage?.estimatedCost || 0), 0).toFixed(4)}
                            </div>
                        </div>
                        <div className="p-2 bg-success/10 rounded-full text-success"><DollarSign size={20} /></div>
                    </Card>
                    <div className="flex items-end justify-end col-span-3">
                        <Button variant="secondary" onClick={handleDownload} disabled={success === 0}>
                            <Download className="mr-2" size={16} /> Download CSV
                        </Button>
                    </div>
                </div>
            )}

            {items.length > 0 && (
                <div className="flex-1 overflow-auto border border-border rounded-lg bg-surface">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-background text-foreground-muted font-medium text-xs uppercase tracking-wider sticky top-0">
                            <tr>
                                <th className="px-4 py-3 border-b border-border">Input / ID</th>
                                <th className="px-4 py-3 border-b border-border">Status</th>
                                <th className="px-4 py-3 border-b border-border">Result Preview</th>
                                <th className="px-4 py-3 border-b border-border text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-surface-hover/50">
                                    <td className="px-4 py-3 max-w-[200px] truncate" title={item.originalInput}>
                                        {item.originalInput}
                                        {item.imageUrl && item.imageUrl !== item.originalInput && (
                                            <div className="text-xs text-foreground-muted truncate">{item.imageUrl}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                {item.status === 'processing' && <Loader size={14} className="animate-spin text-primary" />}
                                                {item.status === 'completed' && <CheckCircle size={14} className="text-success" />}
                                                {item.status === 'failed' && <XCircle size={14} className="text-destructive" />}
                                                {item.status === 'pending' && <Clock size={14} className="text-foreground-muted" />}
                                                <span className={cn(
                                                    "capitalize",
                                                    item.status === 'failed' ? "text-destructive" :
                                                        item.status === 'completed' ? "text-success" : ""
                                                )}>
                                                    {item.status === 'processing' ? item.step : item.status}
                                                </span>
                                            </div>

                                            {item.parsingStatus && item.status === 'completed' && (
                                                <div className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded w-fit capitalize border",
                                                    item.parsingStatus === 'clean' ? "bg-success/10 text-success border-success/20" :
                                                        item.parsingStatus === 'markdown' ? "bg-info/10 text-info border-info/20" :
                                                            item.parsingStatus === 'fuzzy' ? "bg-warning/10 text-warning border-warning/20" :
                                                                "bg-destructive/10 text-destructive border-destructive/20"
                                                )}>
                                                    JSON: {item.parsingStatus}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 max-w-[300px]">
                                        <div className="flex flex-col gap-1">
                                            {item.detectedCodes && item.detectedCodes.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {item.detectedCodes.map((code, idx) => (
                                                        <span key={idx} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20 font-mono">
                                                            {code}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {item.error ? (
                                                <span className="text-destructive text-xs">{item.error}</span>
                                            ) : (
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="text-xs text-foreground-muted truncate">
                                                        {item.standardization || item.transcription || "-"}
                                                    </div>
                                                    {item.usage && (
                                                        <div className="text-[10px] text-foreground-muted font-mono flex gap-2">
                                                            <span title="Total Duration">⏱ {(item.timings?.totalDuration || 0).toFixed(0)}ms</span>
                                                            <span title="Tokens In/Out">🎟 {item.usage.totalInput}/{item.usage.totalOutput}</span>
                                                            {item.usage.transcription && <span title={`Transcription: ${item.usage.transcription.model}`}>Step 1: {item.usage.transcription.model}</span>}
                                                            {item.usage.standardization && <span title={`Standardization: ${item.usage.standardization.model}`}>Step 2: {item.usage.standardization.model}</span>}
                                                            {item.usage.estimatedCost !== null && item.usage.estimatedCost !== undefined && (
                                                                <span title="Estimated Cost" className="text-success font-bold">
                                                                    ${item.usage.estimatedCost.toFixed(5)}
                                                                </span>
                                                            )}
                                                            {item.usage.estimatedCost === null && (
                                                                <span title="Cost Unknown" className="text-warning">
                                                                    Cost?
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {item.status === 'failed' && (
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRetry(item.id)} title="Retry">
                                                <RefreshCw size={14} />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
