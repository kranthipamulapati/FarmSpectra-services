const getUTCDate = (date) => {
    return new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            0,
            0,
            0,
            0
        )
    ).toISOString();
};

function getUTCRange(date) {
    const startTime = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            0,
            0,
            0,
            0
        )
    ).toUTCString();

    const endTime = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            23,
            59,
            59,
            999
        )
    ).toISOString();

    return { startTime, endTime };
}

export { getUTCDate, getUTCRange };
