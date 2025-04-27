import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteVisitDataExpand,
} from "../../../database";

import { processS2Tiff } from "../../../helpers/copernicus";

const processRouter = new Elysia({ prefix: "/farms/satellite/process" });

// process tiff file to index images
// skip is processed is already true
// @param - id - string - farm satellite data id

processRouter.get(
    "indices/:id",
    async ({ set, params }) => {
        const { id } = params;

        try {
            await loginToDatabase();

            const tiffImage = await pocketbase
                .collection("farm_satellite_visit_data")
                .getOne<FarmSatelliteVisitDataExpand>(id, {
                    expand: "farm_fk, satellite_fk",
                });

            const { processed } = tiffImage;

            if (processed === false) {
                const { collection_code } = tiffImage.expand.satellite_fk;

                if (collection_code === "sentinel-2-l2a") {
                    await processS2Tiff(id, tiffImage);
                }
            } else {
                throw new Error("Already processed.");
            }

            return { message: `Images for ID ${id} processed successfully.` };
        } catch (error: unknown) {
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

export { processRouter };
