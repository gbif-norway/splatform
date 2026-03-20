import UTIF from 'utif';

/** ~3.6MB binary in base64 form; keeps JSON POST bodies within typical browser/API limits. */
const MAX_DATA_URL_CHARS = 4_800_000;
const MIN_EDGE_PX = 384;
const EDGE_SHRINK = 0.82;
const MIN_JPEG_QUALITY = 0.45;
const QUALITY_STEP = 0.06;

export const processImage = async (
    source: File | Blob | string,
    rotation: number = 0,
    /** Target max length of the longer side after rotation (both dimensions stay ≤ this). */
    maxWidth: number = 1920
): Promise<string> => {
    let processedSource: string | HTMLImageElement | HTMLCanvasElement = '';

    if (source instanceof File || source instanceof Blob) {
        const isTiff = source.type === 'image/tiff' ||
            (source instanceof File && (source.name.toLowerCase().endsWith('.tif') || source.name.toLowerCase().endsWith('.tiff')));

        if (isTiff) {
            const buffer = await source.arrayBuffer();
            const ifds = UTIF.decode(buffer);
            UTIF.decodeImage(buffer, ifds[0]);
            const rgba = UTIF.toRGBA8(ifds[0]);

            const canvas = document.createElement('canvas');
            canvas.width = ifds[0].width;
            canvas.height = ifds[0].height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            const imgData = ctx.createImageData(canvas.width, canvas.height);
            imgData.data.set(rgba);
            ctx.putImageData(imgData, 0, 0);
            processedSource = canvas;
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image();

        const onImageLoad = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject('No canvas context');
                return;
            }

            const sourceWidth = processedSource instanceof HTMLCanvasElement ? processedSource.width : img.width;
            const sourceHeight = processedSource instanceof HTMLCanvasElement ? processedSource.height : img.height;

            const isRotated90 = rotation % 180 !== 0;
            const width = isRotated90 ? sourceHeight : sourceWidth;
            const height = isRotated90 ? sourceWidth : sourceHeight;
            const maxSide = Math.max(width, height);

            const drawAtEdge = (edgePx: number, quality: number): string => {
                const scale = maxSide > edgePx ? edgePx / maxSide : 1;
                const fw = width * scale;
                const fh = height * scale;
                canvas.width = fw;
                canvas.height = fh;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(fw / 2, fh / 2);
                ctx.rotate((rotation * Math.PI) / 180);
                const dW = sourceWidth * scale;
                const dH = sourceHeight * scale;
                if (processedSource instanceof HTMLCanvasElement) {
                    ctx.drawImage(processedSource, -dW / 2, -dH / 2, dW, dH);
                } else {
                    ctx.drawImage(img, -dW / 2, -dH / 2, dW, dH);
                }
                return canvas.toDataURL('image/jpeg', quality);
            };

            let edgePx = Math.min(maxWidth, maxSide);
            let quality = 0.76;
            let dataUrl = '';

            for (let attempt = 0; attempt < 22; attempt++) {
                dataUrl = drawAtEdge(edgePx, quality);
                if (dataUrl.length <= MAX_DATA_URL_CHARS) {
                    break;
                }
                if (edgePx > MIN_EDGE_PX) {
                    edgePx = Math.max(MIN_EDGE_PX, Math.floor(edgePx * EDGE_SHRINK));
                } else {
                    quality = Math.max(MIN_JPEG_QUALITY, quality - QUALITY_STEP);
                }
            }

            // At minimum edge, noisy images may still exceed the byte budget — lower quality further.
            while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.28) {
                quality = Math.max(0.28, quality - 0.05);
                dataUrl = drawAtEdge(edgePx, quality);
            }

            resolve(dataUrl);
            if (!(typeof source === 'string')) {
                URL.revokeObjectURL(img.src);
            }
        };

        if (processedSource instanceof HTMLCanvasElement) {
            onImageLoad();
        } else {
            if (typeof source === 'string') {
                img.crossOrigin = "anonymous";
                img.src = source;
            } else {
                img.src = URL.createObjectURL(source);
            }
            img.onload = onImageLoad;
            img.onerror = reject;
        }
    });
};
