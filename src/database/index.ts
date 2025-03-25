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

const pocketbase = new PocketBase(apiBaseURL);
pocketbase.autoCancellation(false);

export { pocketbase };
export type { Farm, Coordinate };
