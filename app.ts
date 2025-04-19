import { Elysia } from "elysia";

const app = new Elysia();

import { metadataRouter } from "./src/farms/metadata";

app.use(metadataRouter);

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
