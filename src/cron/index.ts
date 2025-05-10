import { cron, Patterns } from "@elysiajs/cron";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTaskMetadata,
} from "../database";

import { getUTCRange, sendErrorMail } from "../utils";

import { imagesURL, publicFolder } from "../constants";

import {
    getCopernicusAccessToken,
    getCopernicusS2FarmVisitData,
    getCopernicusS2FirstVisitDate,
} from "../helpers/copernicus";

const getFarmsSatelliteDataCron = cron({
    name: "getFarmsSatelliteData",
    pattern: Patterns.EVERY_DAY_AT_1AM,
    run: async () => {
        try {
            if (pocketbase.authStore.isValid === false) {
                await loginToDatabase();
            }

            const taskedFarms = await pocketbase
                .collection("farm_satellite_tasking_metadata_view")
                .getFullList<FarmSatelliteTaskMetadata>();

            if (taskedFarms.length) {
                const token = await getCopernicusAccessToken();

                for (let i = 0; i < taskedFarms.length; i++) {
                    const taskedFarm = taskedFarms[i];

                    const {
                        farm_fk,

                        bbox,
                        coordinates,

                        satellite_fk,
                        code,
                        collection_code,
                        revisit_time,
                    } = taskedFarm;

                    // check if first_visit_date exists, if not, get
                    if (taskedFarm.first_visit_date === "") {
                        if (collection_code === "sentinel-2-l2a") {
                            taskedFarm.first_visit_date =
                                await getCopernicusS2FirstVisitDate(taskedFarm);

                            await pocketbase
                                .collection("farm_satellite_metadata")
                                .create({
                                    farm_fk,
                                    satellite_fk,
                                    first_visit_date:
                                        taskedFarm.first_visit_date,
                                });
                        }
                    }

                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setUTCDate(today.getUTCDate() - 1);
                    yesterday.setUTCHours(0, 0, 0, 0);

                    const firstVisitDate = new Date(
                        taskedFarm.first_visit_date.split(" ")[0]
                    );

                    const diffTime =
                        yesterday.getTime() - firstVisitDate.getTime();
                    const diffDays = Math.floor(
                        diffTime / (1000 * 60 * 60 * 24)
                    );
                    const isRevisitDay = diffDays % revisit_time === 0;

                    if (isRevisitDay) {
                        if (collection_code === "sentinel-2-l2a") {
                            const { endTime, startTime } = getUTCRange(
                                new Date(yesterday)
                            );

                            const date = startTime.split("T")[0];

                            const { data } = await getCopernicusS2FarmVisitData(
                                {
                                    bbox,
                                    token,
                                    endTime,
                                    startTime,
                                    coordinates,
                                }
                            );

                            const path = `${publicFolder}/images/${farm_fk}/${date}/${code}/tiff.tif`;

                            await Bun.write(path, data);

                            await pocketbase
                                .collection("farm_satellite_visit_data")
                                .create({
                                    farm_fk,
                                    satellite_fk,
                                    visit_date: startTime,
                                    tiff_path: `${imagesURL}/${farm_fk}/${date}/${code}/tiff.tif`,
                                });
                        }
                    }
                }
            }
        } catch (error: unknown) {
            let errorMessage = "An unknown error occurred";

            if (error instanceof ClientResponseError) {
                const { data, message } = error.response;

                const errorDetails = Object.entries(data || {})
                    .map(
                        ([field, err]: [string, any]) =>
                            `${field}: ${err.message}`
                    )
                    .join("\n");

                errorMessage = `${message}\n${errorDetails}`;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            await sendErrorMail("getFarmsSatelliteDataCron", errorMessage);

            return errorMessage;
        }
    },
});

export { getFarmsSatelliteDataCron };
