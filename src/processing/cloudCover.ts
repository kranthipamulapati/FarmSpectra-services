import { fromFile } from "geotiff";

function calculateAverage(arr: Float32Array) {
    const validValues = arr.filter((value) => !isNaN(value));

    const sum = validValues.reduce(
        (acc, currentValue) => acc + currentValue,
        0
    );

    return sum / validValues.length;
}

async function processTiff(filePath: string) {
    const tiff = await fromFile(filePath);
    const rasters: Array<Array<number>> = await tiff.readRasters();

    const SCL = rasters[7];
    const CLD = rasters[8];

    const cloudMaskSCL = new Float32Array(SCL.length);
    const cloudMaskCLD = new Float32Array(CLD.length);

    for (let i = 0; i < SCL.length; i++) {
        // Count all types of clouds plus cloud shadows
        cloudMaskSCL[i] = SCL[i] >= 7 ? 1 : 0;
    }

    // Cloud mask using CLD (threshold at 70%)
    for (let i = 0; i < CLD.length; i++) {
        cloudMaskCLD[i] = CLD[i] > 50 ? 1 : 0;
    }

    // Function to calculate average ignoring NaNs
    const cloudCoverageSCL = calculateAverage(cloudMaskSCL) * 100; // Convert to percentage
    const cloudCoverageCLD = calculateAverage(cloudMaskCLD) * 100; // Convert to percentage

    console.log({
        "Cloud Coverage (SCL)": cloudCoverageSCL.toPrecision(4) + "%",
        "Cloud Coverage (CLD)": cloudCoverageCLD.toPrecision(4) + "%",
    });
}

// Call the function with your file path
processTiff(
    "C:/Users/kranthi/Desktop/Projects/FarmSpectra/services/images/5qo7qr727k7q3mi/2025-04-12/sentinel-2-l2a/tiff.tif"
);
