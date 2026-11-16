import type OmniCalendarPlugin from "../../main";
import { CalendarOccurrence, ViewMode } from "../../types";
import type { EventDrag } from "./eventDrag";
import type { SlotSelection } from "./slotSelection";

/** What the month, week / day and agenda renderers need from the calendar view they draw into. */
export interface CalendarHost {
	readonly plugin: OmniCalendarPlugin;
	/** The area below the toolbar that the renderers fill. */
	readonly bodyEl: HTMLElement;
	/** The day the view is on: the day shown, or a day inside the shown week / month. */
	cursor: Date;
	/** Day whose events are listed below the compact month grid. */
	monthSelected: Date | null;
	/** Vertical scroll position of the hour grid, kept across re-renders (null = not set yet). */
	scrollTop: number | null;
	/** Current width of the view body, used for responsive layouts. */
	readonly width: number;
	readonly drag: EventDrag;
	readonly slots: SlotSelection;
	/** The text in the toolbar ("November 2026", …). */
	setTitle(text: string): void;
	/** The occurrences in the range, without the calendars hidden by the filter. Drag & drop works with these. */
	occurrences(start: Date, end: Date): CalendarOccurrence[];
	goTo(date: Date, mode?: ViewMode): void;
	render(): void;
}
