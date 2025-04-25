import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTaskMetadata,
} from "../../../database";

import {
    getAccessToken,
    getS2FarmVisitData,
    getS2FirstVisitDate,
} from "../../../helpers/copernicus";

import { getUTCRange } from "../../../utils";

import { imagesURL, publicFolder } from "../../../constants";

import { getSatelliteVisitDates } from "../../../helpers";

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
            await loginToDatabase();

            const taskedFarm = await pocketbase
                .collection("farm_satellite_tasking_metadata_view")
                .getOne<FarmSatelliteTaskMetadata>(id);

            const {
                farm_fk,
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
                    taskedFarm.first_visit_date = await getS2FirstVisitDate(
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

            if (dates.length > 0 && collection_code === "sentinel-2-l2a") {
                const token = await getAccessToken();

                for (let i = 0; i < dates.length; i++) {
                    const { endTime, startTime } = getUTCRange(
                        new Date(dates[i])
                    );

                    const date = startTime.split("T")[0];

                    const data = await getS2FarmVisitData({
                        token,
                        endTime,
                        startTime,
                        coordinates,
                    });

                    const path = `${publicFolder}/images/${farm_fk}/${date}/${code}/tiff.tif`;

                    await Bun.write(path, data);

                    await pocketbase.collection("farm_satellite_data").create({
                        farm_fk,
                        satellite_fk,
                        visit_date: startTime,
                        tiff_path: `${imagesURL}/${farm_fk}/${date}/${code}/tiff.tif`,
                    });
                }
            }

            return {
                message: `Previous data for ID ${id} fetched successfully.`,
            };
        } catch (error) {
            set.status = 400;

            if (error instanceof ClientResponseError) {
                const { data, message } = error.response;

                const errorMessages = Object.entries(data || {})
                    .map(
                        ([field, err]: [string, any]) =>
                            `${field}: ${err.message}`
                    )
                    .join("\n");

                return `${message}\n${errorMessages}`;
            } else if (error instanceof Error) {
                return error.message;
            } else {
                return "An unknown error occurred";
            }
        }
    },
    {
        params: t.Object({
            id: t.String(),
        }),
    }
);

export { dataRouter };
