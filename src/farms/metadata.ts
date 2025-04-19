import { t, Elysia } from "elysia";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTaskExpand,
} from "../database";

import { getS2FirstVisitDate } from "../helpers/copernicus";

const metadataRouter = new Elysia({ prefix: "/metadata" });

metadataRouter.post(
    "/get/:id",
    async ({ params }) => {
        const { id } = params;

        try {
            await loginToDatabase();

            const taskedFarm = await pocketbase
                .collection("farm_satellite_tasking")
                .getOne<FarmSatelliteTaskExpand>(id, {
                    expand: "farm_fk, satellite_fk",
                });

            if (taskedFarm) {
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
                throw new Error("Farm not found.");
            }

            return { message: `Metadata for ID ${id} fetched successfully.` };
        } catch (err) {
            return {
                message: err.message,
            };
        }
    },
    {
        params: t.Object({
            id: t.String(),
        }),
    }
);

export { metadataRouter };
