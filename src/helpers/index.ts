type SatelliteVisitParams = {
    end_date: string;
    start_date: string;
    revisit_time: number;
    first_visit_date: string;
};

const getSatelliteVisitDates = (obj: SatelliteVisitParams): string[] => {
    const { end_date, start_date, revisit_time, first_visit_date } = obj;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);

    const endDate = new Date(end_date.split(" ")[0]);
    const startDate = new Date(start_date.split(" ")[0]);
    const firstVisitDate = new Date(first_visit_date.split(" ")[0]);

    const limitDate = endDate < yesterday ? endDate : yesterday;

    const dates: string[] = [];
    const current = new Date(firstVisitDate);

    while (current <= limitDate) {
        if (current >= startDate) {
            dates.push(current.toISOString().split("T")[0]);
        }

        current.setUTCDate(current.getUTCDate() + revisit_time);
    }

    return dates;
};

export { getSatelliteVisitDates };
