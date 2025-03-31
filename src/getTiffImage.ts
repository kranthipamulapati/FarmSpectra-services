import axios from "axios";

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
            .collection("farm_satellite_tiffs")
            .getFullList<FarmSatelliteTiffExpand>({
                expand: "farm_fk, satellite_fk",
                filter: "visit_date != ''",
            });

        const token = await getCopernicusAccessToken();

        for (let i = 0; i < farms.length; i++) {
            let { visit_date } = farms[i];
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

            const path = "./sentinel_image.tif";
            await Bun.write(path, response.data);
        }

        // console.log(`GeoTIFF image saved to ${tiffPath}`);
    } catch (error: any) {
        console.error("Error:", error);
    }
};

// Run the process
runProcess();
