const client_id = process.env.ClientID;
const apiBaseURL = process.env.API_BASE_URL;
const client_secret = process.env.ClientSecret;
const pocketbaseUsername = process.env.Pocketbase_Admin_Username;
const pocketbasePassword = process.env.Pocketbase_Admin_Password;

const ndviColorRanges = [
    { min: null, max: -1.1, hex: "#AC0028" },
    { min: -1.1, max: -0.2, hex: "#B3002B" },
    { min: -0.2, max: -0.1, hex: "#C1002F" },
    { min: -0.1, max: 0, hex: "#D20034" },
    { min: 0, max: 0.025, hex: "#E30039" },
    { min: 0.025, max: 0.05, hex: "#F3003D" },
    { min: 0.05, max: 0.075, hex: "#E74C39" },
    { min: 0.075, max: 0.1, hex: "#EC5B3E" },
    { min: 0.1, max: 0.125, hex: "#F26C43" },
    { min: 0.125, max: 0.15, hex: "#F57B49" },
    { min: 0.15, max: 0.175, hex: "#F98A4E" },
    { min: 0.175, max: 0.2, hex: "#FB9F53" },
    { min: 0.2, max: 0.25, hex: "#FCAE58" },
    { min: 0.25, max: 0.3, hex: "#FDB65E" },
    { min: 0.3, max: 0.35, hex: "#FDC463" },
    { min: 0.35, max: 0.4, hex: "#D2E58C" },
    { min: 0.4, max: 0.45, hex: "#E1F18F" },
    { min: 0.45, max: 0.5, hex: "#B9E484" },
    { min: 0.5, max: 0.55, hex: "#92D875" },
    { min: 0.55, max: 0.6, hex: "#7ABF6E" },
    { min: 0.6, max: 0.65, hex: "#67A86A" },
    { min: 0.65, max: 0.7, hex: "#529E61" },
    { min: 0.7, max: 0.75, hex: "#3A9957" },
    { min: 0.75, max: 0.8, hex: "#268D4E" },
    { min: 0.8, max: 0.85, hex: "#178C44" },
    { min: 0.85, max: 0.9, hex: "#158C42" },
    { min: 0.9, max: 0.95, hex: "#0F8C40" },
    { min: 0.95, max: null, hex: "#0F8C40" },
];

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
    apiBaseURL,
    client_id,
    client_secret,
    ndviColorRanges,
    pocketbaseUsername,
    pocketbasePassword,
    sentinel_2_l2a_evalScript,
};
