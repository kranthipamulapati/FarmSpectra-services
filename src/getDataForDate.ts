import axios from "axios";

import { loginToDatabase, getCopernicusAccessToken } from "./auth";

import { pocketbase, type FarmSatelliteTaskExpand } from "./database";

const catalogApiUrl =
    "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";

// Function to query the Catalog API
async function getAvailableDates() {
    try {
        await loginToDatabase();

        const farms = await pocketbase
            .collection("farm_satellite_tasking")
            .getFullList<FarmSatelliteTaskExpand>({
                expand: "farm_fk, satellite_fk",
            });

        const token = await getCopernicusAccessToken();

        for (let i = 0; i < farms.length; i++) {
            let { coordinates } = farms[i].expand.farm_fk;
            let { start_date, revisit_time, collection_code } =
                farms[i].expand.satellite_fk;

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

            const availableDates = response.data.features.map(
                (feature: any) => feature.properties.datetime
            );

            await pocketbase
                .collection("farm_satellite_tasking")
                .update(farms[i].id, {
                    first_available_date: availableDates[0],
                });
        }
    } catch (error) {
        console.error("Error querying the Catalog API:", error);
    }
}

// Call the function
getAvailableDates();
