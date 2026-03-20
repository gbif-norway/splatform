import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui-elements';
import { Card } from './ui-misc';
import { Trash2, Play, CheckCircle, XCircle, Download, RefreshCw, Clock, DollarSign, Loader, Activity, Bug } from 'lucide-react';
import { GBIFService } from '../services/gbif';
import { LLMService } from '../services/llm';
import { BarcodeService } from '../services/barcode';
import { processImage } from '../utils/image';
import { cn } from '../utils/cn';

import { StorageService } from '../services/storage';
import { robustJSONParse, type JSONParseStatus } from '../utils/json';
import { pLimit, retryWithBackoff, processInChunks } from '../utils/async';
import { PricingService } from '../services/llm/pricing';

import { PriceMappingModal } from './PriceMappingModal';
import { TableVirtuoso } from 'react-virtuoso';
import { tableToCsvBlob, tableToXlsxBlob } from '../utils/batchExport';
import { normalizeUnknownError, serializeForErrorReport } from '../utils/errorDetail';
import type { ErrorContext } from './ErrorDisplay';

export interface BatchErrorReport {
    message: string;
    stack?: string;
    name?: string;
    provider: string;
    model: string;
    stage: string;
    prompt: string;
    rawError: unknown;
    gbifData?: unknown;
    originalInput: string;
    imageUrl?: string;
}

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
    /** Serializable details for the same error modal as single-file mode */
    errorReport?: BatchErrorReport;
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
    onShowErrorDetail?: (payload: { error: Error; context: ErrorContext }) => void;
}

function defaultModel(provider: string, model: string) {
    return model || (provider === 'openai' ? 'gpt-4o' : provider === 'gemini' ? 'gemini-1.5-flash' : provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'grok-vision-beta');
}

export function BatchProcessor({
    settings,
    prompt1, provider1, model1, temp1,
    prompt2, provider2, model2, temp2,
    onShowErrorDetail
}: BatchProcessorProps) {
    const [input, setInput] = useState('');

    // State is now O(1) Dictionary + Ordered Array
    const [itemsMap, setItemsMap] = useState<Record<string, BatchItem>>({});
    const [itemIds, setItemIds] = useState<string[]>([]);

    const [isLoaded, setIsLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const stopRef = useRef(false);

    const [concurrency, setConcurrency] = useState(3);
    const [mappingModelId, setMappingModelId] = useState<string | null>(null);

    // Initialize pricing service and load session from IndexedDB
    useEffect(() => {
        PricingService.initialize().catch(err => console.error("Failed to init pricing:", err));

        StorageService.getBatchSession().then(saved => {
            if (saved && saved.length > 0) {
                const initialMap: Record<string, BatchItem> = {};
                const initialIds: string[] = [];
                saved.forEach((i: BatchItem) => {
                    initialMap[i.id] = {
                        ...i,
                        status: i.status === 'processing' ? 'pending' : i.status,
                        step: i.status === 'processing' ? 'resolving' : i.step
                    };
                    initialIds.push(i.id);
                });
                setItemsMap(initialMap);
                setItemIds(initialIds);
            }
            setIsLoaded(true);
        });
    }, []);

    // Derived Stats
    const total = itemIds.length;
    let success = 0;
    let failed = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalEstCost = 0;
    let totalCompletedTimeMs = 0;

    itemIds.forEach(id => {
        const item = itemsMap[id];
        if (item.status === 'completed') {
            success++;
            totalCompletedTimeMs += (item.timings?.totalDuration || 0);
        }
        if (item.status === 'failed') failed++;
        totalInputTokens += (item.usage?.totalInput || 0);
        totalOutputTokens += (item.usage?.totalOutput || 0);
        totalEstCost += (item.usage?.estimatedCost || 0);
    });

    // Auto-save logic (debounced) using indexedDB
    useEffect(() => {
        if (!isLoaded) return;
        const timer = setTimeout(() => {
            if (itemIds.length > 0) {
                // To avoid deep clone freezing we structure it back into array
                const itemsToSave = itemIds.map(id => itemsMap[id]);
                StorageService.saveBatchSession(itemsToSave);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [itemsMap, itemIds, isLoaded]);

    const parseInputToItems = (text: string): { map: Record<string, BatchItem>, ids: string[] } => {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const map: Record<string, BatchItem> = {};
        const ids: string[] = [];

        lines.forEach(line => {
            const id = crypto.randomUUID();
            map[id] = {
                id,
                originalInput: line.trim(),
                status: 'pending',
                step: 'resolving'
            };
            ids.push(id);
        });

        return { map, ids };
    };

    const handleParse = () => {
        const { map, ids } = parseInputToItems(input);
        setItemsMap(map);
        setItemIds(ids);
    };

    const handleClearSession = async () => {
        if (confirm("Clear the current batch session? This will remove all items from the list.")) {
            setItemsMap({});
            setItemIds([]);
            setInput('');
            await StorageService.clearBatchSession();
        }
    };


    const processItem = async (item: BatchItem, updateItem: (id: string, updates: Partial<BatchItem>) => void) => {
        if (stopRef.current) return;

        updateItem(item.id, { status: 'processing', error: undefined, errorReport: undefined, step: 'resolving' });

        type FailPhase = 'resolving' | 'scanning' | 'transcribing' | 'standardizing';
        let phase: FailPhase = 'resolving';
        const m1 = defaultModel(provider1, model1);
        const m2 = defaultModel(provider2, model2);

        let imageUrl = item.originalInput;
        let gbifData: any = null;

        try {
            // 1. Resolve Image
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

            const base64Image = await processImage(imageUrl, 0); // 0 rotation

            phase = 'scanning';
            const tScanStart = performance.now();
            updateItem(item.id, { imageUrl: imageUrl, gbifData, step: 'scanning' });

            // 1.5 Scan for Barcodes
            let detectedCodes: string[] = [];
            if (settings.enableBarcodeScanning) {
                try {
                    try {
                        const response = await fetch(imageUrl);
                        const blob = await response.blob();
                        const file = new File([blob], "scan.jpg", { type: blob.type });
                        detectedCodes = await BarcodeService.scanImage(file, base64Image);
                    } catch (fetchErr) {
                        detectedCodes = await BarcodeService.scanImage(base64Image);
                    }
                } catch (scanErr) {
                    console.warn("Barcode scanning failed for item", item.id, scanErr);
                }
            }

            const tScanEnd = performance.now();
            updateItem(item.id, { detectedCodes, step: 'transcribing' });

            // 2. Transcribe
            phase = 'transcribing';
            const tTranscribeStart = performance.now();
            const p1Key = settings[`${provider1}Key`];
            if (!p1Key) throw new Error(`Missing API Key for ${provider1}`);

            const provider1Inst = LLMService.getProvider(provider1);

            const r1 = await retryWithBackoff(() => provider1Inst.generateTranscription(
                p1Key,
                m1,
                base64Image,
                prompt1,
                settings.proxyUrl,
                { temperature: temp1 }
            ), 5, 2000, 2);

            const tTranscribeEnd = performance.now();
            updateItem(item.id, { transcription: r1.text, step: 'standardizing' });

            // 3. Standardize
            phase = 'standardizing';
            const tStandardizeStart = performance.now();
            const p2Key = settings[`${provider2}Key`] || p1Key;
            if (!p2Key && provider1 !== provider2) throw new Error(`Missing API Key for ${provider2}`);

            const provider2Inst = LLMService.getProvider(provider2);

            const r2 = await retryWithBackoff(() => provider2Inst.standardizeText(
                p2Key,
                m2,
                r1.text,
                prompt2,
                settings.proxyUrl,
                { temperature: temp2 }
            ), 5, 2000, 2);

            const tStandardizeEnd = performance.now();

            const { data, status: parseStatus } = robustJSONParse(r2.text);

            const timingStats = {
                resolveDuration: 0,
                scanDuration: tScanEnd - tScanStart,
                transcribeDuration: tTranscribeEnd - tTranscribeStart,
                standardizeDuration: tStandardizeEnd - tStandardizeStart,
                totalDuration: tStandardizeEnd - tScanStart
            };

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

            // Log history asynchronously to prevent micro-blocking
            setTimeout(() => {
                StorageService.addToHistory({
                    id: item.id,
                    timestamp: Date.now(),
                    filename: item.originalInput,
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
            }, 0);

        } catch (e: unknown) {
            console.error(`Item ${item.id} failed:`, e);
            const normalized = normalizeUnknownError(e);

            let errProvider = '(pre-LLM)';
            let errModel = '—';
            let errPrompt = '';
            let stage = 'batch: resolving';

            if (phase === 'transcribing') {
                errProvider = provider1;
                errModel = m1;
                errPrompt = prompt1;
                stage = 'transcription';
            } else if (phase === 'standardizing') {
                errProvider = provider2;
                errModel = m2;
                errPrompt = prompt2;
                stage = 'standardization';
            } else if (phase === 'scanning') {
                stage = 'batch: barcode scan';
            }

            const errorReport: BatchErrorReport = {
                message: normalized.message,
                stack: normalized.stack,
                name: normalized.name,
                provider: errProvider,
                model: errModel,
                stage,
                prompt: errPrompt,
                rawError: serializeForErrorReport(e),
                gbifData: gbifData ?? undefined,
                originalInput: item.originalInput,
                imageUrl,
            };

            updateItem(item.id, {
                status: 'failed',
                error: normalized.message,
                errorReport,
            });
        }
    };

    const handleRunBatch = async () => {
        let currentMap = itemsMap;
        let currentIds = itemIds;

        if (currentIds.length === 0) {
            const { map, ids } = parseInputToItems(input);
            if (ids.length === 0) return;
            currentMap = map;
            currentIds = ids;
            setItemsMap(map);
            setItemIds(ids);
        }

        setIsProcessing(true);
        stopRef.current = false;

        const queueIds = currentIds.filter(id => currentMap[id].status === 'pending' || currentMap[id].status === 'failed');

        // O(1) state updater for React
        const updateItem = (id: string, updates: Partial<BatchItem>) => {
            setItemsMap(prev => ({
                ...prev,
                [id]: { ...prev[id], ...updates }
            }));
        };

        const limit = pLimit(concurrency);
        const promises = queueIds.map(id => limit(() => {
            if (stopRef.current) return Promise.resolve();
            return processItem(currentMap[id], updateItem);
        }));

        await Promise.all(promises);
        setIsProcessing(false);
    };

    const handleRetry = (id: string) => {
        const item = itemsMap[id];
        if (!item) return;

        const updateItem = (itemId: string, updates: Partial<BatchItem>) => {
            setItemsMap(prev => ({
                ...prev,
                [itemId]: { ...prev[itemId], ...updates }
            }));
        };

        processItem(item, updateItem);
    };

    // Asynchronous export (CSV / XLSX) to keep the UI responsive on large batches
    const handleDownload = async (format: 'csv' | 'xlsx') => {
        if (success === 0) return;
        setIsProcessing(true);

        try {
            const allKeys = new Set<string>();
            const itemsList = itemIds.map(id => itemsMap[id]);

            await processInChunks(itemsList, 1000, (item) => {
                if (item.parsedData) {
                    Object.keys(item.parsedData).forEach(k => allKeys.add(k));
                }
            }, 5);

            const sortedKeys = Array.from(allKeys).sort();
            const baseHeaders = ["ID", "Input", "Status", "JSON Status", "Detected Barcodes", "Transcription", "GBIF Specific Name", "Error"];
            const headers = [...baseHeaders, ...sortedKeys];

            const rows = await processInChunks(itemsList, 1000, (item) => {
                const json: any = item.parsedData || {};
                const rowData: string[] = [
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

                return rowData;
            }, 5);

            const stamp = new Date().toISOString();
            const blob =
                format === 'csv'
                    ? tableToCsvBlob(headers, rows)
                    : await tableToXlsxBlob(headers, rows);

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute(
                "download",
                format === 'csv' ? `batch_results_${stamp}.csv` : `batch_results_${stamp}.xlsx`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            console.error(`Failed to generate ${format.toUpperCase()}:`, e);
        } finally {
            setIsProcessing(false);
        }
    };

    const openBatchErrorFromReport = useCallback((report: BatchErrorReport) => {
        if (!onShowErrorDetail) return;
        const err = new Error(report.message);
        if (report.stack) err.stack = report.stack;
        if (report.name) err.name = report.name;
        onShowErrorDetail({
            error: err,
            context: {
                provider: report.provider,
                model: report.model,
                stage: report.stage,
                prompt: report.prompt,
                rawError: report.rawError,
                gbifData: report.gbifData,
                batch: { originalInput: report.originalInput, imageUrl: report.imageUrl },
            },
        });
    }, [onShowErrorDetail]);

    // Virtuoso Table Row Renderer
    const RowContextRenderer = useCallback((_index: number, id: string, context: { itemsMap: Record<string, BatchItem> }) => {
        const item = context.itemsMap[id];
        if (!item) return null;

        return (
            <>
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
                            <div className="flex flex-wrap items-start gap-2 w-full">
                                <span className="text-destructive text-xs whitespace-pre-wrap break-words flex-1 min-w-0">{item.error}</span>
                                {item.errorReport && onShowErrorDetail && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 shrink-0 text-xs"
                                        onClick={() => openBatchErrorFromReport(item.errorReport!)}
                                        title="Full error, copy, and GitHub report"
                                    >
                                        <Bug size={12} className="mr-1" />
                                        Details
                                    </Button>
                                )}
                            </div>
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
                                        {item.usage.estimatedCost === null && (
                                            <button
                                                onClick={() => {
                                                    const m1 = item.usage?.transcription?.model;
                                                    if (m1 && PricingService.calculateCost(m1, 0, 0) === null) setMappingModelId(m1);
                                                    else setMappingModelId(item.usage?.standardization?.model || 'unknown');
                                                }}
                                                className="text-warning hover:underline cursor-pointer"
                                                title="Click to map pricing"
                                            >
                                                Cost?
                                            </button>
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
            </>
        );
    }, [openBatchErrorFromReport, onShowErrorDetail, itemsMap, itemIds]);


    if (!isLoaded) return <div className="flex items-center justify-center p-8"><Loader className="animate-spin mr-2" /> Loading session...</div>;

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
                        <Button variant="ghost" onClick={handleClearSession} disabled={isProcessing || total === 0} title="Clear Session" className="mr-auto text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 size={16} className="mr-2" /> Clear Session
                        </Button>
                        <Button variant="secondary" onClick={handleParse} disabled={isProcessing || !input.trim()}>
                            Reset / Parse
                        </Button>
                        <Button onClick={handleRunBatch} disabled={isProcessing || (total === 0 && !input.trim())}>
                            {isProcessing ? <Loader className="animate-spin mr-2" size={16} /> : <Play className="mr-2" size={16} />}
                            {isProcessing ? 'Processing/Exporting...' : 'Run Batch'}
                        </Button>
                        {isProcessing && (
                            <Button variant="danger" onClick={() => (stopRef.current = true)}>Stop</Button>
                        )}
                    </div>
                </div>
            </Card>

            {total > 0 && (
                <div className="grid grid-cols-3 gap-4">
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
                                In: {totalInputTokens.toLocaleString()} <br />
                                Out: {totalOutputTokens.toLocaleString()}
                            </div>
                        </div>
                        <div className="p-2 bg-info/10 rounded-full text-info"><Clock size={20} /></div>
                    </Card>
                    <Card className="p-4 flex items-center justify-between border-l-4 border-l-success">
                        <div>
                            <div className="text-xs text-foreground-muted uppercase font-bold">Est. Cost</div>
                            <div className="text-2xl font-bold">
                                ${totalEstCost.toFixed(4)}
                            </div>
                        </div>
                        <div className="p-2 bg-success/10 rounded-full text-success"><DollarSign size={20} /></div>
                    </Card>
                    <Card className="p-4 flex items-center justify-between border-l-4 border-l-warning">
                        <div>
                            <div className="text-xs text-foreground-muted uppercase font-bold">Avg Performance</div>
                            <div className="text-sm">
                                {success > 0 ? (
                                    <>
                                        Time: {(totalCompletedTimeMs / success).toFixed(0)} ms<br />
                                        Cost: ${(totalEstCost / success).toFixed(4)}<br />
                                        Per 1k: ${((totalEstCost / success) * 1000).toFixed(2)}
                                    </>
                                ) : (
                                    <span className="text-foreground-muted italic">Pending...</span>
                                )}
                            </div>
                        </div>
                        <div className="p-2 bg-warning/10 rounded-full text-warning"><Activity size={20} /></div>
                    </Card>
                    <div className="flex flex-wrap items-end justify-end gap-2 col-span-3">
                        <Button variant="secondary" onClick={() => handleDownload('csv')} disabled={success === 0 || isProcessing}>
                            {isProcessing ? <Loader className="animate-spin mr-2" size={16} /> : <Download className="mr-2" size={16} />} Download CSV
                        </Button>
                        <Button variant="secondary" onClick={() => handleDownload('xlsx')} disabled={success === 0 || isProcessing}>
                            {isProcessing ? <Loader className="animate-spin mr-2" size={16} /> : <Download className="mr-2" size={16} />} Download Excel (.xlsx)
                        </Button>
                    </div>
                </div>
            )}

            {total > 0 && (
                <div className="w-full h-[600px] border border-border rounded-lg bg-surface overflow-hidden">
                    <TableVirtuoso
                        style={{ height: '100%', width: '100%' }}
                        data={itemIds}
                        context={{ itemsMap }}
                        components={{
                            Table: (props) => <table {...props} className="w-full text-sm text-left" />,
                            TableHead: (props) => <thead {...props} className="bg-background text-foreground-muted font-medium text-xs uppercase tracking-wider sticky top-0 z-10" />,
                            TableRow: (props) => <tr {...props} className="hover:bg-surface-hover/50 divide-y divide-border border-b border-border" />
                        }}
                        fixedHeaderContent={() => (
                            <tr>
                                <th className="px-4 py-3 border-b border-border bg-background">Input / ID</th>
                                <th className="px-4 py-3 border-b border-border bg-background">Status</th>
                                <th className="px-4 py-3 border-b border-border bg-background">Result Preview</th>
                                <th className="px-4 py-3 border-b border-border bg-background text-right">Actions</th>
                            </tr>
                        )}
                        itemContent={RowContextRenderer}
                    />
                </div>
            )}

            {mappingModelId && (
                <PriceMappingModal
                    unknownModelId={mappingModelId}
                    onSave={() => {
                        setMappingModelId(null);
                        setItemsMap(prev => {
                            const newMap = { ...prev };
                            Object.keys(newMap).forEach(id => {
                                const i = newMap[id];
                                if (i.status === 'completed' && i.usage) {
                                    const m1 = i.usage.transcription?.model;
                                    const m2 = i.usage.standardization?.model;
                                    const tCost = i.usage.transcription ? PricingService.calculateCost(m1!, i.usage.transcription.input, i.usage.transcription.output) : null;
                                    const sCost = i.usage.standardization ? PricingService.calculateCost(m2!, i.usage.standardization.input, i.usage.standardization.output) : null;
                                    const total = (tCost !== null && sCost !== null) ? tCost + sCost : null;

                                    newMap[id] = {
                                        ...i,
                                        usage: { ...i.usage, estimatedCost: total }
                                    };
                                }
                            });
                            return newMap;
                        });
                    }}
                    onClose={() => setMappingModelId(null)}
                />
            )}
        </div>
    );
}
