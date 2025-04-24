import axios from "axios";
import sharp from "sharp";
import { fromFile, type TypedArray } from "geotiff";

import {
    convertCoordsToPolygon,
    generateColorMapImage,
    getHeightAndWidthInPixels,
} from "../../utils";

const clientId = process.env.SH_Client_ID;
const clientSecret = process.env.SH_Client_Secret;

const coordinates = [
    {
        lat: 17.06710318915185,
        lng: 80.1617364437964,
    },
    {
        lat: 17.068580098596637,
        lng: 80.18564029053712,
    },
    {
        lat: 17.048640835196842,
        lng: 80.18744273499513,
    },
    {
        lat: 17.046548319942133,
        lng: 80.16456885651613,
    },
];

const color_matrix = [
    {
        min: null,
        max: -1.1,
        hex: "#AC0028",
    },
    {
        min: -1.1,
        max: -0.2,
        hex: "#B3002B",
    },
    {
        min: -0.2,
        max: -0.1,
        hex: "#C1002F",
    },
    {
        min: -0.1,
        max: 0,
        hex: "#D20034",
    },
    {
        min: 0,
        max: 0.025,
        hex: "#E30039",
    },
    {
        min: 0.025,
        max: 0.05,
        hex: "#F3003D",
    },
    {
        min: 0.05,
        max: 0.075,
        hex: "#E74C39",
    },
    {
        min: 0.075,
        max: 0.1,
        hex: "#EC5B3E",
    },
    {
        min: 0.1,
        max: 0.125,
        hex: "#F26C43",
    },
    {
        min: 0.125,
        max: 0.15,
        hex: "#F57B49",
    },
    {
        min: 0.15,
        max: 0.175,
        hex: "#F98A4E",
    },
    {
        min: 0.175,
        max: 0.2,
        hex: "#FB9F53",
    },
    {
        min: 0.2,
        max: 0.25,
        hex: "#FCAE58",
    },
    {
        min: 0.25,
        max: 0.3,
        hex: "#FDB65E",
    },
    {
        min: 0.3,
        max: 0.35,
        hex: "#FDC463",
    },
    {
        min: 0.35,
        max: 0.4,
        hex: "#D2E58C",
    },
    {
        min: 0.4,
        max: 0.45,
        hex: "#E1F18F",
    },
    {
        min: 0.45,
        max: 0.5,
        hex: "#B9E484",
    },
    {
        min: 0.5,
        max: 0.55,
        hex: "#92D875",
    },
    {
        min: 0.55,
        max: 0.6,
        hex: "#7ABF6E",
    },
    {
        min: 0.6,
        max: 0.65,
        hex: "#67A86A",
    },
    {
        min: 0.65,
        max: 0.7,
        hex: "#529E61",
    },
    {
        min: 0.7,
        max: 0.75,
        hex: "#3A9957",
    },
    {
        min: 0.75,
        max: 0.8,
        hex: "#268D4E",
    },
    {
        min: 0.8,
        max: 0.85,
        hex: "#178C44",
    },
    {
        min: 0.85,
        max: 0.9,
        hex: "#158C42",
    },
    {
        min: 0.9,
        max: 0.95,
        hex: "#0F8C40",
    },
    {
        min: 0.95,
        max: null,
        hex: "#0F8C40",
    },
];

const transformedCoordinates = convertCoordsToPolygon(coordinates);
const { height, width } = getHeightAndWidthInPixels(transformedCoordinates);

const evalscript = `
    //VERSION=3
    function setup() {
        return {
            input: [{
                bands: [
                    "red", 
                    "blue", 
                    "green",
                    "nir",
                ],
                units: [
                    "DN", 
                    "DN", 
                    "DN", 
                    "DN",
                ]
            }],
            output: { 
                bands: 4,  
                id: "default",
                sampleType: SampleType.FLOAT32 
            },
            mosaicking: Mosaicking.SIMPLE
        };
    }

    function evaluatePixel(sample) {
        return [
            sample.red, 
            sample.blue, 
            sample.green,
            sample.nir,
        ];
    }
`;

export async function getToken(clientId: string, clientSecret: string) {
    const response = await fetch(
        "https://services.sentinel-hub.com/oauth/token",
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "client_credentials",
            }),
        }
    );

    const data = await response.json();
    return data.access_token;
}

async function downloadImage() {
    try {
        const token = await getToken(clientId, clientSecret);

        const request = {
            input: {
                bounds: {
                    geometry: {
                        type: "Polygon",
                        coordinates: [transformedCoordinates],
                    },
                    properties: {
                        crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
                    },
                },
                data: [
                    {
                        dataFilter: {
                            timeRange: {
                                from: "2022-05-28T00:00:00Z",
                                to: "2022-05-28T23:59:59Z",
                            },
                        },
                        processing: {
                            harmonizeValues: false,
                        },
                        type: "BYOC-28eef896-9632-4546-a99e-cea34d74b21e",
                    },
                ],
            },
            output: {
                width,
                height,
                responses: [
                    {
                        identifier: "default",
                        format: { type: "image/tiff" },
                    },
                ],
            },
            evalscript: evalscript,
        };

        const response = await axios.post(
            "https://services.sentinel-hub.com/api/v1/process",
            request,
            {
                headers: {
                    Accept: "image/tiff",
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                responseType: "arraybuffer",
            }
        );

        await Bun.write("./planet_image.tiff", response.data);
    } catch (err) {
        if (axios.isAxiosError(err)) {
            console.error("Error status:", err.response?.status);
            console.error("Error data:", err.response?.data);
        } else {
            console.error("Unexpected error:", err);
        }
    }
}

//downloadImage();

const scale = (value: number) =>
    Math.min(255, Math.max(0, (value / 10000) * 255));

const processTiff = async () => {
    try {
        const tiff = await fromFile(`./planet_image.tiff`);
        const image = await tiff.getImage();
        const rasters = await image.readRasters();

        const width = image.getWidth();
        const height = image.getHeight();

        const redBand = rasters[0] as TypedArray;
        const blueBand = rasters[1] as TypedArray;
        const greenBand = rasters[2] as TypedArray;
        const nirBand = rasters[3] as TypedArray;

        const ndviData = new Float32Array(width * height);

        const rgbBuffer = Buffer.alloc(width * height * 3);

        for (let i = 0; i < width * height; i++) {
            rgbBuffer[i * 3 + 0] = scale(redBand[i]); // Red
            rgbBuffer[i * 3 + 2] = scale(blueBand[i]); // Blue
            rgbBuffer[i * 3 + 1] = scale(greenBand[i]); // Green
        }

        await sharp(rgbBuffer, {
            raw: {
                width,
                height,
                channels: 3,
            },
        })
            .modulate({
                brightness: 5, // Brighten
                saturation: 5, // Slight color boost
            })
            .png()
            .toFile("planet_image_rgb.png");

        for (let i = 0; i < height * width; i++) {
            const nir = nirBand[i];
            const red = redBand[i];
            const blue = blueBand[i];
            const green = greenBand[i];

            const denominator = nir + red;

            ndviData[i] = denominator === 0 ? 0 : (nir - red) / denominator;
        }

        generateColorMapImage({
            width,
            height,
            data: ndviData,
            colorMatrix: color_matrix,
            filePath: `planet_image_ndvi.png`,
        });
    } catch (err) {
        console.log(err);
    }
};

processTiff();
