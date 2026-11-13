import { Modal, Notice, Setting } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarStore } from "../store";
import { LocalEvent, Recurrence, RecurrenceFreq } from "../types";
import { addDays, addMinutes, isValidDate, parseLocal, toDateKey, toTimeKey } from "../dateUtils";

export interface EventModalInit {
	/** Existing event to edit. */
	event?: LocalEvent;
	/** For recurring events: the occurrence the user clicked (YYYY-MM-DD). */
	occurrenceDate?: string;
	/** Defaults for a new event. */
	start?: Date;
	end?: Date;
	allDay?: boolean;
	title?: string;
	location?: string;
	description?: string;
	calendarId?: string;
	/** Link a new event to an existing note. */
	notePath?: string;
}

/** Create / edit a local event. */
export class EventModal extends Modal {
	private title: string;
	private calendarId: string;
	private allDay: boolean;
	private startDate: string;
	private startTime: string;
	private endDate: string;
	private endTime: string;
	private location: string;
	private description: string;
	private freq: RecurrenceFreq | "none";
	private interval: number;
	private endsMode: "never" | "until" | "count";
	private until: string;
	private count: number;

	private timeEls: HTMLElement[] = [];
	private recurEls: HTMLElement[] = [];

	constructor(private plugin: OmniCalendarPlugin, private init: EventModalInit = {}) {
		super(plugin.app);
		const ev = init.event;
		const store = plugin.store;
		if (ev) {
			const { start, end } = CalendarStore.bounds(ev);
			this.title = ev.title;
			this.calendarId = ev.calendarId;
			this.allDay = ev.allDay;
			this.startDate = toDateKey(start);
			this.startTime = toTimeKey(start);
			this.endDate = ev.allDay ? toDateKey(addDays(end, -1)) : toDateKey(end);
			this.endTime = toTimeKey(end);
			this.location = ev.location ?? "";
			this.description = ev.description ?? "";
			this.freq = ev.recurrence?.freq ?? "none";
			this.interval = ev.recurrence?.interval ?? 1;
			this.until = ev.recurrence?.until ?? "";
			this.count = ev.recurrence?.count ?? 10;
			this.endsMode = ev.recurrence?.until ? "until" : ev.recurrence?.count ? "count" : "never";
		} else {
			const day = init.start ?? new Date();
			// A start without an explicit end and at midnight means "a day was picked, not a time".
			const timeGiven = !!init.start && (!!init.end || day.getHours() + day.getMinutes() > 0);
			let start: Date;
			let end: Date;
			if (timeGiven && !init.allDay) {
				start = day;
				end = init.end ?? addMinutes(start, plugin.settings.defaultEventDuration);
			} else {
				({ start, end } = store.defaultTimes(day));
			}
			this.title = init.title ?? "";
			this.calendarId = init.calendarId ?? store.defaultLocalSource()?.id ?? "";
			this.allDay = init.allDay ?? false;
			this.startDate = toDateKey(this.allDay ? day : start);
			this.startTime = toTimeKey(start);
			this.endDate = this.allDay
				? toDateKey(init.end ? addDays(init.end, -1) : day)
				: toDateKey(end);
			this.endTime = toTimeKey(end);
			this.location = init.location ?? "";
			this.description = init.description ?? "";
			this.freq = "none";
			this.interval = 1;
			this.until = "";
			this.count = 10;
			this.endsMode = "never";
		}
	}

	onOpen() {
		const { contentEl } = this;
		this.modalEl.addClass("ch-event-modal");
		this.setTitle(this.init.event ? "Edit event" : "New event");

		if (this.init.event?.recurrence) {
			contentEl.createDiv({ cls: "ch-modal-hint", text: "This is a recurring event. Changes apply to all occurrences." });
		}

		new Setting(contentEl).setName("Title").addText((t) => {
			t.setPlaceholder("Event title").setValue(this.title).onChange((v) => (this.title = v));
			t.inputEl.addClass("ch-title-input");
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void this.save();
				}
			});
			window.setTimeout(() => t.inputEl.focus(), 10);
		});

		const locals = this.plugin.store.localSources();
		new Setting(contentEl).setName("Calendar").addDropdown((d) => {
			for (const s of locals) d.addOption(s.id, s.name);
			d.setValue(this.calendarId || locals[0]?.id).onChange((v) => (this.calendarId = v));
		});

		new Setting(contentEl).setName("All day").addToggle((t) =>
			t.setValue(this.allDay).onChange((v) => {
				this.allDay = v;
				this.refreshVisibility();
			})
		);

		this.dateTimeRow(contentEl, "Starts", "start");
		this.dateTimeRow(contentEl, "Ends", "end");

		new Setting(contentEl).setName("Repeat").addDropdown((d) =>
			d
				.addOptions({ none: "Does not repeat", daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" })
				.setValue(this.freq)
				.onChange((v) => {
					this.freq = v as RecurrenceFreq | "none";
					this.refreshVisibility();
				})
		);
		const every = new Setting(contentEl).setName("Repeat every").addText((t) => {
			t.inputEl.type = "number";
			t.inputEl.min = "1";
			t.setValue(String(this.interval)).onChange((v) => (this.interval = Math.max(1, parseInt(v) || 1)));
		});
		this.recurEls.push(every.settingEl);

		const ends = new Setting(contentEl).setName("Ends");
		ends.addDropdown((d) =>
			d
				.addOptions({ never: "Never", until: "On date", count: "After N times" })
				.setValue(this.endsMode)
				.onChange((v) => {
					this.endsMode = v as "never" | "until" | "count";
					this.refreshVisibility();
				})
		);
		const untilInput = ends.controlEl.createEl("input", { type: "date", cls: "ch-input ch-until" });
		untilInput.value = this.until || this.startDate;
		untilInput.addEventListener("change", () => (this.until = untilInput.value));
		const countInput = ends.controlEl.createEl("input", { type: "number", cls: "ch-input ch-count" });
		countInput.min = "1";
		countInput.value = String(this.count);
		countInput.addEventListener("change", () => (this.count = Math.max(1, parseInt(countInput.value) || 1)));
		this.recurEls.push(ends.settingEl);

		new Setting(contentEl).setName("Location").addText((t) =>
			t.setPlaceholder("Optional").setValue(this.location).onChange((v) => (this.location = v))
		);
		new Setting(contentEl)
			.setName("Description")
			.setClass("ch-description-setting")
			.addTextArea((t) => {
				t.setPlaceholder("Optional").setValue(this.description).onChange((v) => (this.description = v));
				t.inputEl.rows = 4;
			});

		const buttons = new Setting(contentEl).setClass("ch-modal-buttons");
		if (this.init.event) {
			const ev = this.init.event;
			buttons.addButton((b) =>
				b.setButtonText(ev.notePath ? "Open note" : "Create note").onClick(async () => {
					await this.save(false);
					const saved = this.plugin.store.getEvent(ev.id);
					if (saved) await this.plugin.openNoteForLocalEvent(saved, this.init.occurrenceDate);
					this.close();
				})
			);
			if (ev.recurrence && this.init.occurrenceDate) {
				buttons.addButton((b) =>
					b.setButtonText("Delete this occurrence").setWarning().onClick(async () => {
						await this.plugin.store.excludeOccurrence(ev.id, this.init.occurrenceDate as string);
						this.close();
					})
				);
			}
			buttons.addButton((b) =>
				b.setButtonText(ev.recurrence ? "Delete all" : "Delete").setWarning().onClick(async () => {
					await this.plugin.store.deleteEvent(ev.id);
					new Notice(`Deleted "${ev.title}"`);
					this.close();
				})
			);
		}
		buttons.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
		buttons.addButton((b) => b.setButtonText("Save").setCta().onClick(() => void this.save()));

		this.refreshVisibility();
	}

	private untilEl(): HTMLInputElement | null {
		return this.contentEl.querySelector(".ch-until");
	}
	private countEl(): HTMLInputElement | null {
		return this.contentEl.querySelector(".ch-count");
	}

	private dateTimeRow(container: HTMLElement, label: string, which: "start" | "end") {
		const s = new Setting(container).setName(label);
		const date = s.controlEl.createEl("input", { type: "date", cls: "ch-input" });
		date.value = which === "start" ? this.startDate : this.endDate;
		const time = s.controlEl.createEl("input", { type: "time", cls: "ch-input" });
		time.value = which === "start" ? this.startTime : this.endTime;
		time.step = "300";
		this.timeEls.push(time);

		const onChange = () => {
			if (which === "start") {
				// Keep the duration when the start moves.
				const oldStart = parseLocal(`${this.startDate}T${this.startTime}`);
				const oldEnd = parseLocal(`${this.endDate}T${this.endTime}`);
				const durMs = oldEnd.getTime() - oldStart.getTime();
				this.startDate = date.value;
				this.startTime = time.value || this.startTime;
				const ns = parseLocal(`${this.startDate}T${this.startTime}`);
				if (isValidDate(ns) && isValidDate(oldStart) && durMs >= 0) {
					const ne = new Date(ns.getTime() + durMs);
					this.endDate = toDateKey(ne);
					this.endTime = toTimeKey(ne);
					const endInputs = this.contentEl.querySelectorAll<HTMLInputElement>(".ch-end-row input");
					if (endInputs[0]) endInputs[0].value = this.endDate;
					if (endInputs[1]) endInputs[1].value = this.endTime;
				}
			} else {
				this.endDate = date.value;
				this.endTime = time.value || this.endTime;
			}
		};
		date.addEventListener("change", onChange);
		time.addEventListener("change", onChange);
		s.settingEl.addClass(which === "start" ? "ch-start-row" : "ch-end-row");
	}

	private refreshVisibility() {
		for (const el of this.timeEls) el.toggle(!this.allDay);
		const recurring = this.freq !== "none";
		for (const el of this.recurEls) el.toggle(recurring);
		this.untilEl()?.toggle(this.endsMode === "until");
		this.countEl()?.toggle(this.endsMode === "count");
	}

	private async save(close = true) {
		const title = this.title.trim();
		if (!title) {
			new Notice("Please enter a title");
			return;
		}
		let start: string;
		let end: string;
		if (this.allDay) {
			start = this.startDate;
			end = this.endDate && this.endDate >= this.startDate ? this.endDate : this.startDate;
		} else {
			start = `${this.startDate}T${this.startTime || "09:00"}`;
			end = `${this.endDate || this.startDate}T${this.endTime || this.startTime}`;
			if (parseLocal(end) < parseLocal(start)) {
				new Notice("The end must be after the start");
				return;
			}
		}
		if (!isValidDate(parseLocal(start))) {
			new Notice("Invalid start date");
			return;
		}
		let recurrence: Recurrence | undefined;
		if (this.freq !== "none") {
			recurrence = { freq: this.freq, interval: Math.max(1, this.interval) };
			const untilVal = this.untilEl()?.value ?? this.until;
			const countVal = parseInt(this.countEl()?.value ?? "") || this.count;
			if (this.endsMode === "until" && untilVal) recurrence.until = untilVal;
			if (this.endsMode === "count") recurrence.count = Math.max(1, countVal);
		}
		const data = {
			title,
			calendarId: this.calendarId || this.plugin.store.defaultLocalSource().id,
			allDay: this.allDay,
			start,
			end,
			location: this.location.trim() || undefined,
			description: this.description.trim() || undefined,
			recurrence,
		};
		if (this.init.event) {
			await this.plugin.store.updateEvent(this.init.event.id, data);
		} else {
			const ev = await this.plugin.store.addEvent({ ...data, exdates: [], notePath: this.init.notePath });
			this.init.event = ev;
		}
		if (close) this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}
