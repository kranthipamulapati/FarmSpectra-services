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

            const { farm_fk, satellite_fk } = farmMetadata;

            const taskedFarm = await pocketbase
                .collection("farm_satellite_tasking")
                .getFirstListItem<FarmSatelliteTask>(
                    `farm_fk = '${farm_fk}' && satellite_fk = '${satellite_fk}'`
                );

            if (
                taskedFarm && // task exists
                taskedFarm.active && // task is active
                farmMetadata && // metadata exists
                farmMetadata.expand.farm_fk.active && // farm is active
                farmMetadata.expand.satellite_fk.active // satellite is active
            ) {
                const { start_date } = taskedFarm;
                const { first_visit_date } = farmMetadata;

                const { revisit_time } = farmMetadata.expand.satellite_fk;

                const dates = getSatelliteVisitDates({
                    start_date,
                    revisit_time,
                    first_visit_date,
                });

                return dates;
            } else {
                throw new Error("Farm not found.");
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
