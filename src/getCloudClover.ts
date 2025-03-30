import axios from "axios";

import { loginToDatabase, getCopernicusAccessToken } from "./auth";

import { pocketbase, type FarmSatelliteTaskExpand } from "./database";

const catalogApiUrl =
    "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";

function getUTCRange(date) {
    const startTime = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            0,
            0,
            0,
            0
        )
    ).toISOString();

    const endTime = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            23,
            59,
            59,
            999
        )
    ).toISOString();

    return { startTime, endTime };
}

// Function to query the Catalog API
async function callback() {
    try {
        await loginToDatabase();

        const farms = await pocketbase
            .collection("farm_satellite_tasking")
            .getFullList<FarmSatelliteTaskExpand>({
                expand: "farm_fk, satellite_fk",
                filter: "active = true && first_available_date != ''",
            });

        const token = await getCopernicusAccessToken();

        for (let i = 0; i < farms.length; i++) {
            let { coordinates } = farms[i].expand.farm_fk;
            let { start_date, revisit_time, collection_code } =
                farms[i].expand.satellite_fk;

            const startDate = new Date(start_date);

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 5);

            const diffInDaysYesterday = Math.floor(
                (Number(yesterday) - Number(startDate)) / (1000 * 60 * 60 * 24)
            );

            const isRevisitDayYesterday =
                diffInDaysYesterday % revisit_time === 0;

            if (isRevisitDayYesterday) {
                const { startTime, endTime } = getUTCRange(yesterday);

                const searchParams = {
                    limit: 1,
                    collections: [collection_code],
                    intersects: {
                        type: "Point",
                        coordinates: [coordinates[0].lng, coordinates[0].lat],
                    },
                    datetime: `${startTime}/${endTime}`,
                };

                const response = await axios.post(catalogApiUrl, searchParams, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + token,
                    },
                });

                const cloud_cover =
                    response.data.features[0].properties["eo:cloud_cover"];

                console.log(cloud_cover);
            } else {
                console.log("No satellite visit today.");
            }
        }
    } catch (error) {
        console.error("Error querying the Catalog API:", error);
    }
}

// Call the function
callback();
