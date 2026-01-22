import React, { useState, useEffect } from 'react';
import { Card } from './ui-misc';
import { Button } from './ui-elements';
import { Upload, RotateCw, X, ZoomIn, ZoomOut, Maximize2, Link, Globe } from 'lucide-react';
import { processImage } from '../utils/image';
import { GBIFService } from '../services/gbif';
import type { GBIFOccurrence } from '../services/gbif';

interface ImageUploaderProps {
    onImageReady: (base64: string) => void;
    onGBIFData: (data: GBIFOccurrence | null) => void;
    className?: string;
    currentImage?: string; // If we want to support controlled state fully
}

export function ImageUploader({ onImageReady, onGBIFData, className }: ImageUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [rotation, setRotation] = useState(0);
    const [preview, setPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // GBIF State
    const [mode, setMode] = useState<'upload' | 'gbif'>('upload');
    const [gbifUrl, setGbifUrl] = useState('');
    const [fetchingGbif, setFetchingGbif] = useState(false);
    const [gbifError, setGbifError] = useState<string | null>(null);

    // Zoom & Pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });

    // Handle Drag & Drop
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                setFile(file);
                setRotation(0);
            }
        }
    };

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setRotation(0);
        }
    };

    // Re-process image when file or rotation changes
    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }

        const process = async () => {
            setIsProcessing(true);
            try {
                const base64 = await processImage(file, rotation);
                setPreview(base64);
                onImageReady(base64);
            } catch (e) {
                console.error("Image processing failed", e);
            } finally {
                setIsProcessing(false);
            }
        };

        const debounce = setTimeout(process, 100); // Debounce rotation
        return () => clearTimeout(debounce);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, rotation]);

    // Zoom & Pan handlers
    const handleWheel = (e: React.WheelEvent) => {
        if (preview) {
            // Simple scroll zoom
            const delta = -Math.sign(e.deltaY) * 0.1;
            setZoom(z => Math.max(1, Math.min(5, z + delta)));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) {
            setIsPanning(true);
            setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            e.preventDefault();
            setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
        }
    };

    const handleMouseUp = () => setIsPanning(false);

    // Reset zoom when image changes
    useEffect(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, [preview]);

    const handleRotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const handleClear = () => {
        setFile(null);
        setPreview(null);
        setRotation(0);
        setGbifUrl('');
        setGbifError(null);
        onImageReady('');
        onGBIFData(null);
    };

    const handleLoadGbif = async () => {
        const id = GBIFService.parseOccurrenceId(gbifUrl);
        if (!id) {
            setGbifError('Invalid GBIF URL or ID. Please provide a full URL or numeric ID.');
            return;
        }

        setFetchingGbif(true);
        setGbifError(null);
        try {
            const occurrence = await GBIFService.fetchOccurrence(id);
            const imageUrl = GBIFService.extractImage(occurrence);

            if (!imageUrl) {
                setGbifError('No image found for this specimen in GBIF.');
                setFetchingGbif(false);
                return;
            }

            // Convert image to base64 for local use (prevent CORS issues on Canvas if needed, though img tag is usually fine)
            // But since handleRun expects base64, we should probably fetch it
            // Convert image to base64 and process it (resize/compress)
            const base64 = await processImage(imageUrl, 0);
            setPreview(base64);
            onImageReady(base64);
            onGBIFData(occurrence);
            setFetchingGbif(false);

        } catch (e: any) {
            setGbifError(e.message || 'Failed to fetch specimen from GBIF.');
            setFetchingGbif(false);
        }
    };

    return (
        <Card
            className={`p-6 flex flex-col items-center justify-center border-dashed border-2 min-h-[500px] transition-colors ${isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 bg-slate-900/40'
                } ${className}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {!preview ? (
                <div className="w-full h-full flex flex-col">
                    <div className="flex gap-2 mb-6 justify-center">
                        <Button
                            variant={mode === 'upload' ? 'primary' : 'secondary'}
                            onClick={() => setMode('upload')}
                            size="sm"
                        >
                            <Upload size={16} className="mr-2" /> Upload File
                        </Button>
                        <Button
                            variant={mode === 'gbif' ? 'primary' : 'secondary'}
                            onClick={() => setMode('gbif')}
                            size="sm"
                        >
                            <Globe size={16} className="mr-2" /> GBIF Link
                        </Button>
                    </div>

                    {mode === 'upload' ? (
                        <label className="flex-1 flex flex-col items-center justify-center cursor-pointer w-full p-10 hover:bg-slate-800/50 transition-colors rounded-xl group text-center border-2 border-dashed border-slate-700">
                            <div className="bg-blue-500/10 p-4 rounded-full mb-4 group-hover:bg-blue-500/20 transition-colors">
                                <Upload size={32} className="text-blue-500" />
                            </div>
                            <p className="text-lg font-medium text-slate-200">Click or drag image to upload</p>
                            <p className="text-sm text-slate-500 mt-2">Supports JPG, PNG, WEBP</p>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </label>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center w-full p-10 space-y-4">
                            <div className="bg-emerald-500/10 p-4 rounded-full">
                                <Link size={32} className="text-emerald-500" />
                            </div>
                            <div className="w-full max-w-md space-y-2">
                                <p className="text-lg font-medium text-slate-200 text-center">Load Specimen from GBIF</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Paste GBIF occurrence URL or ID..."
                                        className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                        value={gbifUrl}
                                        onChange={(e) => setGbifUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleLoadGbif()}
                                    />
                                    <Button
                                        onClick={handleLoadGbif}
                                        disabled={fetchingGbif || !gbifUrl}
                                        size="sm"
                                    >
                                        {fetchingGbif ? 'Loading...' : 'Load'}
                                    </Button>
                                </div>
                                {gbifError && <p className="text-xs text-red-400 mt-2">{gbifError}</p>}
                                <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest mt-4">Example: https://www.gbif.org/occurrence/4052452374</p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="relative w-full h-full flex flex-col">
                    {/* Image Viewport */}
                    <div
                        className="relative w-full flex-1 overflow-hidden rounded-lg shadow-2xl border border-slate-700/50 bg-black/50 cursor-grab active:cursor-grabbing min-h-[400px]"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <div
                            className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
                            style={{
                                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`
                            }}
                        >
                            <img
                                src={preview}
                                alt="Preview"
                                className={`max-w-full max-h-full object-contain ${isProcessing ? 'opacity-50 blur-sm' : 'opacity-100'}`}
                                draggable={false}
                            />
                        </div>

                        {/* Loading Overlay */}
                        {isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}

                        {/* Zoom Controls Overlay */}
                        <div className="absolute bottom-4 right-4 flex gap-1 bg-slate-950/80 backdrop-blur rounded-lg p-1 border border-white/10">
                            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="h-8 w-8 p-0 hover:bg-white/10">
                                <ZoomOut size={16} />
                            </Button>
                            <span className="flex items-center justify-center w-12 text-xs font-mono">{Math.round(zoom * 100)}%</span>
                            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(5, z + 0.5))} className="h-8 w-8 p-0 hover:bg-white/10">
                                <ZoomIn size={16} />
                            </Button>
                            <div className="w-px bg-white/10 mx-1"></div>
                            <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="h-8 w-8 p-0 hover:bg-white/10" title="Reset View">
                                <Maximize2 size={16} />
                            </Button>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex justify-between items-center mt-4 p-2 bg-slate-900/50 rounded-lg border border-slate-800">
                        <div className="text-xs text-slate-500 font-mono pl-2">
                            {file?.name} ({Math.round((file?.size || 0) / 1024)}KB)
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={handleRotate} title="Rotate 90°">
                                <RotateCw size={16} className="mr-2" /> Rotate
                            </Button>
                            <Button variant="danger" size="sm" onClick={handleClear} title="Remove Image">
                                <X size={16} className="mr-2" /> Remove
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
