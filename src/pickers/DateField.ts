import { parseLocal, toDateKey } from "../dateUtils";
import { closeOnOutside, createPopup, placePopup } from "./popup";

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

/** "Sat, 14 Nov 2026" in the user's language. */
export function formatDateValue(v: string): string {
	return parseLocal(v).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
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
		const base = this.value ? parseLocal(this.value) : new Date();
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
		const today = toDateKey(new Date());
		for (let i = 0; i < 42; i++) {
			const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
			if (i === 35 && d.getMonth() !== this.month.getMonth()) break; // skip a 6th row that is entirely next month
			const k = toDateKey(d);
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
