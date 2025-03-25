import { fromFile } from "geotiff";

const L = 0.5; // Soil brightness correction factor

async function processTiff(filePath: string) {
    const tiff = await fromFile(filePath);
    const rasters: Array<Array<number>> = await tiff.readRasters();

    // B02  - blue     10m  0
    // B03  - green    10m  1
    // B04  - red      10m  2
    // B05  - redEdge  20m  3
    // B08  - NIR      10m  4
    // B011 - SWIR     20m  5
    // B012 - SWIR     20m  6

    const green = rasters[1];
    const red = rasters[2];
    const NIR = rasters[4];
    const SWIR1 = rasters[5];

    const ndvi = new Float32Array(red.length);
    const savi = new Float32Array(NIR.length);

    // NDVI
    for (let i = 0; i < red.length; i++) {
        if (NIR[i] + red[i] === 0) {
            ndvi[i] = NaN;
        } else {
            ndvi[i] = (NIR[i] - red[i]) / (NIR[i] + red[i]);
        }
    }

    // SAVI
    for (let i = 0; i < NIR.length; i++) {
        if (NIR[i] === 0 || red[i] === 0) {
            savi[i] = NaN;
        } else {
            savi[i] = ((NIR[i] - red[i]) * (1 + L)) / (NIR[i] + red[i] + L);
        }
    }

    // // NDBI
    // for (let i = 0; i < NIR.length; i++) {
    //     if (SWIR[i] + NIR[i] === 0) {
    //         ndbi[i] = NaN;
    //     } else {
    //         ndbi[i] = (SWIR[i] - NIR[i]) / (SWIR[i] + NIR[i]);
    //     }
    // }

    // Function to calculate average ignoring NaNs
    function calculateAverage(arr: Float32Array) {
        const validValues = arr.filter((value) => !isNaN(value));
        const sum = validValues.reduce(
            (acc, currentValue) => acc + currentValue,
            0
        );
        return sum / validValues.length;
    }

    const avgNDVI = calculateAverage(ndvi);
    const avgSAVI = calculateAverage(savi);
    // const avgNDBI = calculateAverage(ndbi);

    console.log({
        NDVI: avgNDVI.toPrecision(2),
        SAVI: avgSAVI.toPrecision(2),
    });

    // NDBI: avgNDBI.toPrecision(2),
    // mNDBI: (avgNDBI - avgNDVI).toPrecision(2),
    // BUI: (avgNDBI - avgSAVI).toPrecision(2),
}

// Call the function with your file path
processTiff("./sentinel_image.tif");
