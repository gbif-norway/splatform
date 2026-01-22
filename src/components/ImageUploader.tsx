import React, { useState, useEffect } from 'react';
import { Card } from './ui-misc';
import { Button } from './ui-elements';
import { Upload, RotateCw, X } from 'lucide-react';
import { processImage } from '../utils/image';

interface ImageUploaderProps {
    onImageReady: (base64: string) => void;
    className?: string;
    currentImage?: string; // If we want to support controlled state fully
}

export function ImageUploader({ onImageReady, className }: ImageUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [rotation, setRotation] = useState(0);
    const [preview, setPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

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

    const handleRotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const handleClear = () => {
        setFile(null);
        setPreview(null);
        setRotation(0);
        onImageReady('');
    };

    return (
        <Card
            className={`p-6 flex flex-col items-center justify-center border-dashed border-2 min-h-[300px] transition-colors ${isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 bg-slate-900/40'
                } ${className}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {!preview ? (
                <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full p-10 hover:bg-slate-800/50 transition-colors rounded-xl group text-center">
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
                <div className="relative w-full flex flex-col items-center">
                    <div className="relative max-h-[500px] overflow-hidden rounded-lg shadow-2xl border border-slate-700/50">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <img
                            src={preview}
                            alt="Preview"
                            className={`max-w-full max-h-[500px] object-contain transition-opacity duration-200 ${isProcessing ? 'opacity-50 blur-sm' : 'opacity-100'}`}
                        />
                        {isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 mt-4">
                        <Button variant="secondary" onClick={handleRotate} title="Rotate 90°">
                            <RotateCw size={18} className="mr-2" /> Rotate
                        </Button>
                        <Button variant="danger" onClick={handleClear} title="Remove Image">
                            <X size={18} className="mr-2" /> Remove
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
