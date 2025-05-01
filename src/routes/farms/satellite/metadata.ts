import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTaskMetadata,
} from "../../../database";

import { getCopernicusS2FirstVisitDate } from "../../../helpers/copernicus";

const metadataRouter = new Elysia({ prefix: "/farms/satellite/metadata" });

// get metadata when ever a farm is assigned a satellite for tasking
// metadata includes first_visit_date, so if first_visit_date has value, it has to be skipped
// @param - id - string - farm satellite task id

metadataRouter.get(
    "/get/:id",
    async ({ set, params }) => {
        const { id } = params;

        try {
            await loginToDatabase();

            const taskedFarm = await pocketbase
                .collection("farm_satellite_tasking_metadata_view")
                .getOne<FarmSatelliteTaskMetadata>(id);

            const { farm_fk, satellite_fk, collection_code, first_visit_date } =
                taskedFarm;

            if (first_visit_date === "") {
                if (collection_code === "sentinel-2-l2a") {
                    const firstVisitDate = await getCopernicusS2FirstVisitDate(
                        taskedFarm
                    );

                    await pocketbase
                        .collection("farm_satellite_metadata")
                        .create({
                            farm_fk,
                            satellite_fk,
                            first_visit_date: firstVisitDate,
                        });
                }
            } else {
                throw new Error("Metadata already exists.");
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
