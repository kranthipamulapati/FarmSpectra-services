import { cron, Patterns } from "@elysiajs/cron";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTaskMetadata,
} from "../database";

import { getUTCRange } from "../utils";

import { getAccessToken, getS2FarmVisitData } from "../helpers/copernicus";

const getFarmsSatelliteDataCron = cron({
    name: "getFarmsSatelliteData",
    pattern: Patterns.EVERY_DAY_AT_2AM,
    run: async () => {
        try {
            await loginToDatabase();

            const taskedFarms = await pocketbase
                .collection("farm_satellite_tasking_metadata_view")
                .getFullList<FarmSatelliteTaskMetadata>({
                    filter: "first_visit_date != null",
                });

            if (taskedFarms.length) {
                const token = await getAccessToken();

                for (let i = 0; i < taskedFarms.length; i++) {
                    const {
                        farm_fk,
                        satellite_fk,
                        coordinates,
                        revisit_time,
                        collection_code,
                        first_visit_date,
                    } = taskedFarms[i];

                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setUTCDate(today.getUTCDate() - 1);
                    yesterday.setUTCHours(0, 0, 0, 0);

                    const firstVisitDate = new Date(
                        (first_visit_date || "").split(" ")[0]
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

                            const data = await getS2FarmVisitData({
                                endTime,
                                startTime,
                                coordinates,
                                token,
                            });

                            const path = `./images/${farm_fk}/${date}/${collection_code}/tiff.tif`;

                            await Bun.write(path, data);

                            await pocketbase
                                .collection("farm_satellite_data")
                                .create({
                                    farm_fk,
                                    satellite_fk,
                                    tiff_path: path,
                                    visit_date: startTime,
                                });
                        }
                    }
                }
            }
        } catch (error: unknown) {
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
});

export { getFarmsSatelliteDataCron };
