import axios from "axios";
import { bbox } from "@turf/turf";

import { loginToDatabase, getCopernicusAccessToken } from "./auth";

import { pocketbase, type FarmSatelliteDataExpand } from "./database";

const url = "https://sh.dataspace.copernicus.eu/api/v1/process";

const evalscript = `
            //VERSION=3
            function setup() {
                return {
                    input: [
                        {
                            units: "REFLECTANCE",
                            bands: ["B02", "B03", "B04", "B05", "B08", "B11", "B12"]
                        }
                    ],
                    output: {
                        bands: 7,
                        id: "default",
                        sampleType: SampleType.FLOAT32
                    },
                    mosaicking: Mosaicking.SIMPLE
                };
            }

            function evaluatePixel(sample) {
                return [
                    sample.B02,
                    sample.B03,
                    sample.B04,
                    sample.B05,
                    sample.B08,
                    sample.B11,
                    sample.B12
                ];
            }
        `;

const runProcess = async () => {
    try {
        await loginToDatabase();

        const farms = await pocketbase
            .collection("farm_satellite_data")
            .getFullList<FarmSatelliteDataExpand>({
                expand: "farm_fk, satellite_fk",
                filter: "visit_date != ''",
            });

        const token = await getCopernicusAccessToken();

        for (let i = 0; i < farms.length; i++) {
            let { visit_date } = farms[i];
            let { coordinates } = farms[i].expand.farm_fk;
            let { collection_code } = farms[i].expand.satellite_fk;

            const date = visit_date.split(" ")[0];

            const transformedCoordinates = coordinates.map((coord) => [
                coord.lng,
                coord.lat,
            ]);
            transformedCoordinates.push([
                coordinates[0].lng,
                coordinates[0].lat,
            ]);

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

            const response = await axios.post(url, request, {
                headers: {
                    Accept: "image/tiff",
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                responseType: "arraybuffer",
            });

            console.log(response.data);

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
