import sharp from "sharp";
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

async function generateColorMapImage({
    data,
    width,
    height,
    filePath,
    colorMatrix,
}: {
    width: number;
    height: number;
    filePath: string;
    data: Float32Array;
    colorMatrix: { min: number | null; max: number | null; hex: string }[];
}) {
    //@ts-ignore
    const rgbData = Buffer.alloc(width * height * 3);

    for (let i = 0; i < data.length; i++) {
        const value = data[i];

        let colorHex = "#000000";
        for (const range of colorMatrix) {
            const withinMin = range.min === null || value >= range.min;
            const withinMax = range.max === null || value < range.max;
            if (withinMin && withinMax) {
                colorHex = range.hex;
                break;
            }
        }

        const r = parseInt(colorHex.slice(1, 3), 16);
        const g = parseInt(colorHex.slice(3, 5), 16);
        const b = parseInt(colorHex.slice(5, 7), 16);

        rgbData[i * 3] = r;
        rgbData[i * 3 + 1] = g;
        rgbData[i * 3 + 2] = b;
    }

    await sharp(rgbData, {
        raw: { width, height, channels: 3 },
    })
        .resize({
            width: 256,
            height: 256,
            kernel: sharp.kernel.nearest,
        })
        .png()
        .toFile(filePath);
}

function calculateAverage(arr: Float32Array) {
    const validValues = arr.filter((value) => !isNaN(value));

    const sum = validValues.reduce(
        (acc, currentValue) => acc + currentValue,
        0
    );

    return sum / validValues.length;
}

export {
    getUTCDate,
    getUTCRange,
    calculateAverage,
    generateColorMapImage,
    convertCoordsToPolygon,
    getHeightAndWidthInPixels,
};
