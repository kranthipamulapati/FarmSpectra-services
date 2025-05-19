import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";
import { fromFile, type TypedArray } from "geotiff";

import {
    pocketbase,
    loginToDatabase,
    type SatelliteIndex,
    type FarmSatelliteTaskMetadata,
} from "../../../database";

import { imagesURL, publicFolder } from "../../../constants";

import { getUTCDate, getUTCRange, sendErrorMail } from "../../../utils";

import {
    getCopernicusAccessToken,
    getCopernicusS2FarmVisitData,
    getCopernicusS2FirstVisitDate,
} from "../../../helpers/copernicus";
import { getSatelliteVisitDates } from "../../../helpers";
import { getSHPlanetScopeFarmVisitData } from "../../../helpers/sentinelHub";

const dataRouter = new Elysia({ prefix: "/farms/satellite/data" });

type ColumnPoint = {
    value: number; // NDVI value
    position: [number, number]; // [lng, lat]
};

// get previous days data when ever a farm is assigned a satellite for tasking
// for example is farm is tasked from Mar 1st to May 31st & todays date is April 15th, then get data from March 1st to April 14th
// metadata includes first_visit_date, so if first_visit_date is empty, it has to be skipped
// @param - id - string - farm satellite task id

dataRouter.get(
    "/getPrevious/:id",
    async ({ set, params }) => {
        const { id } = params; // task id

        try {
            if (pocketbase.authStore.isValid === false) {
                await loginToDatabase();
            }

            const taskedFarm = await pocketbase
                .collection("farm_satellite_tasking_metadata_view")
                .getOne<FarmSatelliteTaskMetadata>(id);

            const {
                farm_fk,
                bbox,
                coordinates,

                end_date, // task end date
                start_date, // task start date

                satellite_fk,
                code, // satellite code
                revisit_time,
                collection_code,
            } = taskedFarm;

            // check if first_visit_date exists, if not, get
            if (taskedFarm.first_visit_date === "") {
                if (collection_code === "sentinel-2-l2a") {
                    taskedFarm.first_visit_date =
                        await getCopernicusS2FirstVisitDate(taskedFarm);

                    await pocketbase
                        .collection("farm_satellite_metadata")
                        .create({
                            farm_fk,
                            satellite_fk,
                            first_visit_date: taskedFarm.first_visit_date,
                        });
                }
            }

            const dates = getSatelliteVisitDates({
                end_date,
                start_date,
                revisit_time,
                first_visit_date: taskedFarm.first_visit_date,
            });

            const existingVisits = await pocketbase
                .collection("farm_satellite_visit_data")
                .getFullList({
                    fields: "visit_date",
                    filter: `farm_fk="${farm_fk}" && satellite_fk="${satellite_fk}"`,
                });

            // Convert existing visit dates into a Set of ISO date strings
            const existingDatesSet = new Set(
                existingVisits.map((visit) => visit.visit_date.split("T")[0])
            );

            if (dates.length === 0) {
                return { message: `No visit dates available for task ${id}.` };
            }

            const token = await getCopernicusAccessToken();

            for (let i = 0; i < dates.length; i++) {
                const date = dates[i];

                if (existingDatesSet.has(date)) continue;

                const { endTime, startTime } = getUTCRange(new Date(date));

                let res = {
                    data: "",
                };

                if (collection_code === "sentinel-2-l2a") {
                    res = await getCopernicusS2FarmVisitData({
                        bbox,
                        token,
                        endTime,
                        startTime,
                        coordinates,
                    });
                } else if (collection_code === "planet-scope") {
                    res = await getSHPlanetScopeFarmVisitData({
                        bbox,
                        token,
                        endTime,
                        startTime,
                        coordinates,
                    });
                }

                const path = `${publicFolder}/images/${farm_fk}/${date}/${code}/tiff.tif`;

                await Bun.write(path, res.data);

                await pocketbase
                    .collection("farm_satellite_visit_data")
                    .create({
                        farm_fk,
                        satellite_fk,
                        visit_date: startTime,
                        tiff_path: `${imagesURL}/${farm_fk}/${date}/${code}/tiff.tif`,
                    });
            }

            return {
                message: `Previous data for ID ${id} fetched successfully.`,
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

            await sendErrorMail("getPrevious", errorMessage);

            return errorMessage;
        }
    },
    {
        params: t.Object({
            id: t.String(),
        }),
    }
);

dataRouter.post(
    "/image",
    async ({ set, body }) => {
        try {
            const { farm_fk, visit_date, index_code, satellite_code } = body;

            if (pocketbase.authStore.isValid === false) {
                await loginToDatabase();
            }

            const datetime = getUTCDate(visit_date);
            const date = datetime.split("T")[0];

            const tiff = await fromFile(
                `${publicFolder}/images/${farm_fk}/${date}/${satellite_code}/tiff.tif`
            );

            const image = await tiff.getImage();
            const rasters = await image.readRasters();

            const satelliteIndices = await pocketbase
                .collection("satellite_indices")
                .getFullList<SatelliteIndex>({
                    filter: `index_fk.code = '${index_code}' && satellite_fk.code = '${satellite_code}'`,
                });

            const tiePoint = image.getTiePoints()[0]; // usually one
            const [scaleX, scaleY] = image.getFileDirectory().ModelPixelScale;

            const originX = tiePoint.x;
            const originY = tiePoint.y;

            const width = image.getWidth();
            const height = image.getHeight();

            let blueBand: any = null;
            let greenBand: any = null;
            let redBand: any = null;
            let redEdgeBand: any = null;
            let nirBand: any = null;
            let swirBand: any = null;

            if (satellite_code === "s2") {
                blueBand = rasters[0] as TypedArray; // B02
                greenBand = rasters[1] as TypedArray; // B03
                redBand = rasters[2] as TypedArray; // B04
                redEdgeBand = rasters[3] as TypedArray; // B05
                nirBand = rasters[4] as TypedArray; // B08
                swirBand = rasters[5] as TypedArray; // B11
            } else if (satellite_code === "ps") {
                redBand = rasters[0] as TypedArray; // red
                blueBand = rasters[1] as TypedArray; // blue
                greenBand = rasters[2] as TypedArray; // green
                redEdgeBand = rasters[3] as TypedArray; // red edge
                nirBand = rasters[4] as TypedArray; // near infra red
            }

            const columns: ColumnPoint[] = [];
            const ndviArray = new Float32Array(width * height);

            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const i = row * width + col;

                    const red = redBand[i];
                    const nir = nirBand[i];

                    const denominator = nir + red;
                    const ndvi =
                        denominator === 0 ? 0 : (nir - red) / denominator;

                    ndviArray[i] = ndvi;

                    const lng = originX + col * scaleX;
                    const lat = originY - row * scaleY; // invert Y for geographic space

                    columns.push({
                        value: ndvi,
                        position: [lng, lat],
                    });
                }
            }

            return {
                width,
                height,
                columns,
                color_matrix: satelliteIndices[0].color_matrix,
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

            return errorMessage;
        }
    },
    {
        body: t.Object({
            id: t.String(),
            farm_fk: t.String(),
            visit_date: t.Date(),
            index_code: t.String(),
            satellite_code: t.String(),
        }),
    }
);

export { dataRouter };
