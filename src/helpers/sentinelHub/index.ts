import axios from "axios";

import { shAuthUrl, sh_client_id, sh_client_secret } from "../../constants";

const getSHAccessToken = async () => {
    try {
        const response = await axios({
            method: "POST",
            url: shAuthUrl,
            //baseURL: copernicusBaseUrl,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data: `client_id=${sh_client_id}&client_secret=${sh_client_secret}&grant_type=client_credentials`,
        });

        return response.data.access_token;
    } catch (error: unknown) {
        throw error;
    }
};

export { getSHAccessToken };
