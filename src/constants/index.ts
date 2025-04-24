const client_id = process.env.Client_ID;
const client_secret = process.env.Client_Secret;

const imagesURL = process.env.IMAGES_URL;
const apiBaseURL = process.env.API_BASE_URL;
const publicFolder = process.env.Public_Folder;

const databaseUsername = process.env.Database_Admin_Username;
const databasePassword = process.env.Database_Admin_Password;

const copernicusBaseUrl = "https://sh.dataspace.copernicus.eu";
const copernicusProcessUrl =
    "https://sh.dataspace.copernicus.eu/api/v1/process";
const copernicusCatalogUrl =
    "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";
const copernicusAuthUrl =
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

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
    imagesURL,
    apiBaseURL,
    client_id,
    client_secret,
    publicFolder,
    databaseUsername,
    databasePassword,
    copernicusAuthUrl,
    copernicusBaseUrl,
    copernicusCatalogUrl,
    copernicusProcessUrl,
    sentinel_2_l2a_evalScript,
};
