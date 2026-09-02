const formatter = new Intl.RelativeTimeFormat("fr-FR", {numeric: "auto"});

const UNITS: {unit: Intl.RelativeTimeFormatUnit; seconds: number}[] = [
    {unit: "year", seconds: 31536000},
    {unit: "month", seconds: 2592000},
    {unit: "day", seconds: 86400},
    {unit: "hour", seconds: 3600},
    {unit: "minute", seconds: 60},
    {unit: "second", seconds: 1},
];

/** Ex. `formatTimeAgo(new Date(Date.now() - 90_000))` -> "il y a 2 minutes". */
export default function formatTimeAgo(date: Date, now: Date = new Date()): string {
    const elapsedSeconds = (date.getTime() - now.getTime()) / 1000;

    for (const {unit, seconds} of UNITS) {
        if (Math.abs(elapsedSeconds) >= seconds || unit === "second") {
            return formatter.format(Math.round(elapsedSeconds / seconds), unit);
        }
    }

    return formatter.format(0, "second");
}
