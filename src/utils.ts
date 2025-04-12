import { bbox } from "@turf/turf";

import type { Coordinate } from "./database";

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

const getUTCDate = (date: Date) => {
    return new Date(
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
};

function getUTCRange(date: Date) {
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

const convertCoordsToPolygon = (coordinates: Array<Coordinate>) => {
    const transformedCoordinates = coordinates.map((coord) => [
        coord.lng,
        coord.lat,
    ]);

    transformedCoordinates.push([coordinates[0].lng, coordinates[0].lat]);

    return transformedCoordinates;
};

const getHeightAndWidthInPixels = (
    transformedCoordinates: Array<Array<number>>
) => {
    const BBOX = bbox({
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [transformedCoordinates], // should be put inside an array
        },
    });

    const averageLatitude = (BBOX[1] + BBOX[3]) / 2;
    const widthMeters =
        Math.abs(BBOX[2] - BBOX[0]) *
        111320 *
        Math.cos((averageLatitude * Math.PI) / 180);
    const heightMeters = Math.abs(BBOX[3] - BBOX[1]) * 111132;

    const resolution = 10; // 10 meters per pixel
    const width = Math.round(widthMeters / resolution);
    const height = Math.round(heightMeters / resolution);

    return { width, height };
};

export {
    evalscript,
    getUTCDate,
    getUTCRange,
    convertCoordsToPolygon,
    getHeightAndWidthInPixels,
};
