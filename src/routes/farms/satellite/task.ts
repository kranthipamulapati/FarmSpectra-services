import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

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

            const newStart = normalizeDate(new Date(start_date));
            const newEnd = normalizeDate(new Date(end_date));
            const today = normalizeDate(new Date());

            if (newStart > newEnd) {
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

            if (id) {
                // On update, fetch the existing task to compare
                const existingTask = tasks.find((task) => task.id === id);

                if (!existingTask) {
                    throw new Error("Task to update not found.");
                }

                const existingStart = normalizeDate(
                    new Date(existingTask.start_date)
                );

                if (newStart > existingStart) {
                    throw new Error(
                        `Start date cannot be after the existing start date (${existingStart.toDateString()}).`
                    );
                }
            }

            // Rule 2: End date must not be before today
            if (newEnd < today) {
                throw new Error("End date cannot be earlier than today.");
            }

            for (const task of tasks) {
                if (id && task.id === id) continue; // skip the same record

                const existingStart = normalizeDate(new Date(task.start_date));
                const existingEnd = normalizeDate(new Date(task.end_date));

                const overlap =
                    newStart <= existingEnd && newEnd >= existingStart;

                if (overlap) {
                    throw new Error(
                        `Overlapping task exists from ${existingStart.toISOString()} to ${existingEnd.toISOString()}`
                    );
                }
            }

            return {
                isTaskValid: true,
                message: "Task is valid.",
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

            return { isTaskValid: false, message: errorMessage };
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
