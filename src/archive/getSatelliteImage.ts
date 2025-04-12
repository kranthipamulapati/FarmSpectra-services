import axios from "axios";
import { bbox } from "@turf/turf";

import { type Farm, pocketbase } from "../database";
import { loginToDatabase, getCopernicusAccessToken } from "../auth";

const runProcess = async () => {
    try {
        await loginToDatabase();

        const farm = await pocketbase
            .collection("farms")
            .getFirstListItem<Farm>("");

        const { coordinates } = farm;

        const transformedCoordinates = coordinates.map((coord) => [
            coord.lng,
            coord.lat,
        ]);
        transformedCoordinates.push([coordinates[0].lng, coordinates[0].lat]);

        const BBOX = bbox({
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [transformedCoordinates],
            },
        });

        const averageLatitude = (BBOX[1] + BBOX[3]) / 2;

        const widthMeters =
            Math.abs(BBOX[2] - BBOX[0]) *
            111320 *
            Math.cos((averageLatitude * Math.PI) / 180);
        const heightMeters = Math.abs(BBOX[3] - BBOX[1]) * 111132;

        const resolution = 10; // 10 meters per pixel
        const widthPixels = Math.round(widthMeters / resolution);
        const heightPixels = Math.round(heightMeters / resolution);

        const token = await getCopernicusAccessToken();

        const evalscript = `
            //VERSION=3
            function setup() {
                return {
                    input: [
                        {
                            units: "REFLECTANCE",
                            bands: ["B02", "B03", "B04"]
                        }
                    ],
                    output: {
                        bands: 3,
                        id: "default",
                        sampleType: SampleType.AUTO
                    },
                    mosaicking: Mosaicking.SIMPLE
                };
            }

            function evaluatePixel(sample) {
                return [
                    sample.B02,
                    sample.B03,
                    sample.B04,
                ];
            }
        `;

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
                        type: "sentinel-2-l2a",
                        dataFilter: {
                            maxCloudCoverage: 20,
                            timeRange: {
                                from: "2025-01-01T00:00:00Z",
                                to: "2025-01-31T23:59:59Z",
                            },
                        },
                    },
                ],
            },
            output: {
                width: widthPixels,
                height: heightPixels,
                responses: [
                    {
                        identifier: "default",
                        format: { type: "image/tiff" },
                    },
                ],
            },
            evalscript: evalscript,
        };

        const url = "https://sh.dataspace.copernicus.eu/api/v1/process";

        const response = await axios.post(url, request, {
            headers: {
                Accept: "image/jpeg",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            responseType: "arraybuffer",
        });

        const path = "./sentinel_image.jpg";
        await Bun.write(path, response.data);
    } catch (error: any) {
        console.error("Error:", error);
    }
};

// Run the process
runProcess();
