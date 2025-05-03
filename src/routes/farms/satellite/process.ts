import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteVisitDataExpand,
} from "../../../database";

import { sendErrorMail } from "../../../utils";

import { processPSTiff, processS2Tiff } from "../../../helpers";

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
                } else if (collection_code === "planet-scope") {
                    await processPSTiff(id, tiffImage);
                }
            } else {
                throw new Error("Already processed.");
            }

            return { message: `Images for ID ${id} processed successfully.` };
        } catch (error: unknown) {
            set.status = 400;

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

            await sendErrorMail("indices", errorMessage);

            return errorMessage;
        }
    },
    {
        params: t.Object({
            id: t.String(),
        }),
    }
);

export { processRouter };
