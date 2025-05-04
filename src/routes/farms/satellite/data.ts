import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTaskMetadata,
    type FarmSatelliteVisitDataExpand,
} from "../../../database";

import {
    getSHAccessToken,
    getSHS2FarmVisitData,
    getSHS2FirstVisitDate,
    getSHPlanetScopeFarmVisitData,
} from "../../../helpers/sentinelHub";
import { getSatelliteVisitDates } from "../../../helpers";

import { imagesURL, publicFolder } from "../../../constants";

import { getUTCDate, getUTCRange, sendErrorMail } from "../../../utils";

const dataRouter = new Elysia({ prefix: "/farms/satellite/data" });

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
                    taskedFarm.first_visit_date = await getSHS2FirstVisitDate(
                        taskedFarm
                    );

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

            const token = await getSHAccessToken();

            for (let i = 0; i < dates.length; i++) {
                const date = dates[i];

                if (existingDatesSet.has(date)) continue;

                const { endTime, startTime } = getUTCRange(new Date(date));

                let res = {
                    data: "",
                };

                if (collection_code === "sentinel-2-l2a") {
                    res = await getSHS2FarmVisitData({
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
    "/index",
    async ({ set, body }) => {
        try {
            const { farm_fk, index_fk, satellite_fk, visit_date } = body;

            if (pocketbase.authStore.isValid === false) {
                await loginToDatabase();
            }

            const farms = await pocketbase
                .collection("farm_satellite_visit_data")
                .getFullList<FarmSatelliteVisitDataExpand>({
                    expand: "farm_fk, satellite_fk",
                    filter: `farm_fk = '${farm_fk}' && satellite_fk = '${satellite_fk}'`,
                });

            const { code } = farms[0].expand.satellite_fk;

            const datetime = getUTCDate(visit_date);
            const date = datetime.split("T")[0];

            const path = `${publicFolder}/images/${farm_fk}/${date}/${code}/tiff.tif`;

            return {
                message: path,
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
            farm_fk: t.String(),
            index_fk: t.String(),
            visit_date: t.Date(),
            satellite_fk: t.String(),
        }),
    }
);

export { dataRouter };
