/** Small helpers without any Obsidian or calendar knowledge. */

/** The readable text of something that was thrown. */
export function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/** "1 task", "3 tasks". */
export function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}
