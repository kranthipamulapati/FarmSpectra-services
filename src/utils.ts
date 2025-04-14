import { bbox } from "@turf/turf";

import type { Coordinate } from "./database";

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
    getUTCDate,
    getUTCRange,
    convertCoordsToPolygon,
    getHeightAndWidthInPixels,
};
