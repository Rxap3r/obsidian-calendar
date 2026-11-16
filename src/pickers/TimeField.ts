import { Platform } from "obsidian";
import { formatTimeKey, minutesToTimeKey, pad, timeKeyToMinutes } from "../dateUtils";
import { closeOnOutside, createPopup, placePopup } from "./popup";

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
	return `${pad(h)}:${pad(min)}`;
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
		this.input.value = this.value ? formatTimeKey(this.value, this.opts.use24h) : "";
		this.el.toggleClass("is-empty", !this.value);
	}

	private commitTyped() {
		const raw = this.input.value;
		if (!raw.trim()) {
			if (this.value !== undefined) this.setValue(undefined, true);
			return;
		}
		if (this.value && raw === formatTimeKey(this.value, this.opts.use24h)) return;
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
			const a = timeKeyToMinutes(after);
			for (let n = Math.ceil((a + 1) / STEP) * STEP; n < 24 * 60; n += STEP) {
				out.push({ value: minutesToTimeKey(n), label: `${formatTimeKey(minutesToTimeKey(n), this.opts.use24h)}  ·  ${durationLabel(n - a)}` });
			}
		} else {
			for (let n = 0; n < 24 * 60; n += STEP) out.push({ value: minutesToTimeKey(n), label: formatTimeKey(minutesToTimeKey(n), this.opts.use24h) });
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
		const target = this.value ?? (this.opts.after?.() ? undefined : minutesToTimeKey(Math.floor((new Date().getHours() * 60) / STEP) * STEP));
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
		const near = minutesToTimeKey(Math.round(timeKeyToMinutes(v) / STEP) * STEP);
		const el = list.querySelector<HTMLElement>(`[data-value="${v}"]`) ?? list.querySelector<HTMLElement>(`[data-value="${near}"]`);
		el?.addClass("is-active");
		el?.scrollIntoView({ block: "nearest" });
	}
}
