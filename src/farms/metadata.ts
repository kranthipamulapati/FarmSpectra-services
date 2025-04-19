import axios from "axios";
import { t, Elysia } from "elysia";

import { copernicusCatalogApiUrl } from "../constants";

import { loginToDatabase, getCopernicusAccessToken } from "../auth";

import { pocketbase, type FarmSatelliteTaskExpand } from "../database";

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
                const {
                    revisit_time,
                    collection_code,
                    start_date: satelliteStartDate,
                } = taskedFarm.expand.satellite_fk;
                const { farm_fk, satellite_fk } = taskedFarm;
                const { coordinates } = taskedFarm.expand.farm_fk;

                if (collection_code === "sentinel-2-l2a") {
                    const endDate = new Date(satelliteStartDate);
                    const startDate = new Date(satelliteStartDate);
                    endDate.setDate(startDate.getDate() + revisit_time);

                    const formattedEndDate = endDate.toISOString();
                    const formattedStartDate = startDate.toISOString();

                    const searchParams = {
                        limit: 1,
                        collections: [collection_code],
                        intersects: {
                            type: "Point",
                            coordinates: [
                                coordinates[0].lng,
                                coordinates[0].lat,
                            ],
                        },
                        datetime: `${formattedStartDate}/${formattedEndDate}`,
                    };

                    const token = await getCopernicusAccessToken();

                    const response = await axios.post(
                        copernicusCatalogApiUrl,
                        searchParams,
                        {
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: "Bearer " + token,
                            },
                        }
                    );

                    if (response.data.features.length) {
                        const availableDates = response.data.features.map(
                            (feature: any) => feature.properties.datetime
                        );

                        if (availableDates.length) {
                            await pocketbase
                                .collection("farm_satellite_metadata")
                                .create({
                                    farm_fk,
                                    satellite_fk,
                                    first_visit_date: availableDates[0],
                                });
                        } else {
                            throw new Error("Dates not found.");
                        }
                    } else {
                        throw new Error("Features not found.");
                    }
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
