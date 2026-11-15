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
		const list = document.body.createDiv({ cls: "ch-time-list", attr: { role: "listbox" } });
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
		this.position();
		// Scroll so the chosen time (or the nearest one, or the current hour) is visible.
		const target = this.value ?? (this.opts.after?.() ? undefined : fromMin(Math.floor((new Date().getHours() * 60) / STEP) * STEP));
		const el = (target && list.querySelector<HTMLElement>(`[data-value="${target}"]`)) || list.querySelector<HTMLElement>("[data-value]");
		if (el) list.scrollTop = Math.max(0, el.offsetTop - (head?.offsetHeight ?? 0) - (list.clientHeight - (head?.offsetHeight ?? 0)) / 2 + el.offsetHeight / 2);
		el?.addClass("is-active");

		const onDown = (e: PointerEvent) => {
			if (!list.contains(e.target as Node) && e.target !== this.input) this.close();
		};
		const onScroll = (e: Event) => {
			if (!list.contains(e.target as Node)) this.close();
		};
		const onResize = () => this.close();
		document.addEventListener("pointerdown", onDown, true);
		document.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onResize);
		this.cleanup = () => {
			document.removeEventListener("pointerdown", onDown, true);
			document.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onResize);
		};
	}

	close() {
		this.cleanup?.();
		this.cleanup = null;
		this.list?.remove();
		this.list = null;
	}

	/** Below the field (or above it when there's no room), on top of the dialog. */
	private position() {
		const list = this.list;
		if (!list) return;
		const r = this.input.getBoundingClientRect();
		const width = Math.max(r.width, this.opts.after ? 170 : 120);
		const below = window.innerHeight - r.bottom - 8;
		const above = r.top - 8;
		const h = Math.min(240, Math.max(below, above));
		list.style.width = `${width}px`;
		list.style.maxHeight = `${h}px`;
		list.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - width - 8)}px`;
		if (below >= Math.min(240, above) || below >= 160) list.style.top = `${r.bottom + 4}px`;
		else list.style.top = `${Math.max(8, r.top - 4 - Math.min(h, list.scrollHeight))}px`;
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
