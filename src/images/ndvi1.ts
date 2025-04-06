import { createCanvas } from "canvas";
import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray, type ReadRasterResult } from "geotiff";

import { loginToDatabase } from "../auth";

import { pocketbase, type FarmSatelliteDataExpand } from "../database";

async function generateImages() {
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
            const width = image.getWidth();
            const height = image.getHeight();
            const rasters: ReadRasterResult = await image.readRasters();

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
                `./images/${farm_fk}/${date}/${collection_code}/ndvi1.png`,
                canvas.toBuffer("image/png")
            );
        }
    } catch (error: unknown) {
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

generateImages();
