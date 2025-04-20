import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTask,
    type FarmSatelliteMetadataExpand,
} from "../../../database";

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

            const { active: satelliteActive, revisit_time } =
                farmMetadata.expand.satellite_fk;
            const { active: farmActive } = farmMetadata.expand.farm_fk;
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

                return dates;
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
