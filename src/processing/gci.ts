import sharp from "sharp";
import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import { loginToDatabase } from "../auth";

import { pocketbase, type FarmSatelliteDataExpand } from "../database";

async function createGCIColorMap() {
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

            const width = image.getWidth();
            const height = image.getHeight();

            const nirBand = rasters[4] as TypedArray; // B08 at index 4
            const greenBand = rasters[1] as TypedArray; // B03 at index 1

            const gciData = new Float32Array(width * height);

            for (let i = 0; i < greenBand.length; i++) {
                const nir = nirBand[i];
                const green = greenBand[i];
                gciData[i] = nir / green - 1;
            }

            let minGCI = Infinity;
            let maxGCI = -Infinity;

            for (let i = 0; i < gciData.length; i++) {
                if (gciData[i] < minGCI) minGCI = gciData[i];
                if (gciData[i] > maxGCI) maxGCI = gciData[i];
            }

            const rgbData = Buffer.alloc(width * height * 3);

            for (let i = 0; i < gciData.length; i++) {
                const gci = gciData[i];
                let r, g, b;

                if (gci < 0) {
                    const intensity = Math.max(0, 1 + gci * 2);
                    r = Math.round(139 * intensity);
                    g = Math.round(69 * intensity);
                    b = Math.round(19 * intensity);
                } else if (gci < 0.2) {
                    const ratio = gci / 0.2;
                    r = Math.round(255 * (1 - ratio));
                    g = 255;
                    b = Math.round(50 * ratio);
                } else if (gci < 0.4) {
                    const ratio = (gci - 0.2) / 0.2;
                    r = 0;
                    g = 255;
                    b = Math.round(50 + 50 * ratio);
                } else if (gci < 0.6) {
                    const ratio = (gci - 0.4) / 0.2;
                    r = 0;
                    g = Math.round(255 * (1 - ratio * 0.5));
                    b = Math.round(100 * (1 - ratio));
                } else {
                    const ratio = Math.min(1, (gci - 0.6) / 0.4);
                    r = 0;
                    g = Math.round(125 * (1 - ratio * 0.6));
                    b = 0;
                }

                rgbData[i * 3] = r;
                rgbData[i * 3 + 1] = g;
                rgbData[i * 3 + 2] = b;
            }

            await sharp(rgbData, {
                raw: {
                    width,
                    height,
                    channels: 3,
                },
            })
                .png()
                .toFile(
                    `./images/${farm_fk}/${date}/${collection_code}/gci.png`
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

createGCIColorMap();
