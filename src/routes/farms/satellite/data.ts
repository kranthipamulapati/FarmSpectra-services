import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTaskMetadata,
} from "../../../database";

import {
    getAccessToken,
    getS2FarmVisitData,
} from "../../../helpers/copernicus";

import { getUTCRange } from "../../../utils";

import { getSatelliteVisitDates } from "../../../helpers";

const dataRouter = new Elysia({ prefix: "/farms/satellite/data" });

dataRouter.get(
    "/getPrevious/:id", // farm satellite task id
    async ({ set, params }) => {
        const { id } = params;

        try {
            await loginToDatabase();

            const taskedFarm = await pocketbase
                .collection("farm_satellite_tasking_metadata_view")
                .getOne<FarmSatelliteTaskMetadata>(id);

            const {
                farm_fk,
                end_date,
                start_date,
                coordinates,
                revisit_time,
                satellite_fk,
                collection_code,
                first_visit_date,
            } = taskedFarm;

            if (first_visit_date === "") {
                throw new Error("Metadata not found");
            }

            const today = new Date();
            const endDate = new Date(end_date.replace(" ", "T"));
            const startDate = new Date(start_date.replace(" ", "T"));

            const isTodayInRange = today >= startDate && today <= endDate;

            if (isTodayInRange) {
                const dates = getSatelliteVisitDates({
                    start_date,
                    revisit_time,
                    first_visit_date,
                });

                if (collection_code === "sentinel-2-l2a") {
                    const token = await getAccessToken();

                    for (let i = 0; i < dates.length; i++) {
                        const { endTime, startTime } = getUTCRange(
                            new Date(dates[i])
                        );

                        const date = startTime.split("T")[0];

                        const data = await getS2FarmVisitData({
                            token,
                            endTime,
                            startTime,
                            coordinates,
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

                return "previous data extraction success.";
            } else {
                throw new Error(
                    "Farm/Task/Satellite inactive or today not in task range."
                );
            }
        } catch (error) {
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

export { dataRouter };
