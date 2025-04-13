import sharp from "sharp";
import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import { loginToDatabase } from "../auth";

import { pocketbase, type FarmSatelliteDataExpand } from "../database";

async function createSAVIColorMap() {
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

            const redBand = rasters[2] as TypedArray; // B04 at index 2
            const nirBand = rasters[4] as TypedArray; // B08 at index 4

            const L = 0.5; // canopy background adjustment factor
            const saviData = new Float32Array(width * height);

            for (let i = 0; i < redBand.length; i++) {
                const nir = nirBand[i];
                const red = redBand[i];
                const denominator = nir + red + L;
                saviData[i] =
                    denominator === 0
                        ? 0
                        : ((nir - red) / denominator) * (1 + L);
            }

            let minSAVI = 1;
            let maxSAVI = -1;

            for (let i = 0; i < saviData.length; i++) {
                if (saviData[i] < minSAVI) minSAVI = saviData[i];
                if (saviData[i] > maxSAVI) maxSAVI = saviData[i];
            }

            const rgbData = Buffer.alloc(width * height * 3);

            for (let i = 0; i < saviData.length; i++) {
                const savi = saviData[i];
                let r, g, b;

                if (savi < 0) {
                    const intensity = Math.max(0, 1 + savi * 2);
                    r = Math.round(139 * intensity);
                    g = Math.round(69 * intensity);
                    b = Math.round(19 * intensity);
                } else if (savi < 0.2) {
                    const ratio = savi / 0.2;
                    r = Math.round(255 * (1 - ratio));
                    g = 255;
                    b = Math.round(50 * ratio);
                } else if (savi < 0.4) {
                    const ratio = (savi - 0.2) / 0.2;
                    r = 0;
                    g = 255;
                    b = Math.round(50 + 50 * ratio);
                } else if (savi < 0.6) {
                    const ratio = (savi - 0.4) / 0.2;
                    r = 0;
                    g = Math.round(255 * (1 - ratio * 0.5));
                    b = Math.round(100 * (1 - ratio));
                } else {
                    const ratio = Math.min(1, (savi - 0.6) / 0.4);
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
                    `./images/${farm_fk}/${date}/${collection_code}/savi.png`
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

createSAVIColorMap();
