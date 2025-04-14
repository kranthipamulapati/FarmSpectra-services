import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import {
    cciColorRanges,
    eviColorRanges,
    gciColorRanges,
    laiColorRanges,
    msiColorRanges,
    mtvi2ColorRanges,
    nddiColorRanges,
    ndviColorRanges,
    psriColorRanges,
    redEdgeCIRanges,
    sipiColorRanges,
    tviColorRanges,
    variColorRanges,
} from "../../constants";
import { loginToDatabase } from "../../auth";
import { generateColorMapImage } from "../../utils";
import { pocketbase, type FarmSatelliteDataExpand } from "../../database";

const L = 0.5;

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
            const greenBand = rasters[1] as TypedArray; // B03
            const redBand = rasters[2] as TypedArray; // B04
            const redEdgeBand = rasters[3] as TypedArray; // B05
            const nirBand = rasters[4] as TypedArray; // B08
            const swirBand = rasters[5] as TypedArray; // B11

            const gciData = new Float32Array(width * height);
            const eviData = new Float32Array(width * height);
            const ndviData = new Float32Array(width * height);
            const gndviData = new Float32Array(width * height);
            const redEdgeCIData = new Float32Array(width * height);
            const saviData = new Float32Array(width * height);
            const msaviData = new Float32Array(width * height);
            const osaviData = new Float32Array(width * height);
            const ndwiData = new Float32Array(width * height);
            const ndmiData = new Float32Array(width * height);
            const arviData = new Float32Array(width * height);
            const variData = new Float32Array(width * height);
            const evi2Data = new Float32Array(width * height);
            const laiData = new Float32Array(width * height);
            const sipiData = new Float32Array(width * height);
            const cciData = new Float32Array(width * height);
            const psriData = new Float32Array(width * height);
            const tviData = new Float32Array(width * height);
            const mtvi2Data = new Float32Array(width * height);
            const nddiData = new Float32Array(width * height);
            const msiData = new Float32Array(width * height);

            for (let i = 0; i < redBand.length; i++) {
                const red = redBand[i];
                const nir = nirBand[i];
                const blue = blueBand[i];
                const green = greenBand[i];
                const swir = swirBand[i];

                const ndviDenom = nir + red;
                ndviData[i] = ndviDenom === 0 ? 0 : (nir - red) / ndviDenom;

                const eviDenom = nir + 6 * red - 7.5 * blue + 1;
                eviData[i] =
                    eviDenom === 0 ? 0 : (2.5 * (nir - red)) / eviDenom;

                const gndviDenom = nir + green;
                gndviData[i] =
                    gndviDenom === 0 ? 0 : (nir - green) / gndviDenom;

                gciData[i] = green === 0 ? 0 : nir / green - 1;

                const redEdge = redEdgeBand[i];
                redEdgeCIData[i] = redEdge === 0 ? 0 : nir / redEdge - 1;

                const saviDenom = nir + red + L;
                saviData[i] =
                    saviDenom === 0 ? 0 : ((nir - red) / saviDenom) * (1 + L);

                const term = (2 * nir + 1) ** 2 - 8 * (nir - red);
                msaviData[i] = (2 * nir + 1 - Math.sqrt(Math.max(0, term))) / 2;

                const osaviDenom = nir + red + 0.16;
                osaviData[i] = osaviDenom === 0 ? 0 : (nir - red) / osaviDenom;

                const ndwiDenom = green + nir;
                ndwiData[i] = ndwiDenom === 0 ? 0 : (green - nir) / ndwiDenom;

                const ndmiDenom = nir + swir;
                ndmiData[i] = ndmiDenom === 0 ? 0 : (nir - swir) / ndmiDenom;

                const arviNumerator = nir - (2 * red - blue);
                const arviDenom = nir + (2 * red + blue);
                arviData[i] = arviDenom === 0 ? 0 : arviNumerator / arviDenom;

                const variDenom = green + red - blue;
                variData[i] = variDenom === 0 ? 0 : (green - red) / variDenom;

                const evi2Denom = nir + 2.4 * red + 1;
                evi2Data[i] =
                    evi2Denom === 0 ? 0 : (2.5 * (nir - red)) / evi2Denom;

                const sipiDenom = nir - red;
                sipiData[i] = sipiDenom === 0 ? 0 : (nir - blue) / sipiDenom;

                const ccidenom = red === 0 ? 1e-6 : red;
                cciData[i] = nir / ccidenom;

                const psriDenom = nir === 0 ? 1e-6 : nir;
                psriData[i] = (red - blue) / psriDenom;

                tviData[i] = 0.5 * (120 * (nir - green) - 200 * (red - green));

                const ntvi2Numerator =
                    1.5 * (1.2 * (nir - green) - 2.5 * (red - green));
                const sqrtTerm = Math.sqrt(
                    Math.pow(2 * nir + 1, 2) - (6 * nir - 5 * Math.sqrt(red))
                );

                mtvi2Data[i] = sqrtTerm === 0 ? 0 : ntvi2Numerator / sqrtTerm;

                const msiDenom = nir === 0 ? 1e-6 : nir;
                msiData[i] = swir / msiDenom;
            }

            for (let i = 0; i < ndviData.length; i++) {
                const ndvi = ndviData[i];
                const ndwi = ndwiData[i];
                const denom = ndvi + ndwi;

                const value = (0.69 - ndvi) / 0.59;
                laiData[i] = value <= 0 ? 0 : -Math.log(value);

                nddiData[i] = denom === 0 ? 0 : (ndvi - ndwi) / denom;
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
                generateColorMapImage(
                    gndviData,
                    width,
                    height,
                    ndviColorRanges,
                    `${basePath}/gndvi.png`
                ),
                generateColorMapImage(
                    gciData,
                    width,
                    height,
                    gciColorRanges,
                    `${basePath}/gci.png`
                ),
                generateColorMapImage(
                    redEdgeCIData,
                    width,
                    height,
                    redEdgeCIRanges,
                    `${basePath}/red_edge_ci.png`
                ),
                generateColorMapImage(
                    saviData,
                    width,
                    height,
                    ndviColorRanges,
                    `${basePath}/savi.png`
                ),
                generateColorMapImage(
                    msaviData,
                    width,
                    height,
                    ndviColorRanges,
                    `${basePath}/msavi.png`
                ),
                generateColorMapImage(
                    osaviData,
                    width,
                    height,
                    ndviColorRanges,
                    `${basePath}/osavi.png`
                ),
                generateColorMapImage(
                    ndwiData,
                    width,
                    height,
                    ndviColorRanges,
                    `${basePath}/ndwi.png`
                ),
                generateColorMapImage(
                    ndmiData,
                    width,
                    height,
                    ndviColorRanges,
                    `${basePath}/ndmi.png`
                ),
                generateColorMapImage(
                    arviData,
                    width,
                    height,
                    ndviColorRanges,
                    `${basePath}/arvi.png`
                ),
                generateColorMapImage(
                    variData,
                    width,
                    height,
                    variColorRanges,
                    `${basePath}/vari.png`
                ),
                generateColorMapImage(
                    evi2Data,
                    width,
                    height,
                    eviColorRanges,
                    `${basePath}/evi2.png`
                ),
                generateColorMapImage(
                    laiData,
                    width,
                    height,
                    laiColorRanges,
                    `${basePath}/lai.png`
                ),
                generateColorMapImage(
                    sipiData,
                    width,
                    height,
                    sipiColorRanges,
                    `${basePath}/sipi.png`
                ),
                generateColorMapImage(
                    cciData,
                    width,
                    height,
                    cciColorRanges,
                    `${basePath}/cci.png`
                ),
                generateColorMapImage(
                    psriData,
                    width,
                    height,
                    psriColorRanges,
                    `${basePath}/psri.png`
                ),
                generateColorMapImage(
                    tviData,
                    width,
                    height,
                    tviColorRanges,
                    `${basePath}/tvi.png`
                ),
                generateColorMapImage(
                    mtvi2Data,
                    width,
                    height,
                    mtvi2ColorRanges,
                    `${basePath}/mtvi2.png`
                ),
                generateColorMapImage(
                    nddiData,
                    width,
                    height,
                    nddiColorRanges,
                    `${basePath}/nddi.png`
                ),
                generateColorMapImage(
                    msiData,
                    width,
                    height,
                    msiColorRanges,
                    `${basePath}/msi.png`
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
