import type OmniCalendarPlugin from "./main";
import { confirmAction } from "./modals/ConfirmModal";

/** Where the lock is remembered: Obsidian's per-device storage (not data.json, which syncs between devices). */
const KEY = "omni-calendar-locked";

/**
 * "Lock calendar" (1.9.4): protects against accidental changes in the calendar – no dragging, no resizing by the edges,
 * no creating events by tapping / dragging on the grid or double-clicking a day. Clicking an event still opens it, and
 * Edit still works. Stored per device, so a phone can be locked while the computer isn't.
 */
export class CalendarLock {
	private value: boolean;

	constructor(private plugin: OmniCalendarPlugin) {
		this.value = this.read();
	}

	get locked(): boolean {
		return this.value;
	}

	set(locked: boolean) {
		if (locked === this.value) return;
		this.value = locked;
		try {
			this.plugin.app.saveLocalStorage(KEY, locked ? "1" : null);
		} catch {
			/* not stored: still locked until Obsidian restarts */
		}
		// Redraw the calendars: drag handles, resize edges and the title icon follow the lock.
		this.plugin.store.notify();
	}

	/** Lock, or unlock. `ask`: unlocking asks first (the lock icon next to the view's title). */
	async toggle(ask = false) {
		if (this.value && ask) {
			const ok = await confirmAction(this.plugin.app, "Unlock the calendar?",
				"Events can then be dragged, resized and created by tapping in the calendar again.", "Unlock");
			if (!ok) return;
		}
		this.set(!this.value);
	}

	private read(): boolean {
		try {
			return !!this.plugin.app.loadLocalStorage(KEY);
		} catch {
			return false;
		}
	}
}
