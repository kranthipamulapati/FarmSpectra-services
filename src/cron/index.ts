import { cron, Patterns } from "@elysiajs/cron";

const getFarmsSatelliteDataCron = cron({
    name: "getFarmsSatelliteData",
    pattern: Patterns.EVERY_DAY_AT_2AM,
    run() {
        console.log("Heartbeat");
    },
});

export { getFarmsSatelliteDataCron };
