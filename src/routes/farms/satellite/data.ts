import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTask,
    type FarmSatelliteMetadataExpand,
} from "../../../database";

import {
    getAccessToken,
    getS2FarmVisitData,
} from "../../../helpers/copernicus";

import { getUTCRange } from "../../../utils";

import { getSatelliteVisitDates } from "../../../helpers";

const dataRouter = new Elysia({ prefix: "/farms/satellite/data" });

dataRouter.get(
    "/getPrevious/:id", // farm satellite metadata id
    async ({ set, params }) => {
        const { id } = params;

        try {
            await loginToDatabase();

            const farmMetadata = await pocketbase
                .collection("farm_satellite_metadata")
                .getOne<FarmSatelliteMetadataExpand>(id, {
                    expand: "farm_fk, satellite_fk",
                });

            if (!farmMetadata) {
                throw new Error("Farm metadata not found");
            }

            const {
                revisit_time,
                collection_code,
                active: satelliteActive,
            } = farmMetadata.expand.satellite_fk;
            const { active: farmActive, coordinates } =
                farmMetadata.expand.farm_fk;
            const { farm_fk, satellite_fk, first_visit_date } = farmMetadata;

            const taskedFarm = await pocketbase
                .collection("farm_satellite_tasking")
                .getFirstListItem<FarmSatelliteTask>(
                    `farm_fk = '${farm_fk}' && satellite_fk = '${satellite_fk}'`
                );

            if (!taskedFarm) {
                throw new Error("Farm task not found");
            }

            const { start_date, end_date, active: taskActive } = taskedFarm;

            const today = new Date();
            const endDate = new Date(end_date.replace(" ", "T"));
            const startDate = new Date(start_date.replace(" ", "T"));

            const isTodayInRange = today >= startDate && today <= endDate;

            if (
                farmActive && // farm is active
                taskActive && // task is active
                isTodayInRange && // today is in task range
                satelliteActive // satellite is active
            ) {
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
                            endTime,
                            startTime,
                            coordinates,
                            token,
                        });

                        const path = `./images/${farm_fk}/${date}/${collection_code}/tiff.tif`;

                        //@ts-ignore
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

                return "previous data extraction success";
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
