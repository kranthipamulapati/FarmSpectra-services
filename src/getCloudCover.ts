import axios from "axios";
import { ClientResponseError } from "pocketbase";

import { getUTCDate, getUTCRange } from "./utils";

import { loginToDatabase, getCopernicusAccessToken } from "./auth";

import {
    pocketbase,
    type FarmSatelliteMetadata,
    type FarmSatelliteTaskExpand,
} from "./database";

const catalogApiUrl =
    "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";

// Function to query the Catalog API
async function callback() {
    try {
        await loginToDatabase();

        const taskedFarms = await pocketbase
            .collection("farm_satellite_tasking")
            .getFullList<FarmSatelliteTaskExpand>({
                expand: "farm_fk, satellite_fk",
                filter: `active = true && start_date <= '${getUTCDate(
                    new Date()
                )}' && end_date >= '${getUTCDate(new Date())}'`,
            });

        const metadataFarms = await pocketbase
            .collection("farm_satellite_metadata")
            .getFullList<FarmSatelliteMetadata>();

        const metadataFarmIds = new Set(
            metadataFarms.map((meta) => `${meta.farm_fk}-${meta.satellite_fk}`)
        );

        const farms = taskedFarms.filter((pair) =>
            metadataFarmIds.has(`${pair.farm_fk}-${pair.satellite_fk}`)
        );

        const token = await getCopernicusAccessToken();

        for (let i = 0; i < farms.length; i++) {
            let { coordinates } = farms[i].expand.farm_fk;
            let { start_date, revisit_time, collection_code } =
                farms[i].expand.satellite_fk;

            const startDate = new Date(start_date);

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1); // 1 for yesterday

            const diffInDays = Math.floor(
                (Number(yesterday) - Number(startDate)) / (1000 * 60 * 60 * 24)
            );

            const isRevisitDayYesterday = diffInDays % revisit_time === 0;

            if (isRevisitDayYesterday) {
                const { startTime, endTime } = getUTCRange(yesterday);

                const searchParams = {
                    limit: 1,
                    collections: [collection_code],
                    datetime: `${startTime}/${endTime}`,
                    intersects: {
                        type: "Point",
                        coordinates: [coordinates[0].lng, coordinates[0].lat],
                    },
                };

                const response = await axios.post(catalogApiUrl, searchParams, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + token,
                    },
                });

                if (response.data.features.length) {
                    let cloud_cover = Number(
                        response.data.features[0].properties["eo:cloud_cover"]
                    );

                    let datetime =
                        response.data.features[0].properties["datetime"];

                    await pocketbase.collection("farm_satellite_tiffs").create({
                        farm_fk: farms[i].farm_fk,
                        satellite_fk: farms[i].satellite_fk,
                        visit_date: datetime,
                        cloud_cover,
                    });
                } else {
                    throw new Error("No features found.");
                }
            } else {
                throw new Error("No satellite visit today.");
            }
        }
    } catch (error) {
        if (error instanceof ClientResponseError) {
            const { data, message } = error.response;

            const errorMessages = Object.entries(data || {})
                .map(
                    ([field, err]: [string, any]) => `${field}: ${err.message}`
                )
                .join("\n");

            console.log(`${message}\n${errorMessages}`, { type: "error" });
        } else if (error instanceof Error) {
            console.log(error.message, { type: "error" });
        } else {
            console.log("An unknown error occurred", { type: "error" });
        }
    }
}

// Call the function
callback();
