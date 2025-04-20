type SatelliteVisitParams = {
    start_date: string;
    revisit_time: number;
    first_visit_date: string;
};

const getSatelliteVisitDates = (obj: SatelliteVisitParams): string[] => {
    const { start_date, revisit_time, first_visit_date } = obj;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);

    const startDate = new Date(start_date.split(" ")[0]);
    const firstVisitDate = new Date(first_visit_date.split(" ")[0]);

    const dates: string[] = [];
    const current = new Date(firstVisitDate);

    while (current <= yesterday) {
        if (current >= startDate) {
            dates.push(current.toISOString().split("T")[0]);
        }
        current.setUTCDate(current.getUTCDate() + revisit_time);
    }

    return dates;
};

export { getSatelliteVisitDates };
