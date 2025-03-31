import axios from "axios";
import { ClientResponseError } from "pocketbase";

import { getUTCDate } from "./utils";

import { loginToDatabase, getCopernicusAccessToken } from "./auth";

import {
    pocketbase,
    type FarmSatelliteMetadata,
    type FarmSatelliteTaskExpand,
} from "./database";

const catalogApiUrl =
    "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";

// Function to query the Catalog API
async function getMetadata() {
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

        const missingFarms = taskedFarms.filter(
            (pair) =>
                !metadataFarmIds.has(`${pair.farm_fk}-${pair.satellite_fk}`)
        );

        const token = await getCopernicusAccessToken();

        for (let i = 0; i < missingFarms.length; i++) {
            let { coordinates } = missingFarms[i].expand.farm_fk;
            let { start_date, revisit_time, collection_code } =
                missingFarms[i].expand.satellite_fk;

            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + revisit_time);

            const formattedStartDate = startDate.toISOString();
            const formattedEndDate = endDate.toISOString();

            const searchParams = {
                limit: 1,
                collections: [collection_code],
                intersects: {
                    type: "Point",
                    coordinates: [coordinates[0].lng, coordinates[0].lat],
                },
                datetime: `${formattedStartDate}/${formattedEndDate}`,
            };

            const response = await axios.post(catalogApiUrl, searchParams, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + token,
                },
            });

            if (response.data.features.length) {
                const availableDates = response.data.features.map(
                    (feature: any) => feature.properties.datetime
                );

                if (availableDates.length) {
                    await pocketbase
                        .collection("farm_satellite_metadata")
                        .create({
                            farm_fk: missingFarms[i].farm_fk,
                            satellite_fk: missingFarms[i].satellite_fk,
                            first_visit_date: availableDates[0],
                        });
                }
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
getMetadata();
