export const processImage = (
    file: File,
    rotation: number = 0,
    maxWidth: number = 1024
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject('No canvas context');
                return;
            }

            // Handle rotation dimensions
            const isRotated90 = rotation % 180 !== 0;
            const width = isRotated90 ? img.height : img.width;
            const height = isRotated90 ? img.width : img.height;

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

            // Draw image centered in rotated context
            // When rotated 0: draw -w/2, -h/2
            // When rotated 90: draw -h/2, -w/2 relative to the *image* dimensions (pre-rotation)
            // Actually simplest is to draw image at centered coords.
            // Image dimensions are img.width, img.height.
            // We need to draw it scaled.
            const dWidth = img.width * scale;
            const dHeight = img.height * scale;

            ctx.drawImage(img, -dWidth / 2, -dHeight / 2, dWidth, dHeight);

            resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG
        };
        img.onerror = reject;
    });
};
