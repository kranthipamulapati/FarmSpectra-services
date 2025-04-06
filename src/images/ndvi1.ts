import { createCanvas } from "canvas";
import { fromFile, TypedArray, type ReadRasterResult } from "geotiff";

async function generateImages(filePath: string) {
    const tiff = await fromFile(filePath);

    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const rasters: ReadRasterResult = await image.readRasters({});

    const redBand = rasters[2] as TypedArray;
    const nirBand = rasters[4] as TypedArray;

    const minNIR = Math.min(...nirBand);
    const maxNIR = Math.max(...nirBand);
    const minRed = Math.min(...redBand);
    const maxRed = Math.max(...redBand);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let i = 0; i < nirBand.length; i++) {
        const nir = (nirBand[i] - minNIR) / (maxNIR - minNIR);
        const red = (redBand[i] - minRed) / (maxRed - minRed);

        const ndvi = (nir - red) / (nir + red + 1e-10); // Avoid division by zero

        let r, g, b;
        if (ndvi < -0.2) {
            // Brown for bare soil / non-vegetation
            r = 150;
            g = 75;
            b = 0;
        } else if (ndvi < 0) {
            // Yellow for sparse vegetation
            r = 255;
            g = 255;
            b = 0;
        } else if (ndvi < 0.2) {
            // Light green for low vegetation
            r = 173;
            g = 255;
            b = 47;
        } else if (ndvi < 0.5) {
            // Green for healthy vegetation
            r = 34;
            g = 139;
            b = 34;
        } else {
            // Dark green for dense vegetation
            r = 0;
            g = 100;
            b = 0;
        }

        pixels[i * 4] = r; // Red channel
        pixels[i * 4 + 1] = g; // Green channel
        pixels[i * 4 + 2] = b; // Blue channel
        pixels[i * 4 + 3] = 255; // Alpha
    }

    ctx.putImageData(imageData, 0, 0);
    Bun.write(
        "C:/Users/kranthi/Desktop/Projects/FarmSpectra/services/images/7x624372n45gb65/2025-03-30/sentinel-2-l2a/ndvi.png",
        canvas.toBuffer("image/png")
    );
}

// Call the function with your file path
generateImages(
    "C:/Users/kranthi/Desktop/Projects/FarmSpectra/services/images/7x624372n45gb65/2025-03-30/sentinel-2-l2a/tiff.tif"
);
