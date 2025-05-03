import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

const app = new Elysia();

import { getFarmsSatelliteDataCron } from "./src/cron/index.ts";

import { farmsRouter } from "./src/routes/farms";
import { calendarRouter } from "./src/routes/farms/calendar";
import { dataRouter } from "./src/routes/farms/satellite/data";
import { taskRouter } from "./src/routes/farms/satellite/task.ts";
import { processRouter } from "./src/routes/farms/satellite/process";

app.use(swagger());
app.use(dataRouter);
app.use(taskRouter);
app.use(farmsRouter);
app.use(processRouter);
app.use(calendarRouter);

app.use(getFarmsSatelliteDataCron);

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
