import PocketBase from "pocketbase";

import { apiBaseURL } from "../constants";

const pocketbase = new PocketBase(apiBaseURL);
pocketbase.autoCancellation(false);

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
    start_date: Date;
    end_date: Date;
    active: boolean;
    created: Date;
    updated: Date;
};

type FarmSatelliteMetadata = {
    id: string;
    farm_fk: string;
    satellite_fk: string;
    first_visit_date: Date;
    created: Date;
    updated: Date;
};

type FarmSatelliteTiff = {
    id: string;
    farm_fk: string;
    satellite_fk: string;
    visit_date: Date;
    cloud_cover: number;
    tiff_path: string;
    processed: boolean;
    created: Date;
    updated: Date;
};

type FarmSatelliteIndexImage = {
    id: string;
    tiff_fk: string;
    index_fk: string;
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

type FarmSatelliteMetadataExpand = FarmSatelliteMetadata & {
    expand: {
        farm_fk: Farm;
        satellite_fk: Satellite;
    };
};

type FarmSatelliteTiffExpand = FarmSatelliteTiff & {
    expand: {
        farm_fk: Farm;
        satellite_fk: Satellite;
    };
};

export { pocketbase };
export type {
    Farm,
    Satellite,
    Coordinate,
    FarmSatelliteMetadata,
    FarmSatelliteTaskExpand,
    FarmSatelliteTiffExpand,
    FarmSatelliteMetadataExpand,
};
