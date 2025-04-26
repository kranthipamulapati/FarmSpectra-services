import area from "@turf/area";
import { t, Elysia } from "elysia";
import { polygon } from "@turf/helpers";
import { booleanValid } from "@turf/turf";

const newFarmRouter = new Elysia({ prefix: "/farms/new" });

newFarmRouter.post(
    "/validate",
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

            // Lat/lng bounds check (before expensive GIS logic)
            const allCoordsValid = body.coordinates.every(
                ({ lat, lng }) =>
                    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
            );

            if (!allCoordsValid) {
                throw new Error("Invalid coordinate bounds.");
            }

            // Turf-based validations & Self-intersection check
            const turfPoly = polygon([coordinates]);
            const isValid = booleanValid(turfPoly);

            if (!isValid) {
                throw new Error("Polygon is self-intersecting.");
            }

            // Area check (max 250 hectares)
            const maxArea = 2_500_000; // in square meters
            const actualArea = area(turfPoly);

            if (actualArea > maxArea) {
                throw new Error("Polygon is too large.");
            }

            return { isPolygonValid: true, message: "Polygon is valid." };
        } catch (error) {
            set.status = 400;

            if (error instanceof Error) {
                return { isPolygonValid: false, message: error.message };
            } else {
                return {
                    isPolygonValid: false,
                    message: "An unknown error occurred.",
                };
            }
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

export { newFarmRouter };
