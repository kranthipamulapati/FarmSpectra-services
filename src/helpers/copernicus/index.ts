import axios from "axios";

import {
    client_id,
    client_secret,
    copernicusAuthUrl,
    copernicusBaseUrl,
    copernicusCatalogUrl,
} from "../../constants";

import type { FarmSatelliteTaskExpand } from "../../database";

const getAccessToken = async () => {
    try {
        const response = await axios({
            method: "POST",
            url: copernicusAuthUrl,
            baseURL: copernicusBaseUrl,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data: `client_id=${client_id}&client_secret=${client_secret}&grant_type=client_credentials`,
        });

        return response.data.access_token;
    } catch (error: unknown) {
        throw error;
    }
};

const getS2FirstVisitDate = async (taskedFarm: FarmSatelliteTaskExpand) => {
    try {
        const {
            revisit_time,
            collection_code,
            start_date: satelliteStartDate,
        } = taskedFarm.expand.satellite_fk;
        const { coordinates } = taskedFarm.expand.farm_fk;

        // set start, end dates as satellite first live date + revisit time period
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
                coordinates: [coordinates[0].lng, coordinates[0].lat],
            },
            datetime: `${formattedStartDate}/${formattedEndDate}`,
        };

        const token = await getAccessToken();

        const response = await axios.post(copernicusCatalogUrl, searchParams, {
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
                return availableDates[0];
            } else {
                throw new Error("Dates not found.");
            }
        } else {
            throw new Error("Features not found.");
        }
    } catch (err: unknown) {
        throw err;
    }
};

export { getAccessToken, getS2FirstVisitDate };
