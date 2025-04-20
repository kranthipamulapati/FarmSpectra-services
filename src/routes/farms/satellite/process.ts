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

                        const data: {
                            [key: string]: Float32Array<ArrayBuffer>;
                        } = {
                            SCL: new Float32Array(width * height), // for clouds, not included in indices
                            CLD: new Float32Array(width * height), // for clouds, not included in indices
                        };

                        for (let i = 0; i < indices.length; i++) {
                            data[indices[i]] = new Float32Array(width * height);
                        }

                        for (let i = 0; i < height * width; i++) {
                            const red = redBand[i];
                            const nir = nirBand[i];
                            const blue = blueBand[i];
                            const green = greenBand[i];
                            const swir = swirBand[i];
                            const redEdge = redEdgeBand[i];

                            if (data.NDVI) {
                                const denominator = nir + red;

                                data.NDVI[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - red) / denominator;
                            }

                            if (data.GNDVI) {
                                const denominator = nir + green;

                                data.GNDVI[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - green) / denominator;
                            }

                            if (data.GCI) {
                                data.GCI[i] = green === 0 ? 0 : nir / green - 1;
                            }

                            if (data.RECI) {
                                data.RECI[i] =
                                    redEdge === 0 ? 0 : nir / redEdge - 1;
                            }

                            if (data.SAVI) {
                                const denominator = nir + red + L;

                                data.SAVI[i] =
                                    denominator === 0
                                        ? 0
                                        : ((nir - red) / denominator) * (1 + L);
                            }

                            if (data.MSAVI) {
                                const term =
                                    (2 * nir + 1) ** 2 - 8 * (nir - red);

                                data.MSAVI[i] =
                                    (2 * nir +
                                        1 -
                                        Math.sqrt(Math.max(0, term))) /
                                    2;
                            }

                            if (data.OSAVI) {
                                const denominator = nir + red + 0.16;

                                data.OSAVI[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - red) / denominator;
                            }

                            if (data.NDWI) {
                                const denominator = green + nir;

                                data.NDWI[i] =
                                    denominator === 0
                                        ? 0
                                        : (green - nir) / denominator;
                            }

                            if (data.NDMI) {
                                const denominator = nir + swir;

                                data.NDMI[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - swir) / denominator;
                            }

                            if (data.ARVI) {
                                const numerator = nir - (2 * red - blue);
                                const denominator = nir + (2 * red + blue);

                                data.ARVI[i] =
                                    denominator === 0
                                        ? 0
                                        : numerator / denominator;
                            }

                            if (data.VARI) {
                                const denominator = green + red - blue;

                                data.VARI[i] =
                                    denominator === 0
                                        ? 0
                                        : (green - red) / denominator;
                            }

                            if (data.EVI) {
                                const denominator =
                                    nir + 6 * red - 7.5 * blue + 1;

                                data.EVI[i] =
                                    denominator === 0
                                        ? 0
                                        : (2.5 * (nir - red)) / denominator;
                            }

                            if (data.EVI2) {
                                const denominator = nir + 2.4 * red + 1;

                                data.EVI2[i] =
                                    denominator === 0
                                        ? 0
                                        : (2.5 * (nir - red)) / denominator;
                            }

                            if (data.SIPI) {
                                const denominator = nir - red;

                                data.SIPI[i] =
                                    denominator === 0
                                        ? 0
                                        : (nir - blue) / denominator;
                            }

                            if (data.CVI) {
                                const denominator = red === 0 ? 1e-6 : red;

                                data.CVI[i] = nir / denominator;
                            }

                            if (data.PSRI) {
                                const denominator = nir === 0 ? 1e-6 : nir;

                                data.PSRI[i] = (red - blue) / denominator;
                            }

                            if (data.TVI) {
                                data.TVI[i] =
                                    0.5 *
                                    (120 * (nir - green) - 200 * (red - green));
                            }

                            if (data.MTVI2) {
                                const numerator =
                                    1.5 *
                                    (1.2 * (nir - green) - 2.5 * (red - green));

                                const sqrtTerm = Math.sqrt(
                                    Math.pow(2 * nir + 1, 2) -
                                        (6 * nir - 5 * Math.sqrt(red))
                                );

                                data.MTVI2[i] =
                                    sqrtTerm === 0 ? 0 : numerator / sqrtTerm;
                            }

                            if (data.MSI) {
                                const denominator = nir === 0 ? 1e-6 : nir;

                                data.MSI[i] = swir / denominator;
                            }

                            data.SCL[i] = SCL[i] >= 7 ? 1 : 0;
                            data.CLD[i] = CLD[i] > 50 ? 1 : 0;
                        }

                        if (data.LAI && data.NDVI && data.NDWI) {
                            for (let i = 0; i < data?.NDVI.length; i++) {
                                const ndvi = data.NDVI[i];
                                const ndwi = data.NDWI[i];

                                const denom = ndvi + ndwi;

                                const value = (0.69 - ndvi) / 0.59;
                                data.LAI[i] = value <= 0 ? 0 : -Math.log(value);

                                data.LAI[i] =
                                    denom === 0 ? 0 : (ndvi - ndwi) / denom;
                            }
                        }

                        const basePath = `./images/${farm_fk}/${date}/${collection_code}`;

                        await Promise.all(
                            indices.map((satelliteIndex, i) => {
                                return generateColorMapImage({
                                    width,
                                    height,
                                    data: data[satelliteIndex],
                                    colorMatrix:
                                        satelliteIndices[i].color_matrix,
                                    filePath: `${basePath}/${satelliteIndex}.png`,
                                });
                            })
                        );

                        await Promise.all(
                            indices.map((satelliteIndex, i) => {
                                return pocketbase
                                    .collection("farm_satellite_index_images")
                                    .create({
                                        tiff_fk: id,
                                        index_fk: satelliteIndices[i].index_fk,
                                        image_url: `https://database.farmspectra.com/public/images/${farm_fk}/${date}/${collection_code}/${satelliteIndex}.png`,
                                    });
                            })
                        );

                        // Function to calculate average ignoring NaNs
                        const cloudCoverageSCL =
                            calculateAverage(data.SCL) * 100; // Convert to percentage
                        const cloudCoverageCLD =
                            calculateAverage(data.CLD) * 100; // Convert to percentage

                        await pocketbase
                            .collection("farm_satellite_data")
                            .update(id, {
                                processed: true,
                                cloud_cover: cloudCoverageSCL,
                            });

                        return "success";
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
