import axios from "axios";
import { ClientResponseError } from "pocketbase";

import {
    evalscript,
    convertCoordsToPolygon,
    getHeightAndWidthInPixels,
} from "./utils";

import { loginToDatabase, getCopernicusAccessToken } from "./auth";

import { pocketbase, type FarmSatelliteTiffExpand } from "./database";

const url = "https://sh.dataspace.copernicus.eu/api/v1/process";

const runProcess = async () => {
    try {
        await loginToDatabase();

        const farms = await pocketbase
            .collection("farm_satellite_data")
            .getFullList<FarmSatelliteTiffExpand>({
                expand: "farm_fk, satellite_fk",
                filter: "tiff_path = ''",
            });

        const token = await getCopernicusAccessToken();

        for (let i = 0; i < farms.length; i++) {
            let { id, farm_fk, visit_date } = farms[i];
            let { coordinates } = farms[i].expand.farm_fk;
            let { collection_code } = farms[i].expand.satellite_fk;

            const date = visit_date.split(" ")[0];

            const transformedCoordinates = convertCoordsToPolygon(coordinates);
            const { height, width } = getHeightAndWidthInPixels(
                transformedCoordinates
            );

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
                            type: collection_code,
                            dataFilter: {
                                timeRange: {
                                    from: `${date}T00:00:00Z`,
                                    to: `${date}T23:59:59Z`,
                                },
                            },
                        },
                    ],
                },
                output: {
                    width,
                    height,
                    responses: [
                        {
                            identifier: "default",
                            format: { type: "image/tiff" },
                        },
                    ],
                },
                evalscript,
            };

            const response = await axios.post(url, request, {
                headers: {
                    Accept: "image/tiff",
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                responseType: "arraybuffer",
            });

            const path = `./images/${farm_fk}/${date}/${collection_code}/tiff.tif`;

            await Bun.write(path, response.data);

            await pocketbase
                .collection("farm_satellite_data")
                .update<FarmSatelliteTiffExpand>(id, {
                    tiff_path: path,
                    processed: true,
                });
        }
    } catch (error: any) {
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
};

// Run the process
runProcess();
