const copernicus_client_id = process.env.Copernicus_Client_ID;
const copernicus_client_secret = process.env.Copernicus_Client_Secret;

const sh_client_id = process.env.SH_Client_ID;
const sh_client_secret = process.env.SH_Client_Secret;

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

const shAuthUrl = "https://services.sentinel-hub.com/oauth/token";
const shProcessUrl = "https://services.sentinel-hub.com/api/v1/process";
const shCatalogUrl =
    "https://services.sentinel-hub.com/api/v1/catalog/1.0.0/search";

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
    publicFolder,
    databaseUsername,
    databasePassword,
    shAuthUrl,
    shCatalogUrl,
    shProcessUrl,
    sh_client_id,
    sh_client_secret,
    copernicusAuthUrl,
    copernicusBaseUrl,
    copernicusCatalogUrl,
    copernicusProcessUrl,
    copernicus_client_id,
    copernicus_client_secret,
    sentinel_2_l2a_evalScript,
};
