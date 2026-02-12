import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

export const BarcodeService = {
    /**
     * Scans an image (File or URL/Base64) for barcodes and QR codes.
     * Uses a tiling strategy (Full + Grid + Center) to detect multiple codes and small codes.
     */
    scanImage: async (imageFileOrUrl: File | string, fallbackImage?: string): Promise<string[]> => {
        // Configure to scan ALL formats
        const formatsToSupport = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.AZTEC,
        ];

        const html5QrCode = new Html5Qrcode("reader-hidden", { formatsToSupport, verbose: false });

        // Helper: Scan a single file safely
        const scanSingle = async (input: File): Promise<string | null> => {
            try {
                return await html5QrCode.scanFile(input, false);
            } catch (e) {
                return null;
            }
        };

        // Helper: Load File/URL into HTMLImageElement
        const loadImage = (source: File | string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.crossOrigin = "Anonymous"; // Try anonymous for URLs
                if (typeof source === 'string') {
                    img.src = source;
                } else {
                    img.src = URL.createObjectURL(source);
                }
            });
        };

        // Helper: Crop image to a new File
        const cropToBlob = (
            img: HTMLImageElement,
            x: number,
            y: number,
            w: number,
            h: number,
            name: string
        ): Promise<File> => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return Promise.reject("No canvas context");

            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

            return new Promise(resolve => {
                canvas.toBlob(blob => {
                    if (blob) {
                        resolve(new File([blob], name, { type: "image/jpeg" }));
                    } else {
                        resolve(new File([], name)); // Should not happen
                    }
                }, 'image/jpeg', 0.95);
            });
        };

        try {
            const detectedCodes = new Set<string>();

            // 1. Prepare Main Input File
            let mainFile: File;
            if (typeof imageFileOrUrl === 'string') {
                try {
                    const response = await fetch(imageFileOrUrl);
                    const blob = await response.blob();
                    mainFile = new File([blob], "full-scan.jpg", { type: blob.type });
                } catch (e) {
                    console.warn("Failed to fetch image for scan, using fallback if available");
                    if (fallbackImage) {
                        // This path is tricky, better to just return empty or try scanning the string url directly if supported 
                        // but scanFile needs File. 
                        // Let's assume fetching works or we fail.
                        return [];
                    }
                    return [];
                }
            } else {
                mainFile = imageFileOrUrl;
            }

            // PASS 1: Full Image Scan
            // console.log("Pass 1: Full Scan");
            const fullRes = await scanSingle(mainFile);
            if (fullRes) detectedCodes.add(fullRes);

            // PASS 2 & 3: Tiling (for multiple codes and small codes)
            // Even if we found one, we continue because user wants *multiple* codes.

            try {
                const img = await loadImage(mainFile);
                const w = img.width;
                const h = img.height;
                const halfW = Math.floor(w / 2);
                const halfH = Math.floor(h / 2);

                const tiles: Promise<File>[] = [];

                // 2x2 Grid (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
                tiles.push(cropToBlob(img, 0, 0, halfW, halfH, "tile-tl.jpg"));
                tiles.push(cropToBlob(img, halfW, 0, halfW, halfH, "tile-tr.jpg"));
                tiles.push(cropToBlob(img, 0, halfH, halfW, halfH, "tile-bl.jpg"));
                tiles.push(cropToBlob(img, halfW, halfH, halfW, halfH, "tile-br.jpg"));

                // Center Crop (Overlapping edges) - 50% width/height centered
                const centerW = Math.floor(w * 0.5);
                const centerH = Math.floor(h * 0.5);
                const centerX = Math.floor((w - centerW) / 2);
                const centerY = Math.floor((h - centerH) / 2);
                tiles.push(cropToBlob(img, centerX, centerY, centerW, centerH, "tile-center.jpg"));

                const tileFiles = await Promise.all(tiles);

                // Scan tiles sequentially (library is not re-entrant)
                for (const tile of tileFiles) {
                    const tileRes = await scanSingle(tile);
                    if (tileRes) detectedCodes.add(tileRes);
                }

                // Cleanup URL object if we created it
                if (mainFile === imageFileOrUrl) {
                    // nothing
                } else {
                    // if it was passed as string and we fetched it, nothing to revoke from mainFile itself 
                    // (fetch blob doesn't use createObjectURL).
                    // But loadImage used createObjectURL for the mainFile.
                    // We can revoke img.src source if it starts with blob:
                    if (img.src.startsWith('blob:')) {
                        URL.revokeObjectURL(img.src);
                    }
                }

            } catch (tilingErr) {
                console.warn("Tiling scan failed:", tilingErr);
            }

            // Fallback pass (processed image) - Only if nothing found yet? 
            // Or maybe processed image has better contrast? 
            // Let's only use it if we found absolutely nothing.
            if (detectedCodes.size === 0 && fallbackImage) {
                // console.log("Pass 4: Fallback Image");
                // We need to convert base64 fallback to file
                const res = await fetch(fallbackImage);
                const blob = await res.blob();
                const fbFile = new File([blob], "fallback.jpg", { type: blob.type });
                const fbRes = await scanSingle(fbFile);
                if (fbRes) detectedCodes.add(fbRes);
            }

            html5QrCode.clear();
            return Array.from(detectedCodes);

        } catch (e) {
            console.error("Error in barcode scanning sequence:", e);
            // Ensure we clear even on error
            try { html5QrCode.clear(); } catch (_) { }
            return [];
        }
    }
};
