import axios from "axios";
import { ClientResponseError } from "pocketbase";

import {
    getUTCDate,
    getUTCRange,
    convertCoordsToPolygon,
    getHeightAndWidthInPixels,
} from "../../utils";

import {
    pocketbase,
    type FarmSatelliteMetadata,
    type FarmSatelliteTaskExpand,
} from "../../database";

import { sentinel_2_l2a_evalScript } from "../../constants";

import { loginToDatabase, getCopernicusAccessToken } from "../../auth";

const url = "https://sh.dataspace.copernicus.eu/api/v1/process";

const runProcess = async () => {
    try {
        await loginToDatabase();

        const taskedFarms = await pocketbase
            .collection("farm_satellite_tasking")
            .getFullList<FarmSatelliteTaskExpand>({
                expand: "farm_fk, satellite_fk",
                filter: `active = true && start_date <= '${getUTCDate(
                    new Date()
                )}' && end_date >= '${getUTCDate(new Date())}'`,
            });

        const farmsWithMetadata = await pocketbase
            .collection("farm_satellite_metadata")
            .getFullList<FarmSatelliteMetadata>();

        const farmIdsWithMetadata = new Set(
            farmsWithMetadata.map(
                (meta) => `${meta.farm_fk}-${meta.satellite_fk}`
            )
        );

        const taskedFarmsWithMetadata = taskedFarms.filter((pair) =>
            farmIdsWithMetadata.has(`${pair.farm_fk}-${pair.satellite_fk}`)
        );

        const token = await getCopernicusAccessToken();

        for (let i = 0; i < taskedFarmsWithMetadata.length; i++) {
            const { farm_fk, satellite_fk } = taskedFarmsWithMetadata[i];
            const { coordinates } = taskedFarmsWithMetadata[i].expand.farm_fk;
            const { revisit_time, collection_code } =
                taskedFarmsWithMetadata[i].expand.satellite_fk;

            const farmMetadata = farmsWithMetadata.find((pair) =>
                farmIdsWithMetadata.has(`${pair.farm_fk}-${pair.satellite_fk}`)
            );

            if (farmMetadata) {
                const firstVisitDate = new Date(
                    farmMetadata.first_visit_date.split(" ")[0]
                );

                const lastVisitDate = new Date();
                lastVisitDate.setUTCDate(lastVisitDate.getUTCDate() - 1); // 1 for yesterday
                lastVisitDate.setUTCHours(0, 0, 0, 0);

                const diffInDays = Math.floor(
                    (firstVisitDate.getTime() - lastVisitDate.getTime()) /
                        (1000 * 60 * 60 * 24)
                );

                const isRevisitDayYesterday = diffInDays % revisit_time === 0;

                const transformedCoordinates =
                    convertCoordsToPolygon(coordinates);
                const { height, width } = getHeightAndWidthInPixels(
                    transformedCoordinates
                );

                if (isRevisitDayYesterday) {
                    const { startTime, endTime } = getUTCRange(
                        new Date(lastVisitDate)
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
                                            from: startTime,
                                            to: endTime,
                                        },
                                        mosaickingOrder: "leastCC",
                                    },
                                    processing: {
                                        harmonizeValues: false,
                                    },
                                    type: collection_code,
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

                    const response = await axios.post(url, request, {
                        headers: {
                            Accept: "image/tiff",
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        responseType: "arraybuffer",
                    });

                    const date = startTime.split("T")[0];

                    const path = `./images/${farm_fk}/${date}/${collection_code}/tiff.tif`; // ${date}

                    //@ts-ignore
                    await Bun.write(path, response.data);

                    await pocketbase.collection("farm_satellite_data").create({
                        farm_fk,
                        satellite_fk,
                        tiff_path: path,
                        visit_date: startTime,
                    });
                }
            }
        }
    } catch (error: any) {
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
};

// Run the process
runProcess();
