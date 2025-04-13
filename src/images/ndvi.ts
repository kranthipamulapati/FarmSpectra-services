import sharp from "sharp";
import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import { loginToDatabase } from "../auth";

import { pocketbase, type FarmSatelliteDataExpand } from "../database";

const ndviColorRanges = [
    { min: null, max: -1.1, hex: "#AC0028" },
    { min: -1.1, max: -0.2, hex: "#B3002B" },
    { min: -0.2, max: -0.1, hex: "#C1002F" },
    { min: -0.1, max: 0, hex: "#D20034" },
    { min: 0, max: 0.025, hex: "#E30039" },
    { min: 0.025, max: 0.05, hex: "#F3003D" },
    { min: 0.05, max: 0.075, hex: "#E74C39" },
    { min: 0.075, max: 0.1, hex: "#EC5B3E" },
    { min: 0.1, max: 0.125, hex: "#F26C43" },
    { min: 0.125, max: 0.15, hex: "#F57B49" },
    { min: 0.15, max: 0.175, hex: "#F98A4E" },
    { min: 0.175, max: 0.2, hex: "#FB9F53" },
    { min: 0.2, max: 0.25, hex: "#FCAE58" },
    { min: 0.25, max: 0.3, hex: "#FDB65E" },
    { min: 0.3, max: 0.35, hex: "#FDC463" },
    { min: 0.35, max: 0.4, hex: "#D2E58C" },
    { min: 0.4, max: 0.45, hex: "#E1F18F" },
    { min: 0.45, max: 0.5, hex: "#B9E484" },
    { min: 0.5, max: 0.55, hex: "#92D875" },
    { min: 0.55, max: 0.6, hex: "#7ABF6E" },
    { min: 0.6, max: 0.65, hex: "#67A86A" },
    { min: 0.65, max: 0.7, hex: "#529E61" },
    { min: 0.7, max: 0.75, hex: "#3A9957" },
    { min: 0.75, max: 0.8, hex: "#268D4E" },
    { min: 0.8, max: 0.85, hex: "#178C44" },
    { min: 0.85, max: 0.9, hex: "#158C42" },
    { min: 0.9, max: 0.95, hex: "#0F8C40" },
    { min: 0.95, max: null, hex: "#0F8C40" },
];
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

                let colorHex = "#000000"; // default
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

            const rawImage = sharp(rgbData, {
                raw: {
                    width,
                    height,
                    channels: 3,
                },
            });

            await rawImage.png().toFile(`${basePath}/ndvi_raw.png`);
            await rawImage
                .resize({
                    width: 256,
                    height: 256,
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
