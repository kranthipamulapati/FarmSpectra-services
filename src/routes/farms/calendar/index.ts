import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmCalender,
} from "../../../database";

const calendarRouter = new Elysia({ prefix: "/farms/calendar" });

function normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

calendarRouter.post(
    "/validate",
    async ({ set, body }) => {
        try {
            const { id, farm_fk, sowing_date, harvesting_date } = body;

            if (normalizeDate(sowing_date) > normalizeDate(harvesting_date)) {
                throw new Error(
                    "Sowing date must be before or equal to harvesting date."
                );
            }

            if (pocketbase.authStore.isValid === false) {
                await loginToDatabase();
            }

            // Fetch all calendars for this farm
            const farms = await pocketbase
                .collection("farm_calendar")
                .getFullList<FarmCalender>({
                    filter: `farm_fk = '${farm_fk}'`,
                    fields: "id, sowing_date, harvesting_date",
                });

            for (const farm of farms) {
                if (id && farm.id === id) continue; // skip the same record

                const existingSowing = normalizeDate(
                    new Date(farm.sowing_date)
                );
                const existingHarvesting = normalizeDate(
                    new Date(farm.harvesting_date)
                );
                const newSowing = normalizeDate(new Date(sowing_date));
                const newHarvesting = normalizeDate(new Date(harvesting_date));

                const overlap =
                    newSowing <= existingHarvesting &&
                    newHarvesting >= existingSowing;

                if (overlap) {
                    throw new Error(
                        `Overlapping calendar detected with existing event from ${existingSowing.toISOString()} to ${existingHarvesting.toISOString()}`
                    );
                }
            }

            return {
                isCalendarValid: true,
                message: "Calendar is valid.",
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
                isCalendarValid: false,
            };
        }
    },
    {
        body: t.Object({
            farm_fk: t.String(),
            sowing_date: t.Date(),
            harvesting_date: t.Date(),
            id: t.Optional(t.String()),
        }),
    }
);

export { calendarRouter };
