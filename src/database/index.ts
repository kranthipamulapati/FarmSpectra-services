import PocketBase from "pocketbase";

import { apiBaseURL, databasePassword, databaseUsername } from "../constants";

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
    updated: Date;
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
    active: boolean;
    created: Date;
    updated: Date;
};

type FarmSatelliteTask = {
    id: string;
    farm_fk: string;
    satellite_fk: string;
    start_date: string;
    end_date: string;
    active: boolean;
    created: Date;
    updated: Date;
};

type FarmSatelliteMetadata = {
    id: string;
    farm_fk: string;
    satellite_fk: string;
    first_visit_date: string;
    created: Date;
    updated: Date;
};

type FarmSatelliteData = {
    id: string;
    farm_fk: string;
    satellite_fk: string;
    visit_date: string;
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

type Index = {
    id: string;
    code: string;
    name: string;
    active: boolean;
    created: Date;
    updated: Date;
};

type SatelliteIndex = {
    id: string;
    index_fk: string;
    satellite_fk: string;
    color_matrix: Array<{
        hex: string;
        min: null | number;
        max: null | number;
    }>;
    active: boolean;
    created: Date;
    updated: Date;
};

type SatelliteIndexExpand = SatelliteIndex & {
    expand: {
        index_fk: Index;
    };
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

type FarmSatelliteDataExpand = FarmSatelliteData & {
    expand: {
        farm_fk: Farm;
        satellite_fk: Satellite;
    };
};

type FarmSatelliteTaskWithMetadata = Pick<Farm, "coordinates"> &
    Pick<Satellite, "collection_code" | "revisit_time"> &
    Pick<FarmSatelliteMetadata, "first_visit_date"> &
    Pick<
        FarmSatelliteTask,
        "id" | "farm_fk" | "satellite_fk" | "end_date" | "start_date"
    >;

const loginToDatabase = async () => {
    try {
        if (databaseUsername && databasePassword) {
            await pocketbase
                .collection("_superusers")
                .authWithPassword(databaseUsername, databasePassword);
        } else {
            throw new Error("Username or password not found.");
        }
    } catch (error: unknown) {
        throw error;
    }
};

export type {
    Farm,
    Index,
    Satellite,
    Coordinate,
    SatelliteIndex,
    FarmSatelliteTask,
    SatelliteIndexExpand,
    FarmSatelliteMetadata,
    FarmSatelliteIndexImage,
    FarmSatelliteTaskExpand,
    FarmSatelliteDataExpand,
    FarmSatelliteMetadataExpand,
    FarmSatelliteTaskWithMetadata,
};
export { pocketbase, loginToDatabase };
