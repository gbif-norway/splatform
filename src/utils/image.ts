import UTIF from 'utif';

export const processImage = async (
    source: File | Blob | string,
    rotation: number = 0,
    maxWidth: number = 2048
): Promise<string> => {
    // If it's a TIFF file or blob, we need to decode it first
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

            // Reference source dimensions (img for normal, canvas for TIFF)
            const sourceWidth = processedSource instanceof HTMLCanvasElement ? processedSource.width : img.width;
            const sourceHeight = processedSource instanceof HTMLCanvasElement ? processedSource.height : img.height;

            // Handle rotation dimensions
            const isRotated90 = rotation % 180 !== 0;
            const width = isRotated90 ? sourceHeight : sourceWidth;
            const height = isRotated90 ? sourceWidth : sourceHeight;

            // Calculate scale
            let scale = 1;
            if (width > maxWidth) {
                scale = maxWidth / width;
            }

            const finalWidth = width * scale;
            const finalHeight = height * scale;

            canvas.width = finalWidth;
            canvas.height = finalHeight;

            // Rotate context
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);

            const dWidth = sourceWidth * scale;
            const dHeight = sourceHeight * scale;

            if (processedSource instanceof HTMLCanvasElement) {
                ctx.drawImage(processedSource, -dWidth / 2, -dHeight / 2, dWidth, dHeight);
            } else {
                ctx.drawImage(img, -dWidth / 2, -dHeight / 2, dWidth, dHeight);
            }

            resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG
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
