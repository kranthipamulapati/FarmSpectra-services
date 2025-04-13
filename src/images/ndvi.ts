import sharp from "sharp";
import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import { loginToDatabase } from "../auth";

import { pocketbase, type FarmSatelliteDataExpand } from "../database";

async function createNDVIColorMap() {
    try {
        await loginToDatabase();

        const farms = await pocketbase
            .collection("farm_satellite_data")
            .getFullList<FarmSatelliteDataExpand>({
                expand: "farm_fk, satellite_fk",
                filter: "processed = false",
            });

        for (let i = 0; i < farms.length; i++) {
            const { tiff_path, farm_fk, visit_date } = farms[i];
            const { collection_code } = farms[i].expand.satellite_fk;
            const date = visit_date.split(" ")[0];

            const tiff = await fromFile(tiff_path);
            const image = await tiff.getImage();
            const rasters = await image.readRasters();

            // Get image dimensions
            const width = image.getWidth();
            const height = image.getHeight();

            // Get red and NIR bands (B04 and B08)
            const redBand = rasters[2] as TypedArray; // B04 at index 2
            const nirBand = rasters[4] as TypedArray; // B08 at index 4

            // Create a new array to store NDVI values
            const ndviData = new Float32Array(width * height);

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

            // Calculate NDVI for each pixel

            // Find min and max NDVI values for proper scaling
            let minNDVI = 1;
            let maxNDVI = -1;

            for (let i = 0; i < ndviData.length; i++) {
                if (ndviData[i] < minNDVI) minNDVI = ndviData[i];
                if (ndviData[i] > maxNDVI) maxNDVI = ndviData[i];
            }

            // Create an RGB buffer for the PNG image
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

            // Create PNG using sharp
            await sharp(rgbData, {
                raw: {
                    width,
                    height,
                    channels: 3,
                },
            })
                .png()
                .toFile(
                    `./images/${farm_fk}/${date}/${collection_code}/ndvi2.png`
                );
        }
    } catch (error) {
        if (error instanceof ClientResponseError) {
            const { data, message } = error.response;

            const errorMessages = Object.entries(data || {})
                .map(
                    ([field, err]: [string, any]) => `${field}: ${err.message}`
                )
                .join("\n");

            console.log(`${message}\n${errorMessages}`, { type: "error" });
        } else if (error instanceof Error) {
            console.log(error.message, { type: "error" });
        } else {
            console.log("An unknown error occurred", { type: "error" });
        }
    }
}

createNDVIColorMap();
