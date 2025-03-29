import axios from "axios";

import { type Farm, pocketbase } from "./database";
import { loginToDatabase, getCopernicusAccessToken } from "./auth";

const catalogApiUrl =
    "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";

// Function to query the Catalog API
async function getAvailableDates() {
    try {
        await loginToDatabase();

        const farm = await pocketbase
            .collection("farms")
            .getFirstListItem<Farm>("");

        let { coordinates } = farm;

        // Define the search parameters
        const searchParams = {
            limit: 1,
            collections: ["sentinel-2-l2a"],
            intersects: {
                type: "Point",
                coordinates: [coordinates[0].lng, coordinates[0].lat],
            },
            datetime: "2018-01-01T00:00:00Z/2018-01-05T23:59:59Z",
        };

        const token = await getCopernicusAccessToken();

        const response = await axios.post(catalogApiUrl, searchParams, {
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
            },
        });

        const availableDates = response.data.features.map(
            (feature: any) => feature.properties.datetime.split("T")[0]
        );

        console.log("Available Dates:", availableDates);
    } catch (error) {
        console.error("Error querying the Catalog API:", error);
    }
}

// Call the function
getAvailableDates();
