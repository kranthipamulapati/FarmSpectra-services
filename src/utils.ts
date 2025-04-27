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

    return transformedCoordinates;
};

const getHeightAndWidthInPixels = ({
    resolution,
    transformedCoordinates,
}: {
    resolution: number;
    transformedCoordinates: Array<Array<number>>;
}) => {
    const BBOX = bbox({
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [transformedCoordinates], // should be put inside an array
        },
    });

    const [minLon, minLat, maxLon, maxLat] = BBOX;

    const avgLat = (minLat + maxLat) / 2;
    const metersPerDegreeLon = 111320 * Math.cos((avgLat * Math.PI) / 180);
    const metersPerDegreeLat = 110574;

    const widthMeters = Math.abs(maxLon - minLon) * metersPerDegreeLon;
    const heightMeters = Math.abs(maxLat - minLat) * metersPerDegreeLat;

    const width = Math.round(widthMeters / resolution);
    const height = Math.round(heightMeters / resolution);

    return { width, height, BBOX };
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
    const rgbaData = Buffer.alloc(width * height * 4);

    for (let i = 0; i < data.length; i++) {
        const value = data[i];

        if (value === 0) {
            // Transparent pixel
            rgbaData[i * 4] = 0;
            rgbaData[i * 4 + 1] = 0;
            rgbaData[i * 4 + 2] = 0;
            rgbaData[i * 4 + 3] = 0;
            continue;
        }

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

        rgbaData[i * 4] = r;
        rgbaData[i * 4 + 1] = g;
        rgbaData[i * 4 + 2] = b;
        rgbaData[i * 4 + 3] = 255; // opaque
    }

    try {
        await sharp(rgbaData, {
            raw: { width, height, channels: 4 },
        })
            .resize({
                width: 256,
                height: 256,
                kernel: sharp.kernel.nearest,
            })
            .png()
            .toFile(filePath);
    } catch (error: unknown) {
        throw error;
    }
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
