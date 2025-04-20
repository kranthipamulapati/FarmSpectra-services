const client_id = process.env.ClientID;
const client_secret = process.env.ClientSecret;

const apiBaseURL = process.env.API_BASE_URL;

const copernicusBaseUrl = process.env.copernicusBaseUrl;
const copernicusAuthUrl = process.env.copernicusAuthUrl;
const copernicusProcessUrl = process.env.copernicusProcessUrl;
const copernicusCatalogUrl = process.env.copernicusCatalogUrl;

const pocketbaseUsername = process.env.Pocketbase_Admin_Username;
const pocketbasePassword = process.env.Pocketbase_Admin_Password;

const sentinel_2_l2a_evalScript = `
        //VERSION=3
        function setup() {
            return {
                input: [
                    {
                        bands: [
                            "B02", 
                            "B03", 
                            "B04", 
                            "B05", 
                            "B08", 
                            "B11", 
                            "B12", 
                            "SCL",
                            "CLD"
                        ],
                        units: [
                            "REFLECTANCE", 
                            "REFLECTANCE", 
                            "REFLECTANCE", 
                            "REFLECTANCE", 
                            "REFLECTANCE", 
                            "REFLECTANCE", 
                            "REFLECTANCE", 
                            "DN",
                            "DN"
                        ]
                    }
                ],
                output: {
                    bands: 9,
                    id: "default",
                    sampleType: SampleType.FLOAT32
                },
                mosaicking: Mosaicking.SIMPLE
            };
        }

        function evaluatePixel(sample) {
            return [
                sample.B02,
                sample.B03,
                sample.B04,
                sample.B05,
                sample.B08,
                sample.B11,
                sample.B12,
                sample.SCL,
                sample.CLD
            ];
        }
    `;

export {
    client_id,
    apiBaseURL,
    client_secret,
    copernicusAuthUrl,
    copernicusBaseUrl,
    pocketbaseUsername,
    pocketbasePassword,
    copernicusCatalogUrl,
    copernicusProcessUrl,
    sentinel_2_l2a_evalScript,
};
