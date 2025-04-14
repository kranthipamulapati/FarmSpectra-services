const client_id = process.env.ClientID;
const apiBaseURL = process.env.API_BASE_URL;
const client_secret = process.env.ClientSecret;
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

const eviColorRanges = [
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

const gciColorRanges = [
    { min: null, max: 0.0, hex: "#AC0028" }, // Dark red
    { min: 0.0, max: 0.1, hex: "#E34A33" }, // Red-orange
    { min: 0.1, max: 0.2, hex: "#F46D43" },
    { min: 0.2, max: 0.3, hex: "#FDAE61" },
    { min: 0.3, max: 0.4, hex: "#FEE08B" },
    { min: 0.4, max: 0.5, hex: "#D9EF8B" },
    { min: 0.5, max: 0.6, hex: "#A6D96A" },
    { min: 0.6, max: 0.8, hex: "#66BD63" },
    { min: 0.8, max: 1.0, hex: "#1A9850" },
    { min: 1.0, max: 1.5, hex: "#006837" }, // Dark green
    { min: 1.5, max: null, hex: "#004529" }, // Very dark green
];

const redEdgeCIRanges = [
    { min: null, max: 0.0, hex: "#AC0028" }, // Very low
    { min: 0.0, max: 0.2, hex: "#E34A33" },
    { min: 0.2, max: 0.4, hex: "#F46D43" },
    { min: 0.4, max: 0.6, hex: "#FDAE61" },
    { min: 0.6, max: 0.8, hex: "#FEE08B" },
    { min: 0.8, max: 1.0, hex: "#D9EF8B" },
    { min: 1.0, max: 1.2, hex: "#A6D96A" },
    { min: 1.2, max: 1.5, hex: "#66BD63" },
    { min: 1.5, max: 1.8, hex: "#1A9850" },
    { min: 1.8, max: 2.0, hex: "#006837" },
    { min: 2.0, max: null, hex: "#004529" }, // Very high chlorophyll
];

const variColorRanges = [
    { min: null, max: -0.2, hex: "#AC0028" },
    { min: -0.2, max: -0.1, hex: "#D73027" },
    { min: -0.1, max: 0.0, hex: "#F46D43" },
    { min: 0.0, max: 0.1, hex: "#FDAE61" },
    { min: 0.1, max: 0.2, hex: "#FEE08B" },
    { min: 0.2, max: 0.3, hex: "#D9EF8B" },
    { min: 0.3, max: 0.4, hex: "#A6D96A" },
    { min: 0.4, max: 0.5, hex: "#66BD63" },
    { min: 0.5, max: null, hex: "#1A9850" },
];

const laiColorRanges = [
    { min: null, max: 0, hex: "#fef0d9" },
    { min: 0, max: 1, hex: "#fdcc8a" },
    { min: 1, max: 2, hex: "#fc8d59" },
    { min: 2, max: 3, hex: "#e34a33" },
    { min: 3, max: 4, hex: "#b30000" },
    { min: 4, max: 5, hex: "#7f0000" },
    { min: 5, max: null, hex: "#4d0000" },
];

const sipiColorRanges = [
    { min: null, max: 0.5, hex: "#762a83" },
    { min: 0.5, max: 0.8, hex: "#af8dc3" },
    { min: 0.8, max: 1.1, hex: "#e7d4e8" },
    { min: 1.1, max: 1.4, hex: "#d9f0d3" },
    { min: 1.4, max: 1.7, hex: "#7fbf7b" },
    { min: 1.7, max: 2.0, hex: "#1b7837" },
    { min: 2.0, max: null, hex: "#00441b" },
];

const cciColorRanges = [
    { min: null, max: 1, hex: "#ffffe5" },
    { min: 1, max: 2, hex: "#f7fcb9" },
    { min: 2, max: 3, hex: "#d9f0a3" },
    { min: 3, max: 4, hex: "#addd8e" },
    { min: 4, max: 5, hex: "#78c679" },
    { min: 5, max: 6, hex: "#41ab5d" },
    { min: 6, max: null, hex: "#238443" },
];

const psriColorRanges = [
    { min: null, max: -0.2, hex: "#1a9850" },
    { min: -0.2, max: 0.0, hex: "#91cf60" },
    { min: 0.0, max: 0.2, hex: "#d9ef8b" },
    { min: 0.2, max: 0.4, hex: "#fee08b" },
    { min: 0.4, max: 0.6, hex: "#fc8d59" },
    { min: 0.6, max: null, hex: "#d73027" },
];

const tviColorRanges = [
    { min: null, max: 1000, hex: "#ffffcc" },
    { min: 1000, max: 2000, hex: "#a1dab4" },
    { min: 2000, max: 3000, hex: "#41b6c4" },
    { min: 3000, max: 4000, hex: "#2c7fb8" },
    { min: 4000, max: null, hex: "#253494" },
];

const mtvi2ColorRanges = [
    { min: null, max: -0.2, hex: "#762a83" },
    { min: -0.2, max: 0.0, hex: "#af8dc3" },
    { min: 0.0, max: 0.2, hex: "#e7d4e8" },
    { min: 0.2, max: 0.4, hex: "#d9f0d3" },
    { min: 0.4, max: 0.6, hex: "#7fbf7b" },
    { min: 0.6, max: null, hex: "#1b7837" },
];

const nddiColorRanges = [
    { min: null, max: -0.2, hex: "#2c7bb6" },
    { min: -0.2, max: 0.0, hex: "#abd9e9" },
    { min: 0.0, max: 0.2, hex: "#ffffbf" },
    { min: 0.2, max: 0.4, hex: "#fdae61" },
    { min: 0.4, max: null, hex: "#d7191c" },
];

const msiColorRanges = [
    { min: null, max: 0.2, hex: "#1a9850" },
    { min: 0.2, max: 0.4, hex: "#66bd63" },
    { min: 0.4, max: 0.6, hex: "#a6d96a" },
    { min: 0.6, max: 0.8, hex: "#fdae61" },
    { min: 0.8, max: 1.0, hex: "#f46d43" },
    { min: 1.0, max: null, hex: "#d73027" },
];

export {
    apiBaseURL,
    client_id,
    client_secret,
    eviColorRanges,
    ndviColorRanges,
    pocketbaseUsername,
    pocketbasePassword,
    gciColorRanges,
    redEdgeCIRanges,
    variColorRanges,
    laiColorRanges,
    sipiColorRanges,
    cciColorRanges,
    psriColorRanges,
    tviColorRanges,
    mtvi2ColorRanges,
    nddiColorRanges,
    msiColorRanges,
    sentinel_2_l2a_evalScript,
};
