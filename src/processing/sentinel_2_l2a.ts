import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import { loginToDatabase } from "../auth";
import { generateColorMapImage } from "../utils";
import { eviColorRanges, ndviColorRanges } from "../constants";
import { pocketbase, type FarmSatelliteDataExpand } from "../database";

async function createColorMaps() {
    try {
        await loginToDatabase();

        const farms = await pocketbase
            .collection("farm_satellite_data")
            .getFullList<FarmSatelliteDataExpand>({
                expand: "farm_fk, satellite_fk",
                filter: "processed = false",
            });

        for (const farm of farms) {
            const { tiff_path, farm_fk, visit_date } = farm;
            const { collection_code } = farm.expand.satellite_fk;
            const date = visit_date.split(" ")[0];

            const tiff = await fromFile(tiff_path);
            const image = await tiff.getImage();
            const rasters = await image.readRasters();

            const width = image.getWidth();
            const height = image.getHeight();

            const blueBand = rasters[0] as TypedArray; // B02
            const redBand = rasters[2] as TypedArray; // B04
            const nirBand = rasters[4] as TypedArray; // B08

            const eviData = new Float32Array(width * height);
            const ndviData = new Float32Array(width * height);

            for (let i = 0; i < redBand.length; i++) {
                const red = redBand[i];
                const nir = nirBand[i];
                const blue = blueBand[i];

                const ndviDenom = nir + red;
                ndviData[i] = ndviDenom === 0 ? 0 : (nir - red) / ndviDenom;

                const eviDenom = nir + 6 * red - 7.5 * blue + 1;
                eviData[i] =
                    eviDenom === 0 ? 0 : (2.5 * (nir - red)) / eviDenom;
            }

            const basePath = `./images/${farm_fk}/${date}/${collection_code}`;

            await Promise.all([
                generateColorMapImage(
                    ndviData,
                    width,
                    height,
                    ndviColorRanges,
                    `${basePath}/ndvi.png`
                ),
                generateColorMapImage(
                    eviData,
                    width,
                    height,
                    eviColorRanges,
                    `${basePath}/evi.png`
                ),
            ]);
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

createColorMaps();
