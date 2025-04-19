import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTaskExpand,
} from "../../../database";

import { getS2FirstVisitDate } from "../../../helpers/copernicus";

const metadataRouter = new Elysia({ prefix: "/farms/satellite/metadata" });

metadataRouter.get(
    "/get/:id", // farm satellite task id
    async ({ set, params }) => {
        const { id } = params;

        try {
            await loginToDatabase();

            const taskedFarm = await pocketbase
                .collection("farm_satellite_tasking")
                .getOne<FarmSatelliteTaskExpand>(id, {
                    expand: "farm_fk, satellite_fk",
                });

            const today = new Date();
            const endDate = new Date(taskedFarm.end_date.replace(" ", "T"));
            const startDate = new Date(taskedFarm.start_date.replace(" ", "T"));

            const isTodayInRange = today >= startDate && today <= endDate;

            if (
                taskedFarm && // task exists
                isTodayInRange && // check if today is in tasked dates range
                taskedFarm.active && // task is active
                taskedFarm.expand.farm_fk.active && // farm is active
                taskedFarm.expand.satellite_fk.active // satellite is active
            ) {
                const { farm_fk, satellite_fk } = taskedFarm;
                const { collection_code } = taskedFarm.expand.satellite_fk;

                if (collection_code === "sentinel-2-l2a") {
                    const first_visit_date = await getS2FirstVisitDate(
                        taskedFarm
                    );

                    await pocketbase
                        .collection("farm_satellite_metadata")
                        .create({
                            farm_fk,
                            satellite_fk,
                            first_visit_date,
                        });
                }
            } else {
                throw new Error(
                    "Farm/Tasking/Satellite inactive or today not in tasked dates."
                );
            }

            return { message: `Metadata for ID ${id} fetched successfully.` };
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

export { metadataRouter };
