import { t, Elysia } from "elysia";
import { ClientResponseError } from "pocketbase";

import {
    pocketbase,
    loginToDatabase,
    type FarmCalendar,
} from "../../../database";

const calendarRouter = new Elysia({ prefix: "/farms/calendar" });

const formatDate = (d: Date) => d.toISOString().split("T")[0];

function normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

calendarRouter.post(
    "/validate",
    async ({ set, body }) => {
        try {
            const { id, crop_fk, farm_fk, sowing_date, harvesting_date } = body;

            const newSowing = normalizeDate(sowing_date);
            const newHarvesting = normalizeDate(harvesting_date);

            if (newSowing > newHarvesting) {
                throw new Error(
                    "Sowing date must be on or before the harvesting date."
                );
            }

            if (pocketbase.authStore.isValid === false) {
                await loginToDatabase();
            }

            // Fetch all calendars for this farm
            const calendars = await pocketbase
                .collection("farm_calendar")
                .getFullList<FarmCalendar>({
                    filter: `farm_fk = '${farm_fk}'`,
                    fields: "id, sowing_date, harvesting_date",
                });

            if (id) {
                // On update, fetch the existing calendar to compare
                const existingCalendar = calendars.find(
                    (calendar) => calendar.id === id
                );

                if (!existingCalendar) {
                    throw new Error("Calendar to update not found.");
                }

                if (crop_fk !== existingCalendar.crop_fk) {
                    throw new Error(`Crop can not be changed.`);
                }

                if (newSowing !== normalizeDate(existingCalendar.sowing_date)) {
                    throw new Error(`Sowing date can not be changed.`);
                }
            }

            for (const calendar of calendars) {
                if (id && calendar.id === id) continue; // skip the same record

                const existingSowing = normalizeDate(calendar.sowing_date);
                const existingHarvesting = normalizeDate(
                    calendar.harvesting_date
                );

                const overlap =
                    newSowing <= existingHarvesting &&
                    newHarvesting >= existingSowing;

                if (overlap) {
                    throw new Error(
                        `Overlapping calendar detected with existing event from ${formatDate(
                            existingSowing
                        )} to ${formatDate(existingHarvesting)}.`
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
            crop_fk: t.String(),
            sowing_date: t.Date(),
            harvesting_date: t.Date(),
            id: t.Optional(t.String()),
        }),
    }
);

export { calendarRouter };
