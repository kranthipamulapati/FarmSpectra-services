import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import {
    pocketbase,
    loginToDatabase,
    type SatelliteIndexExpand,
    type FarmSatelliteDataExpand,
} from "../../../database";

import { calculateAverage, generateColorMapImage } from "../../../utils";

const L = 0.5;

const processRouter = new Elysia({ prefix: "/farms/satellite/process" });

processRouter.get(
    "indices/:id", // farm satellite data id
    async ({ set, params }) => {
        const { id } = params;

        try {
            await loginToDatabase();

            const tiffImage = await pocketbase
                .collection("farm_satellite_data")
                .getOne<FarmSatelliteDataExpand>(id, {
                    expand: "farm_fk, satellite_fk",
                });

            if (!tiffImage) {
                throw new Error("ID does not exist.");
            }

            const { farm_fk, tiff_path, visit_date, processed } = tiffImage;

            if (processed === false) {
                const { id: satId, collection_code } =
                    tiffImage.expand.satellite_fk;

                if (collection_code === "sentinel-2-l2a") {
                    const satelliteIndices = await pocketbase
                        .collection("satellite_indices")
                        .getFullList<SatelliteIndexExpand>({
                            expand: "index_fk",
                            filter: `satellite_fk = '${satId}' && active = true && index_fk.active = true`,
                        });

                    const indices = satelliteIndices.map(
                        (item) => item.expand.index_fk.code
                    );

                    if (indices.length) {
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
                        const SCL = rasters[7] as TypedArray; // SCL
                        const CLD = rasters[8] as TypedArray; // CLD

                        const ndviData = new Float32Array(width * height);
                        const gndviData = new Float32Array(width * height);
                        const gciData = new Float32Array(width * height);
                        const reciData = new Float32Array(width * height);
                        const saviData = new Float32Array(width * height);
                        const msaviData = new Float32Array(width * height);
                        const osaviData = new Float32Array(width * height);
                        const ndwiData = new Float32Array(width * height);
                        const ndmiData = new Float32Array(width * height);
                        const arviData = new Float32Array(width * height);
                        const variData = new Float32Array(width * height);
                        const eviData = new Float32Array(width * height);
                        const evi2Data = new Float32Array(width * height);
                        const laiData = new Float32Array(width * height);
                        const sipiData = new Float32Array(width * height);
                        const cviData = new Float32Array(width * height);
                        const psriData = new Float32Array(width * height);
                        const tviData = new Float32Array(width * height);
                        const mtvi2Data = new Float32Array(width * height);
                        const nddiData = new Float32Array(width * height);
                        const msiData = new Float32Array(width * height);
                        const cloudMaskSCL = new Float32Array(SCL.length);
                        const cloudMaskCLD = new Float32Array(CLD.length);

                        for (let i = 0; i < height * width; i++) {
                            const red = redBand[i];
                            const nir = nirBand[i];
                            const blue = blueBand[i];
                            const green = greenBand[i];
                            const swir = swirBand[i];
                            const redEdge = redEdgeBand[i];

                            if (indices.includes("NDVI")) {
                                const denominator = nir + red;

                                ndviData[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - red) / denominator;
                            }

                            if (indices.includes("GNDVI")) {
                                const denominator = nir + green;

                                gndviData[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - green) / denominator;
                            }

                            if (indices.includes("GCI")) {
                                gciData[i] = green === 0 ? 0 : nir / green - 1;
                            }

                            if (indices.includes("RECI")) {
                                reciData[i] =
                                    redEdge === 0 ? 0 : nir / redEdge - 1;
                            }

                            if (indices.includes("SAVI")) {
                                const denominator = nir + red + L;

                                saviData[i] =
                                    denominator === 0
                                        ? 0
                                        : ((nir - red) / denominator) * (1 + L);
                            }

                            if (indices.includes("MSAVI")) {
                                const term =
                                    (2 * nir + 1) ** 2 - 8 * (nir - red);

                                msaviData[i] =
                                    (2 * nir +
                                        1 -
                                        Math.sqrt(Math.max(0, term))) /
                                    2;
                            }

                            if (indices.includes("OSAVI")) {
                                const denominator = nir + red + 0.16;

                                osaviData[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - red) / denominator;
                            }

                            if (indices.includes("NDWI")) {
                                const denominator = green + nir;

                                ndwiData[i] =
                                    denominator === 0
                                        ? 0
                                        : (green - nir) / denominator;
                            }

                            if (indices.includes("NDMI")) {
                                const denominator = nir + swir;

                                ndmiData[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - swir) / denominator;
                            }

                            if (indices.includes("ARVI")) {
                                const numerator = nir - (2 * red - blue);
                                const denominator = nir + (2 * red + blue);

                                arviData[i] =
                                    denominator === 0
                                        ? 0
                                        : numerator / denominator;
                            }

                            if (indices.includes("VARI")) {
                                const denominator = green + red - blue;

                                variData[i] =
                                    denominator === 0
                                        ? 0
                                        : (green - red) / denominator;
                            }

                            if (indices.includes("EVI")) {
                                const denominator =
                                    nir + 6 * red - 7.5 * blue + 1;

                                eviData[i] =
                                    denominator === 0
                                        ? 0
                                        : (2.5 * (nir - red)) / denominator;
                            }

                            if (indices.includes("EVI2")) {
                                const denominator = nir + 2.4 * red + 1;

                                evi2Data[i] =
                                    denominator === 0
                                        ? 0
                                        : (2.5 * (nir - red)) / denominator;
                            }

                            if (indices.includes("SIPI")) {
                                const denominator = nir - red;

                                sipiData[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - blue) / denominator;
                            }

                            if (indices.includes("CVI")) {
                                const denominator = red === 0 ? 1e-6 : red;

                                cviData[i] = nir / denominator;
                            }

                            if (indices.includes("PSRI")) {
                                const denominator = nir === 0 ? 1e-6 : nir;

                                psriData[i] = (red - blue) / denominator;
                            }

                            if (indices.includes("TVI")) {
                                tviData[i] =
                                    0.5 *
                                    (120 * (nir - green) - 200 * (red - green));
                            }

                            if (indices.includes("MTVI2")) {
                                const numerator =
                                    1.5 *
                                    (1.2 * (nir - green) - 2.5 * (red - green));

                                const sqrtTerm = Math.sqrt(
                                    Math.pow(2 * nir + 1, 2) -
                                        (6 * nir - 5 * Math.sqrt(red))
                                );

                                mtvi2Data[i] =
                                    sqrtTerm === 0 ? 0 : numerator / sqrtTerm;
                            }

                            if (indices.includes("MSI")) {
                                const denominator = nir === 0 ? 1e-6 : nir;

                                msiData[i] = swir / denominator;
                            }

                            cloudMaskSCL[i] = SCL[i] >= 7 ? 1 : 0;
                            cloudMaskCLD[i] = CLD[i] > 50 ? 1 : 0;
                        }

                        for (let i = 0; i < ndviData.length; i++) {
                            const ndvi = ndviData[i];
                            const ndwi = ndwiData[i];
                            const denom = ndvi + ndwi;

                            const value = (0.69 - ndvi) / 0.59;
                            laiData[i] = value <= 0 ? 0 : -Math.log(value);

                            nddiData[i] =
                                denom === 0 ? 0 : (ndvi - ndwi) / denom;
                        }

                        const basePath = `./images/${farm_fk}/${date}/${collection_code}`;

                        if (indices.includes("NDVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: ndviData,
                                filePath: `${basePath}/ndvi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("NDVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("GNDVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: gndviData,
                                filePath: `${basePath}/gndvi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("GNDVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("GCI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: gciData,
                                filePath: `${basePath}/gci.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("GCI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("RECI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: reciData,
                                filePath: `${basePath}/reci.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("RECI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("SAVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: saviData,
                                filePath: `${basePath}/savi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("SAVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("MSAVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: msaviData,
                                filePath: `${basePath}/msavi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("MSAVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("OSAVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: osaviData,
                                filePath: `${basePath}/osavi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("OSAVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("NDWI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: ndwiData,
                                filePath: `${basePath}/ndwi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("NDWI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("NDMI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: ndmiData,
                                filePath: `${basePath}/ndmi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("NDMI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("VARI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: variData,
                                filePath: `${basePath}/vari.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("VARI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("ARVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: arviData,
                                filePath: `${basePath}/arvi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("ARVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("EVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: eviData,
                                filePath: `${basePath}/evi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("EVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("EVI2")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: evi2Data,
                                filePath: `${basePath}/evi2.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("EVI2")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("SIPI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: sipiData,
                                filePath: `${basePath}/sipi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("SIPI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("CVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: cviData,
                                filePath: `${basePath}/cvi.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("CVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("PSRI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: psriData,
                                filePath: `${basePath}/PSRI.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("PSRI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("TVI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: tviData,
                                filePath: `${basePath}/TVI.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("TVI")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("MTVI2")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: mtvi2Data,
                                filePath: `${basePath}/MTVI2.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("MTVI2")]
                                        .color_matrix,
                            });
                        }

                        if (indices.includes("MSI")) {
                            await generateColorMapImage({
                                width,
                                height,
                                data: msiData,
                                filePath: `${basePath}/MSI.png`,
                                colorMatrix:
                                    satelliteIndices[indices.indexOf("MSI")]
                                        .color_matrix,
                            });
                        }

                        // Function to calculate average ignoring NaNs
                        const cloudCoverageSCL =
                            calculateAverage(cloudMaskSCL) * 100; // Convert to percentage
                        const cloudCoverageCLD =
                            calculateAverage(cloudMaskCLD) * 100; // Convert to percentage

                        await pocketbase
                            .collection("farm_satellite_data")
                            .update(id, {
                                processed: true,
                                cloud_cover: cloudCoverageSCL,
                            });
                    }
                }
            } else {
                throw new Error("Already processed.");
            }

            return { message: `Images for ID ${id} processed successfully.` };
        } catch (error: unknown) {
            set.status = 400;

            if (error instanceof ClientResponseError) {
                const { data, message } = error.response;

                const errorMessages = Object.entries(data || {})
                    .map(
                        ([field, err]: [string, any]) =>
                            `${field}: ${err.message}`
                    )
                    .join("\n");

                return `${message}\n${errorMessages}`;
            } else if (error instanceof Error) {
                return error.message;
            } else {
                return "An unknown error occurred";
            }
        }
    },
    {
        params: t.Object({
            id: t.String(),
        }),
    }
);

export { processRouter };
