import { t, Elysia } from "elysia";

import {
    pocketbase,
    loginToDatabase,
    type FarmSatelliteTask,
} from "../../../database";

const taskRouter = new Elysia({ prefix: "/farms/satellite/task" });

function normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

taskRouter.post(
    "/validate",
    async ({ set, body }) => {
        try {
            const { id, farm_fk, satellite_fk, start_date, end_date } = body;

            console.log({ id, farm_fk, satellite_fk, start_date, end_date });

            if (normalizeDate(start_date) > normalizeDate(end_date)) {
                throw new Error(
                    "Start date must be before or equal to end date."
                );
            }

            await loginToDatabase();

            // Fetch all tasks for this farm
            const tasks = await pocketbase
                .collection("farm_satellite_tasking")
                .getFullList<FarmSatelliteTask>({
                    fields: "id, start_date, end_date",
                    filter: `farm_fk = '${farm_fk}' && satellite_fk = '${satellite_fk}'`,
                });

            for (const task of tasks) {
                if (id && task.id === id) continue; // skip the same record

                const existingStart = normalizeDate(new Date(task.start_date));
                const existingEnd = normalizeDate(new Date(task.end_date));
                const newStart = normalizeDate(new Date(start_date));
                const newEnd = normalizeDate(new Date(end_date));

                const overlap =
                    newStart <= existingEnd && newEnd >= existingStart;

                if (overlap) {
                    throw new Error(
                        `Overlapping task detected with existing event from ${existingStart.toISOString()} to ${existingEnd.toISOString()}`
                    );
                }
            }

            return {
                isTaskValid: true,
                message: "Task is valid.",
            };
        } catch (error) {
            set.status = 400;

            if (error instanceof Error) {
                return { isTaskValid: false, message: error.message };
            } else {
                return {
                    isTaskValid: false,
                    message: "An unknown error occurred.",
                };
            }
        }
    },
    {
        body: t.Object({
            farm_fk: t.String(),
            satellite_fk: t.String(),
            start_date: t.Date(),
            end_date: t.Date(),
            id: t.Optional(t.String()),
        }),
    }
);

export { taskRouter };
