import axios from "axios";

import {
    shAuthUrl,
    shCatalogUrl,
    shProcessUrl,
    sh_client_id,
    sh_client_secret,
    sentinel_2_l2a_evalScript,
} from "../../constants";

import { convertCoordsToPolygon } from "../../utils";

import { Coordinate, FarmSatelliteTaskMetadata } from "../../database";

const getSHAccessToken = async () => {
    try {
        const response = await axios({
            method: "POST",
            url: shAuthUrl,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data: `client_id=${sh_client_id}&client_secret=${sh_client_secret}&grant_type=client_credentials`,
        });

        return response.data.access_token;
    } catch (error: unknown) {
        throw error;
    }
};

const getSHS2FirstVisitDate = async (taskedFarm: FarmSatelliteTaskMetadata) => {
    try {
        const {
            coordinates,
            revisit_time,
            collection_code,
            satellite_start_date,
        } = taskedFarm;

        // set start, end dates as satellite first live date + revisit time period, so satellite should visit once in this cycle
        // live date is hard coded in db as 00.00.00, so ISO is fine
        // this gives 1st date 00.00.00 and 6th date 00.00.00, just after close of revisit day cycle
        const endDate = new Date(satellite_start_date);
        const startDate = new Date(satellite_start_date);
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

        const token = await getSHAccessToken();

        const response = await axios.post(shCatalogUrl, searchParams, {
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

const getSHS2FarmVisitData = async ({
    token,
    endTime,
    startTime,
    coordinates,
}: {
    token: string;
    endTime: string;
    startTime: string;
    coordinates: Array<Coordinate>;
}) => {
    try {
        const transformedCoordinates = convertCoordsToPolygon(coordinates);

        const request = {
            input: {
                bounds: {
                    geometry: {
                        type: "Polygon",
                        coordinates: [transformedCoordinates],
                    },
                    properties: {
                        crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
                    },
                },
                data: [
                    {
                        dataFilter: {
                            timeRange: {
                                to: endTime,
                                from: startTime,
                            },
                            mosaickingOrder: "leastCC",
                        },
                        processing: {
                            harmonizeValues: false,
                        },
                        type: "sentinel-2-l2a",
                    },
                ],
            },
            output: {
                width: 256,
                height: 256,
                responses: [
                    {
                        identifier: "default",
                        format: { type: "image/tiff" },
                    },
                ],
            },
            evalscript: sentinel_2_l2a_evalScript,
        };

        const response = await axios.post(shProcessUrl, request, {
            headers: {
                Accept: "image/tiff",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            responseType: "arraybuffer",
        });

        return {
            data: response.data,
        };
    } catch (err: unknown) {
        throw err;
    }
};

export { getSHAccessToken, getSHS2FarmVisitData, getSHS2FirstVisitDate };
