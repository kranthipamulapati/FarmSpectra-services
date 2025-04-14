import sharp from "sharp";
import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import { loginToDatabase } from "../auth";

import { ndviColorRanges } from "../constants";

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

            const width = image.getWidth();
            const height = image.getHeight();

            const redBand = rasters[2] as TypedArray;
            const nirBand = rasters[4] as TypedArray;

            const ndviData = new Float32Array(width * height);

            for (let i = 0; i < redBand.length; i++) {
                const red = redBand[i];
                const nir = nirBand[i];
                ndviData[i] = nir + red === 0 ? 0 : (nir - red) / (nir + red);
            }

            const rgbData = Buffer.alloc(width * height * 3);

            for (let i = 0; i < ndviData.length; i++) {
                const ndvi = ndviData[i];

                let colorHex = "#000000"; // default fallback
                for (const range of ndviColorRanges) {
                    const withinMin = range.min === null || ndvi >= range.min;
                    const withinMax = range.max === null || ndvi < range.max;
                    if (withinMin && withinMax) {
                        colorHex = range.hex;
                        break;
                    }
                }

                const r = parseInt(colorHex.slice(1, 3), 16);
                const g = parseInt(colorHex.slice(3, 5), 16);
                const b = parseInt(colorHex.slice(5, 7), 16);

                rgbData[i * 3] = r;
                rgbData[i * 3 + 1] = g;
                rgbData[i * 3 + 2] = b;
            }

            const basePath = `./images/${farm_fk}/${date}/${collection_code}`;

            // Create base image
            const rawImage = sharp(rgbData, {
                raw: {
                    width,
                    height,
                    channels: 3,
                },
            });

            // Save raw image
            await rawImage.png().toFile(`${basePath}/ndvi_raw.png`);

            // Resize with high-quality kernel
            await rawImage
                .resize({
                    width: 256,
                    height: 256,
                    kernel: sharp.kernel.nearest,
                })
                .png()
                .toFile(`${basePath}/ndvi_visual.png`);
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
