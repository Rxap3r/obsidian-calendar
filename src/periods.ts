/** "How long / how far" periods: the standard choices of every period setting, and periods in words. */

/** Standard choices for every "how long / how far" setting (plus "Custom…"), so they all match. */
export const STANDARD_PERIODS: [number, string][] = [
	[7, "7 days"], [14, "2 weeks"], [30, "30 days"], [60, "60 days"], [90, "90 days"], [180, "6 months"], [365, "1 year"],
];

/** 30 → "30 days", 14 → "2 weeks", 365 → "year", 730 → "2 years". */
export function periodLabel(days: number): string {
	if (days % 365 === 0) return days === 365 ? "year" : `${days / 365} years`;
	if (days % 30 === 0 && days >= 60) return `${days / 30} months`;
	if (days % 7 === 0 && days >= 14 && days < 30) return `${days / 7} weeks`;
	return days === 1 ? "day" : `${days} days`;
}

/** "tomorrow", "in the next 7 days", "in the next 2 weeks", "in the next month" … */
export function rangeLabel(days: number): string {
	if (days === 1) return "tomorrow";
	if (days === 30 || days === 31) return "in the next month";
	return `in the next ${periodLabel(days)}`;
}
