import { Elysia } from "elysia";

const app = new Elysia();

import { getFarmsSatelliteDataCron } from "./src/cron/index.ts";

import { dataRouter } from "./src/routes/farms/satellite/data";
import { processRouter } from "./src/routes/farms/satellite/process";
import { metadataRouter } from "./src/routes/farms/satellite/metadata";

app.use(dataRouter);
app.use(processRouter);
app.use(metadataRouter);

app.use(getFarmsSatelliteDataCron);

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
