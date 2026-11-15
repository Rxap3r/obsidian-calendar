import { Platform } from "obsidian";

/**
 * Our own time field, identical on desktop, tablet and phone (the browsers' / Android's native
 * time pickers differ and can be cut off). Shows a list of times in 15-minute steps; on desktop
 * you can also type ("1030", "10:30", "9", "2:30pm"). Values are "HH:MM" (24 h) or undefined.
 */
export interface TimeFieldOptions {
	value?: string;
	placeholder: string;
	use24h: boolean;
	cls?: string;
	/** For an end time: the start, so the list starts after it and shows durations. */
	after?: () => string | undefined;
	onChange: (value: string | undefined) => void;
}

const STEP = 15;

/** "10:30" → minutes since midnight. */
function toMin(v: string): number {
	const [h, m] = v.split(":").map(Number);
	return h * 60 + m;
}
function fromMin(n: number): string {
	const h = Math.floor(n / 60) % 24;
	const m = n % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse what a person typed. Returns "HH:MM" or null. */
export function parseTimeInput(s: string): string | null {
	const t = s.trim().toLowerCase().replace(/\s+/g, "");
	if (!t) return null;
	const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm|a|p)?$/.exec(t);
	if (!m) return null;
	let h = Number(m[1]);
	const min = m[2] ? Number(m[2]) : 0;
	const ap = m[3];
	if (ap) {
		if (h < 1 || h > 12) return null;
		if (ap.startsWith("p") && h < 12) h += 12;
		if (ap.startsWith("a") && h === 12) h = 0;
	}
	if (h > 23 || min > 59) return null;
	return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "14:30" → "14:30" or "2:30 PM". */
export function formatTimeValue(v: string, use24h: boolean): string {
	if (use24h) return v;
	const [h, m] = v.split(":").map(Number);
	const h12 = h % 12 === 0 ? 12 : h % 12;
	return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function durationLabel(min: number): string {
	if (min < 60) return `${min} min`;
	const h = Math.floor(min / 60);
	const r = min % 60;
	return r ? `${h} h ${r} min` : `${h} h`;
}

export class TimeField {
	readonly el: HTMLElement;
	readonly input: HTMLInputElement;
	private value: string | undefined;
	private list: HTMLElement | null = null;
	private cleanup: (() => void) | null = null;

	constructor(parent: HTMLElement, private opts: TimeFieldOptions) {
		this.el = parent.createDiv({ cls: `ch-timefield ${opts.cls ?? ""}`.trim() });
		this.input = this.el.createEl("input", { type: "text", cls: "ch-input ch-timefield-input", attr: { placeholder: opts.placeholder, autocomplete: "off", "aria-haspopup": "listbox" } });
		// Phones: the list is the main way to pick; the keyboard only on request ("Type a time").
		if (Platform.isMobile) this.input.readOnly = true;
		this.input.inputMode = "numeric";
		this.value = opts.value;
		this.show();

		this.input.addEventListener("click", () => this.open());
		this.input.addEventListener("focus", () => {
			if (!Platform.isMobile) this.input.select();
		});
		this.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				e.stopPropagation();
				this.commitTyped();
				this.close();
			} else if (e.key === "Escape") {
				if (this.list) {
					e.preventDefault();
					e.stopPropagation();
					this.show();
					this.close();
				}
			} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				this.open();
				this.moveActive(e.key === "ArrowDown" ? 1 : -1);
			}
		});
		this.input.addEventListener("input", () => this.highlightTyped());
		this.input.addEventListener("blur", () => {
			// Give a click on the list a chance first.
			window.setTimeout(() => {
				if (document.activeElement === this.input) return;
				if (!this.input.readOnly) this.commitTyped();
				if (this.list && !this.list.contains(document.activeElement)) this.close();
			}, 150);
		});
	}

	getValue(): string | undefined {
		return this.value;
	}

	setValue(v: string | undefined, notify = false) {
		this.value = v;
		this.show();
		if (notify) this.opts.onChange(v);
	}

	private show() {
		this.input.value = this.value ? formatTimeValue(this.value, this.opts.use24h) : "";
		this.el.toggleClass("is-empty", !this.value);
	}

	private commitTyped() {
		const raw = this.input.value;
		if (!raw.trim()) {
			if (this.value !== undefined) this.setValue(undefined, true);
			return;
		}
		if (this.value && raw === formatTimeValue(this.value, this.opts.use24h)) return;
		const v = parseTimeInput(raw);
		if (v) this.setValue(v, true);
		else {
			// Not a time: go back to the last good value and flash the field.
			this.show();
			this.el.addClass("ch-invalid");
			window.setTimeout(() => this.el.removeClass("ch-invalid"), 800);
		}
	}

	// ------------------------------------------------------------------ list

	private items(): { value: string; label: string }[] {
		const after = this.opts.after?.();
		const out: { value: string; label: string }[] = [];
		if (after) {
			const a = toMin(after);
			for (let n = Math.ceil((a + 1) / STEP) * STEP; n < 24 * 60; n += STEP) {
				out.push({ value: fromMin(n), label: `${formatTimeValue(fromMin(n), this.opts.use24h)}  ·  ${durationLabel(n - a)}` });
			}
		} else {
			for (let n = 0; n < 24 * 60; n += STEP) out.push({ value: fromMin(n), label: formatTimeValue(fromMin(n), this.opts.use24h) });
		}
		return out;
	}

	open() {
		if (this.list) return;
		const list = createPopup(this.el, "ch-time-list", { role: "listbox" });
		this.list = list;
		// "Type a time" / "No time" stay visible at the top while the times scroll.
		const head = this.input.readOnly || this.value ? list.createDiv({ cls: "ch-time-head" }) : null;
		if (this.input.readOnly && head) {
			const type = head.createEl("button", { cls: "ch-time-item ch-time-type", text: "⌨  Type a time" });
			type.onclick = () => {
				this.input.readOnly = false;
				this.close();
				this.input.focus();
				this.input.select();
			};
		}
		if (this.value && head) {
			const clear = head.createEl("button", { cls: "ch-time-item ch-time-clear", text: "No time" });
			clear.onclick = () => {
				this.setValue(undefined, true);
				this.close();
			};
		}
		const items = this.items();
		for (const it of items) {
			const b = list.createEl("button", { cls: "ch-time-item", text: it.label, attr: { role: "option", "data-value": it.value } });
			if (it.value === this.value) b.addClass("is-selected");
			b.onclick = () => {
				this.setValue(it.value, true);
				this.close();
			};
		}
		// Wide enough for "⌨ Type a time" / durations.
		placePopup(list, this.input, this.opts.after ? 190 : head ? 170 : 140, 240);
		// Scroll so the chosen time (or the nearest one, or the current hour) is visible.
		const target = this.value ?? (this.opts.after?.() ? undefined : fromMin(Math.floor((new Date().getHours() * 60) / STEP) * STEP));
		const el = (target && list.querySelector<HTMLElement>(`[data-value="${target}"]`)) || list.querySelector<HTMLElement>("[data-value]");
		if (el) list.scrollTop = Math.max(0, el.offsetTop - (head?.offsetHeight ?? 0) - (list.clientHeight - (head?.offsetHeight ?? 0)) / 2 + el.offsetHeight / 2);
		el?.addClass("is-active");
		this.cleanup = closeOnOutside(list, this.el, () => this.close());
	}

	close() {
		this.cleanup?.();
		this.cleanup = null;
		this.list?.remove();
		this.list = null;
	}

	private moveActive(dir: number) {
		const list = this.list;
		if (!list) return;
		const all = Array.from(list.querySelectorAll<HTMLElement>("[data-value]"));
		let i = all.findIndex((x) => x.hasClass("is-active"));
		all[i]?.removeClass("is-active");
		i = Math.max(0, Math.min(all.length - 1, i + dir));
		all[i]?.addClass("is-active");
		all[i]?.scrollIntoView({ block: "nearest" });
		if (all[i]) this.input.value = all[i].textContent?.split("  ·  ")[0] ?? "";
	}

	/** While typing on desktop: jump to the closest time in the list. */
	private highlightTyped() {
		if (!this.list) this.open();
		const v = parseTimeInput(this.input.value);
		const list = this.list;
		if (!v || !list) return;
		list.querySelectorAll(".is-active").forEach((x) => x.removeClass("is-active"));
		const near = fromMin(Math.round(toMin(v) / STEP) * STEP);
		const el = list.querySelector<HTMLElement>(`[data-value="${v}"]`) ?? list.querySelector<HTMLElement>(`[data-value="${near}"]`);
		el?.addClass("is-active");
		el?.scrollIntoView({ block: "nearest" });
	}
}

// ====================================================================== shared pop-up helpers

/**
 * Create a pop-up inside the dialog that contains the field (not at the end of the page): Obsidian
 * keeps the focus inside an open dialog and would otherwise move it to the dialog's first field
 * (the title), which opened the keyboard on tablets. Tapping the pop-up also never takes the focus.
 */
function createPopup(field: HTMLElement, cls: string, attr: Record<string, string>): HTMLElement {
	const host = (field.closest(".modal-container") as HTMLElement | null) ?? document.body;
	const popup = host.createDiv({ cls, attr });
	// Keep the focus where it is (buttons in the pop-up would take it); clicks still work.
	popup.addEventListener("pointerdown", (e) => {
		if (!(e.target as HTMLElement).closest("input, textarea")) e.preventDefault();
	});
	popup.addEventListener("mousedown", (e) => e.preventDefault());
	return popup;
}

/** Put a fixed pop-up below the anchor (or above it when there's no room), on top of dialogs. */
function placePopup(popup: HTMLElement, anchor: HTMLElement, width: number, maxHeight: number) {
	const r = anchor.getBoundingClientRect();
	const below = window.innerHeight - r.bottom - 8;
	const above = r.top - 8;
	const h = Math.min(maxHeight, Math.max(below, above));
	popup.style.width = `${Math.min(width, window.innerWidth - 16)}px`;
	popup.style.maxHeight = `${h}px`;
	const w = popup.offsetWidth || width;
	popup.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - w - 8)}px`;
	const need = Math.min(h, popup.scrollHeight);
	if (below >= need || below >= above) popup.style.top = `${r.bottom + 4}px`;
	else popup.style.top = `${Math.max(8, r.top - 4 - need)}px`;
}

/** Close the pop-up when tapping outside it or scrolling the page behind it. Returns the cleanup. */
function closeOnOutside(popup: HTMLElement, anchor: HTMLElement, close: () => void): () => void {
	const onDown = (e: PointerEvent) => {
		if (!popup.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
	};
	const onScroll = (e: Event) => {
		if (!popup.contains(e.target as Node)) close();
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			close();
		}
	};
	document.addEventListener("pointerdown", onDown, true);
	document.addEventListener("scroll", onScroll, true);
	document.addEventListener("keydown", onKey, true);
	window.addEventListener("resize", close);
	return () => {
		document.removeEventListener("pointerdown", onDown, true);
		document.removeEventListener("scroll", onScroll, true);
		document.removeEventListener("keydown", onKey, true);
		window.removeEventListener("resize", close);
	};
}

// ====================================================================== date field

export interface DateFieldOptions {
	value?: string;
	placeholder: string;
	/** 0 = Sunday, 1 = Monday, … (the "First day of the week" setting). */
	firstDayOfWeek: number;
	cls?: string;
	/** Show a "No date" button in the calendar. */
	allowEmpty?: boolean;
	onChange: (value: string | undefined) => void;
}

function pad(n: number) {
	return String(n).padStart(2, "0");
}
function keyOf(d: Date) {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromKey(k: string): Date {
	const [y, m, d] = k.split("-").map(Number);
	return new Date(y, m - 1, d);
}

/** "Sat, 14 Nov 2026" in the user's language. */
export function formatDateValue(v: string): string {
	return fromKey(v).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/**
 * Our own date field with a small month calendar, identical on every device (instead of the
 * browser's / Android's / iOS's date dialogs). Values are "YYYY-MM-DD" or undefined.
 */
export class DateField {
	readonly el: HTMLElement;
	readonly button: HTMLButtonElement;
	private value: string | undefined;
	private popup: HTMLElement | null = null;
	private month: Date = new Date();
	private cleanup: (() => void) | null = null;

	constructor(parent: HTMLElement, private opts: DateFieldOptions) {
		this.el = parent.createDiv({ cls: `ch-datefield ${opts.cls ?? ""}`.trim() });
		this.button = this.el.createEl("button", { cls: "ch-input ch-datefield-btn", attr: { type: "button", "aria-haspopup": "dialog" } });
		this.value = opts.value;
		this.show();
		this.button.addEventListener("click", (e) => {
			e.preventDefault();
			if (this.popup) this.close();
			else this.open();
		});
	}

	getValue(): string | undefined {
		return this.value;
	}

	setValue(v: string | undefined, notify = false) {
		this.value = v;
		this.show();
		if (notify) this.opts.onChange(v);
	}

	private show() {
		this.button.setText(this.value ? formatDateValue(this.value) : this.opts.placeholder);
		this.el.toggleClass("is-empty", !this.value);
	}

	open() {
		if (this.popup) return;
		const base = this.value ? fromKey(this.value) : new Date();
		this.month = new Date(base.getFullYear(), base.getMonth(), 1);
		this.popup = createPopup(this.el, "ch-date-popup", { role: "dialog", "aria-label": "Choose a date" });
		this.renderMonth();
		placePopup(this.popup, this.button, 280, 400);
		this.cleanup = closeOnOutside(this.popup, this.el, () => this.close());
	}

	close() {
		this.cleanup?.();
		this.cleanup = null;
		this.popup?.remove();
		this.popup = null;
	}

	private renderMonth() {
		const p = this.popup;
		if (!p) return;
		p.empty();
		const head = p.createDiv({ cls: "ch-date-head" });
		const prev = head.createEl("button", { cls: "ch-date-nav", text: "‹", attr: { "aria-label": "Previous month", type: "button" } });
		head.createDiv({ cls: "ch-date-title", text: this.month.toLocaleDateString(undefined, { month: "long", year: "numeric" }) });
		const next = head.createEl("button", { cls: "ch-date-nav", text: "›", attr: { "aria-label": "Next month", type: "button" } });
		prev.onclick = () => this.shift(-1);
		next.onclick = () => this.shift(1);

		const grid = p.createDiv({ cls: "ch-date-grid" });
		const fdw = this.opts.firstDayOfWeek;
		for (let i = 0; i < 7; i++) {
			const d = new Date(2026, 1, 1 + ((fdw + i) % 7)); // 1 Feb 2026 is a Sunday
			grid.createDiv({ cls: "ch-date-wd", text: d.toLocaleDateString(undefined, { weekday: "narrow" }) });
		}
		const first = new Date(this.month);
		const offset = (first.getDay() - fdw + 7) % 7;
		const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
		const today = keyOf(new Date());
		for (let i = 0; i < 42; i++) {
			const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
			if (i === 35 && d.getMonth() !== this.month.getMonth()) break; // skip a 6th row that is entirely next month
			const k = keyOf(d);
			const b = grid.createEl("button", { cls: "ch-date-day", text: String(d.getDate()), attr: { type: "button", "data-date": k } });
			if (d.getMonth() !== this.month.getMonth()) b.addClass("ch-other-month");
			if (k === today) b.addClass("ch-today");
			if (k === this.value) b.addClass("is-selected");
			b.onclick = () => {
				this.setValue(k, true);
				this.close();
			};
		}

		const foot = p.createDiv({ cls: "ch-date-foot" });
		const todayBtn = foot.createEl("button", { text: "Today", attr: { type: "button" } });
		todayBtn.onclick = () => {
			this.setValue(today, true);
			this.close();
		};
		if (this.opts.allowEmpty) {
			const none = foot.createEl("button", { text: "No date", attr: { type: "button" } });
			none.onclick = () => {
				this.setValue(undefined, true);
				this.close();
			};
		}
	}

	private shift(months: number) {
		this.month = new Date(this.month.getFullYear(), this.month.getMonth() + months, 1);
		this.renderMonth();
		if (this.popup) placePopup(this.popup, this.button, 280, 400);
	}
}

/**
 * Buttons in a dialog don't take the focus when tapped. Otherwise a button that disappears after
 * the tap (re-rendered rows, closed pop-ups) leaves the dialog without focus, and Obsidian then
 * focuses the first field (the title), which opens the keyboard on tablets and phones.
 */
export function keepFocusOnTap(container: HTMLElement) {
	container.addEventListener("pointerdown", (e) => {
		const t = e.target as HTMLElement;
		if (t.closest("button, .ch-target-chip") && !t.closest("input, textarea, select")) e.preventDefault();
	});
}
