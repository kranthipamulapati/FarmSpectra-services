import axios from "axios";

import {
    client_id,
    client_secret,
    pocketbaseUsername,
    pocketbasePassword,
} from "./constants";

import { pocketbase } from "./database";

const getCopernicusAccessToken = async () => {
    try {
        const response = await axios({
            method: "POST",
            data: `client_id=${client_id}&client_secret=${client_secret}&grant_type=client_credentials`,
            baseURL: "https://sh.dataspace.copernicus.eu",
            url: "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        return response.data.access_token;
    } catch (error: any) {
        console.log(
            "Error fetching access token:",
            error.response ? error.response.data : error.message
        );
    }
};

const loginToDatabase = async () => {
    try {
        if (pocketbaseUsername && pocketbasePassword) {
            await pocketbase
                .collection("_superusers")
                .authWithPassword(pocketbaseUsername, pocketbasePassword);
        }
    } catch (error: any) {
        console.log(
            "Error fetching access token:",
            error.response ? error.response.data : error.message
        );
    }
};

export { loginToDatabase, getCopernicusAccessToken };
