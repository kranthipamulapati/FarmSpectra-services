function getSatelliteVisitDates({
    start_date,
    revisit_time,
    first_visit_date,
}: {
    start_date: string;
    revisit_time: number;
    first_visit_date: string;
}): string[] {
    // check dates until yesterday
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const startDate = new Date(start_date);
    const firstVisitDate = new Date(first_visit_date);

    const visitDates: string[] = [];
    let currentVisit = new Date(firstVisitDate);
    let i = 1;

    while (currentVisit <= yesterday) {
        if (currentVisit >= startDate) {
            visitDates.push(currentVisit.toISOString().split("T")[0]); // Proper UTC date
        }
        currentVisit.setUTCDate(currentVisit.getUTCDate() + revisit_time);
    }

    return visitDates;
}

export { getSatelliteVisitDates };
