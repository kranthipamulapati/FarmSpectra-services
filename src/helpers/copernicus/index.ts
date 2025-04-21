import axios from "axios";
import { fromFile, type TypedArray } from "geotiff";

import {
    client_id,
    client_secret,
    publicFolder,
    copernicusAuthUrl,
    copernicusBaseUrl,
    copernicusProcessUrl,
    copernicusCatalogUrl,
    sentinel_2_l2a_evalScript,
} from "../../constants";

import {
    pocketbase,
    SatelliteIndexExpand,
    type Coordinate,
    type FarmSatelliteDataExpand,
    type FarmSatelliteTaskMetadata,
} from "../../database";

import {
    calculateAverage,
    convertCoordsToPolygon,
    generateColorMapImage,
    getHeightAndWidthInPixels,
} from "../../utils";

const L = 0.5;

const getAccessToken = async () => {
    try {
        const response = await axios({
            method: "POST",
            url: copernicusAuthUrl,
            baseURL: copernicusBaseUrl,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data: `client_id=${client_id}&client_secret=${client_secret}&grant_type=client_credentials`,
        });

        return response.data.access_token;
    } catch (error: unknown) {
        throw error;
    }
};

const getS2FirstVisitDate = async (taskedFarm: FarmSatelliteTaskMetadata) => {
    try {
        const {
            coordinates,
            revisit_time,
            collection_code,
            satellite_start_date,
        } = taskedFarm;

        // set start, end dates as satellite first live date + revisit time period, so satellite should visit once in this cycle
        // live date is hard coded in db as 00.00.00, so ISO is fine
        // this gives 1st date 00.00.00 and 6th date 00.00.00, just after close of revisit day cycle
        const endDate = new Date(satellite_start_date);
        const startDate = new Date(satellite_start_date);
        endDate.setDate(startDate.getDate() + revisit_time);

        const formattedEndDate = endDate.toISOString();
        const formattedStartDate = startDate.toISOString();

        const searchParams = {
            limit: 1,
            collections: [collection_code],
            intersects: {
                type: "Point",
                coordinates: [coordinates[0].lng, coordinates[0].lat],
            },
            datetime: `${formattedStartDate}/${formattedEndDate}`,
        };

        const token = await getAccessToken();

        const response = await axios.post(copernicusCatalogUrl, searchParams, {
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
            },
        });

        if (response.data.features.length) {
            const availableDates = response.data.features.map(
                (feature: any) => feature.properties.datetime
            );

            if (availableDates.length) {
                return availableDates[0];
            } else {
                throw new Error("Dates not found.");
            }
        } else {
            throw new Error("Features not found.");
        }
    } catch (err: unknown) {
        throw err;
    }
};

const getS2FarmVisitData = async ({
    token,
    endTime,
    startTime,
    coordinates,
}: {
    token: string;
    endTime: string;
    startTime: string;
    coordinates: Array<Coordinate>;
}) => {
    try {
        const transformedCoordinates = convertCoordsToPolygon(coordinates);
        const { height, width } = getHeightAndWidthInPixels(
            transformedCoordinates
        );

        const request = {
            input: {
                bounds: {
                    geometry: {
                        type: "Polygon",
                        coordinates: [transformedCoordinates],
                    },
                    properties: {
                        crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
                    },
                },
                data: [
                    {
                        dataFilter: {
                            timeRange: {
                                to: endTime,
                                from: startTime,
                            },
                            mosaickingOrder: "leastCC",
                        },
                        processing: {
                            harmonizeValues: false,
                        },
                        type: "sentinel-2-l2a",
                    },
                ],
            },
            output: {
                width,
                height,
                responses: [
                    {
                        identifier: "default",
                        format: { type: "image/tiff" },
                    },
                ],
            },
            evalscript: sentinel_2_l2a_evalScript,
        };

        const response = await axios.post(copernicusProcessUrl, request, {
            headers: {
                Accept: "image/tiff",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            responseType: "arraybuffer",
        });

        return response.data;
    } catch (err: unknown) {
        throw err;
    }
};

const processS2Tiff = async (
    id: string,
    tiffImage: FarmSatelliteDataExpand
) => {
    try {
        const { farm_fk, visit_date } = tiffImage;
        const { id: satId, collection_code } = tiffImage.expand.satellite_fk;

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
            const tiff = await fromFile(
                `${publicFolder}/images/${farm_fk}/${date}/${collection_code}/tiff.tif`
            );
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
                        denominator === 0 ? 0 : (nir - red) / denominator;
                }

                if (data.GNDVI) {
                    const denominator = nir + green;

                    data.GNDVI[i] =
                        denominator === 0 ? 0 : (nir - green) / denominator;
                }

                if (data.GCI) {
                    data.GCI[i] = green === 0 ? 0 : nir / green - 1;
                }

                if (data.RECI) {
                    data.RECI[i] = redEdge === 0 ? 0 : nir / redEdge - 1;
                }

                if (data.SAVI) {
                    const denominator = nir + red + L;

                    data.SAVI[i] =
                        denominator === 0
                            ? 0
                            : ((nir - red) / denominator) * (1 + L);
                }

                if (data.MSAVI) {
                    const term = (2 * nir + 1) ** 2 - 8 * (nir - red);

                    data.MSAVI[i] =
                        (2 * nir + 1 - Math.sqrt(Math.max(0, term))) / 2;
                }

                if (data.OSAVI) {
                    const denominator = nir + red + 0.16;

                    data.OSAVI[i] =
                        denominator === 0 ? 0 : (nir - red) / denominator;
                }

                if (data.NDWI) {
                    const denominator = green + nir;

                    data.NDWI[i] =
                        denominator === 0 ? 0 : (green - nir) / denominator;
                }

                if (data.NDMI) {
                    const denominator = nir + swir;

                    data.NDMI[i] =
                        denominator === 0 ? 0 : (nir - swir) / denominator;
                }

                if (data.ARVI) {
                    const numerator = nir - (2 * red - blue);
                    const denominator = nir + (2 * red + blue);

                    data.ARVI[i] =
                        denominator === 0 ? 0 : numerator / denominator;
                }

                if (data.VARI) {
                    const denominator = green + red - blue;

                    data.VARI[i] =
                        denominator === 0 ? 0 : (green - red) / denominator;
                }

                if (data.EVI) {
                    const denominator = nir + 6 * red - 7.5 * blue + 1;

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
                        denominator === 0 ? 0 : (nir - blue) / denominator;
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
                        0.5 * (120 * (nir - green) - 200 * (red - green));
                }

                if (data.MTVI2) {
                    const numerator =
                        1.5 * (1.2 * (nir - green) - 2.5 * (red - green));

                    const sqrtTerm = Math.sqrt(
                        Math.pow(2 * nir + 1, 2) -
                            (6 * nir - 5 * Math.sqrt(red))
                    );

                    data.MTVI2[i] = sqrtTerm === 0 ? 0 : numerator / sqrtTerm;
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

                    data.LAI[i] = denom === 0 ? 0 : (ndvi - ndwi) / denom;
                }
            }

            const basePath = `${publicFolder}/images/${farm_fk}/${date}/${collection_code}`;

            await Promise.all(
                indices.map((satelliteIndex, i) => {
                    return generateColorMapImage({
                        width,
                        height,
                        data: data[satelliteIndex],
                        colorMatrix: satelliteIndices[i].color_matrix,
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
                            image_url: `https://database.farmspectra.com/images/${farm_fk}/${date}/${collection_code}/${satelliteIndex}.png`,
                        });
                })
            );

            // Function to calculate average ignoring NaNs
            const cloudCoverageSCL = calculateAverage(data.SCL) * 100; // Convert to percentage
            const cloudCoverageCLD = calculateAverage(data.CLD) * 100; // Convert to percentage

            await pocketbase.collection("farm_satellite_data").update(id, {
                processed: true,
                cloud_cover: cloudCoverageSCL,
            });

            return "success";
        } else {
            throw new Error("No indices to process.");
        }
    } catch (error: unknown) {
        throw error;
    }
};

export {
    processS2Tiff,
    getAccessToken,
    getS2FarmVisitData,
    getS2FirstVisitDate,
};
