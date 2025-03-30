import PocketBase from "pocketbase";

import { apiBaseURL } from "../constants";

type Coordinate = {
    lat: number;
    lng: number;
};

type Farm = {
    id: string;
    name: string;
    area: number;
    unit_fk: string;
    user_fk: string;
    coordinates: Array<Coordinate>;
    created: Date;
    update: Date;
    active: boolean;
};

type Satellite = {
    id: string;
    code: string;
    name: string;
    start_date: string;
    collection_code: string;
    spatial_resolution: number;
    revisit_time: number;
    created: Date;
    updated: Date;
};

type FarmSatelliteTask = {
    id: string;
    farm_fk: string;
    satellite_fk: string;
    first_available_date: Date;
    active: boolean;
    created: Date;
    updated: Date;
};

type FarmSatelliteData = {
    id: string;
    farm_fk: string;
    satellite_fk: string;
    visit_date: Date;
    cloud_cover: number;
    image_url: string;
    created: Date;
    updated: Date;
};

type FarmSatelliteTaskExpand = FarmSatelliteTask & {
    expand: {
        farm_fk: Farm;
        satellite_fk: Satellite;
    };
};

type FarmSatelliteDataExpand = FarmSatelliteData & {
    expand: {
        farm_fk: Farm;
        satellite_fk: Satellite;
    };
};

const pocketbase = new PocketBase(apiBaseURL);
pocketbase.autoCancellation(false);

export { pocketbase };
export type {
    Farm,
    Satellite,
    Coordinate,
    FarmSatelliteTaskExpand,
    FarmSatelliteDataExpand,
};
