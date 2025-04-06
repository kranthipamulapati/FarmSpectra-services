import { fromFile, type TypedArray } from "geotiff";

async function createNDVIColorMap(filePath) {
    try {
        const tiff = await fromFile(filePath);
        const image = await tiff.getImage();
        const rasters = await image.readRasters();

        // Get image dimensions
        const width = image.getWidth();
        const height = image.getHeight();

        // According to your band information
        // B04 - red at index 2
        // B08 - NIR at index 4
        const redBand = rasters[2] as TypedArray;
        const nirBand = rasters[4] as TypedArray;

        // Create a new array to store NDVI values
        const ndviData = new Float32Array(width * height);

        // Calculate NDVI for each pixel
        for (let i = 0; i < redBand.length; i++) {
            const red = redBand[i];
            const nir = nirBand[i];

            // NDVI formula: (NIR - RED) / (NIR + RED)
            // Handle division by zero or very small values
            if (nir + red === 0 || (nir === 0 && red === 0)) {
                ndviData[i] = 0;
            } else {
                ndviData[i] = (nir - red) / (nir + red);
            }
        }

        // Find min and max NDVI values for proper scaling
        let minNDVI = 1;
        let maxNDVI = -1;

        for (let i = 0; i < ndviData.length; i++) {
            if (ndviData[i] < minNDVI) minNDVI = ndviData[i];
            if (ndviData[i] > maxNDVI) maxNDVI = ndviData[i];
        }

        const rgbData = Buffer.alloc(width * height * 3);

        // Convert NDVI to RGB colors
        // Common NDVI color scheme:
        // -1.0 to 0.0: shades of brown (barren/urban)
        // 0.0 to 0.2: light green/yellow (sparse vegetation)
        // 0.2 to 0.4: green (moderate vegetation)
        // 0.4 to 0.6: dark green (dense vegetation)
        // 0.6 to 1.0: very dark green (very dense vegetation)

        for (let i = 0; i < ndviData.length; i++) {
            const ndvi = ndviData[i];
            let r, g, b;

            if (ndvi < 0) {
                // Brown for negative NDVI (water, clouds, snow)
                const intensity = Math.max(0, 1 + ndvi * 2); // -1 -> 0, 0 -> 1
                r = Math.round(139 * intensity);
                g = Math.round(69 * intensity);
                b = Math.round(19 * intensity);
            } else if (ndvi < 0.2) {
                // Yellow to light green transition
                const ratio = ndvi / 0.2;
                r = Math.round(255 * (1 - ratio));
                g = 255;
                b = Math.round(50 * ratio);
            } else if (ndvi < 0.4) {
                // Light green to medium green
                const ratio = (ndvi - 0.2) / 0.2;
                r = 0;
                g = 255;
                b = Math.round(50 + 50 * ratio);
            } else if (ndvi < 0.6) {
                // Medium green to dark green
                const ratio = (ndvi - 0.4) / 0.2;
                r = 0;
                g = Math.round(255 * (1 - ratio * 0.5));
                b = Math.round(100 * (1 - ratio));
            } else {
                // Very dark green for highest NDVI
                const ratio = Math.min(1, (ndvi - 0.6) / 0.4);
                r = 0;
                g = Math.round(125 * (1 - ratio * 0.6));
                b = 0;
            }

            // Set RGB values in the buffer
            rgbData[i * 3] = r;
            rgbData[i * 3 + 1] = g;
            rgbData[i * 3 + 2] = b;
        }

        console.log("Creating PNG image...");
        await sharp(rgbData, {
            raw: {
                width,
                height,
                channels: 3,
            },
        })
            .png()
            .toFile(outputPath);

        console.log(`NDVI color map successfully created at: ${outputPath}`);

        return {
            success: true,
            dimensions: { width, height },
            ndviRange: { min: minNDVI, max: maxNDVI },
        };
    } catch (error) {
        console.error("Error creating NDVI color map:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

async function main() {
    const inputFilePath = "path/to/your/sentinel-file.tif"; // Replace with your file path
    const outputFilePath = "path/to/output/ndvi-colormap.png"; // Replace with desired output path

    const result = await createNDVIColorMap(inputFilePath, outputFilePath);

    if (result.success) {
        console.log("NDVI visualization completed successfully");
        console.log(
            `Image dimensions: ${result.dimensions.width}x${result.dimensions.height}`
        );
        console.log(
            `NDVI range: ${result.ndviRange.min.toFixed(
                2
            )} to ${result.ndviRange.max.toFixed(2)}`
        );
    } else {
        console.error("Failed to create NDVI visualization:", result.error);
    }
}

main().catch(console.error);
