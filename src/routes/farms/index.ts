import area from "@turf/area";
import { t, Elysia } from "elysia";
import { polygon } from "@turf/helpers";
import { ClientResponseError } from "pocketbase";
import { bbox, kinks, booleanValid } from "@turf/turf";

import { type Farm, pocketbase, loginToDatabase } from "../../database";

const farmsRouter = new Elysia({ prefix: "/farms" });

farmsRouter.post(
    "/create/validate",
    ({ set, body }) => {
        try {
            const coordinates = body.coordinates.map(({ lat, lng }) => [
                lng,
                lat,
            ]);

            // Ensure it's closed
            if (
                coordinates.length < 4 ||
                coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
                coordinates[0][1] !== coordinates[coordinates.length - 1][1]
            ) {
                throw new Error("Polygon not closed or too short.");
            }

            // Lat/lng bounds check
            const allCoordsValid = body.coordinates.every(
                ({ lat, lng }) =>
                    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
            );

            if (!allCoordsValid) {
                throw new Error("Invalid coordinate bounds.");
            }

            // Turf-based validations
            const turfPoly = polygon([coordinates]);
            const isValid = booleanValid(turfPoly);

            // Detect kinks (self-intersections)
            const intersections = kinks(turfPoly);

            if (!isValid) {
                throw new Error("Polygon is invalid.");
            }

            // Check if any kinks were found
            if (intersections.features.length > 0) {
                throw new Error("Polygon is self-intersecting.");
            }

            // Area check (max 250 hectares)
            const minArea = 100; // in square meters
            const maxArea = 2500000; // in square meters
            const actualArea = area(turfPoly);

            if (actualArea < minArea) {
                throw new Error("Polygon is too small.");
            }

            if (actualArea > maxArea) {
                throw new Error("Polygon is too large.");
            }

            const BBOX = bbox({
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Polygon",
                    coordinates: [coordinates], // should be put inside an array
                },
            });

            return {
                bbox: BBOX,
                isPolygonValid: true,
                message: "Polygon is valid.",
                area: Number(actualArea.toFixed(0)),
            };
        } catch (error) {
            set.status = 400;

            let errorMessage = "An unknown error occurred";

            if (error instanceof ClientResponseError) {
                const { data, message } = error.response;

                const errorDetails = Object.entries(data || {})
                    .map(
                        ([field, err]: [string, any]) =>
                            `${field}: ${err.message}`
                    )
                    .join("\n");

                errorMessage = `${message}\n${errorDetails}`;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                message: errorMessage,
                isPolygonValid: false,
            };
        }
    },
    {
        body: t.Object({
            coordinates: t.Array(
                t.Object({
                    lat: t.Number(),
                    lng: t.Number(),
                })
            ),
        }),
    }
);

farmsRouter.post(
    "/update/validate",
    async ({ set, body }) => {
        try {
            const { id, user_fk, coordinates } = body;

            if (pocketbase.authStore.isValid === false) {
                await loginToDatabase();
            }

            const farm = await pocketbase.collection("farms").getOne<Farm>(id);

            if (user_fk !== farm.user_fk) {
                throw new Error("User cannot be changed.");
            }

            const areCoordinatesEqual =
                farm.coordinates.length === coordinates.length &&
                farm.coordinates.every(
                    (coord, index) =>
                        coord.lat === coordinates[index].lat &&
                        coord.lng === coordinates[index].lng
                );

            if (!areCoordinatesEqual) {
                throw new Error("Coordinates cannot be changed.");
            }

            const transformedCoordinates = coordinates.map(({ lat, lng }) => [
                lng,
                lat,
            ]);

            const turfPoly = polygon([transformedCoordinates]);

            const BBOX = bbox({
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Polygon",
                    coordinates: [transformedCoordinates], // should be put inside an array
                },
            });

            const actualArea = area(turfPoly);

            return {
                bbox: BBOX,
                isPolygonValid: true,
                message: "Polygon is valid.",
                area: Number(actualArea.toFixed(0)),
            };
        } catch (error) {
            set.status = 400;

            let errorMessage = "An unknown error occurred";

            if (error instanceof ClientResponseError) {
                const { data, message } = error.response;

                const errorDetails = Object.entries(data || {})
                    .map(
                        ([field, err]: [string, any]) =>
                            `${field}: ${err.message}`
                    )
                    .join("\n");

                errorMessage = `${message}\n${errorDetails}`;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                message: errorMessage,
                isPolygonValid: false,
            };
        }
    },
    {
        body: t.Object({
            id: t.String(),
            user_fk: t.String(),
            coordinates: t.Array(
                t.Object({
                    lat: t.Number(),
                    lng: t.Number(),
                })
            ),
        }),
    }
);

export { farmsRouter };
