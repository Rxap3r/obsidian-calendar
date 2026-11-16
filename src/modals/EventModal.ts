import { Modal, Notice, Setting } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence, CalendarSource, EventInput, LocalEvent, Recurrence, RecurrenceFreq } from "../types";
import { DateField, TimeField, keepFocusOnTap } from "../pickers";
import { addDays, isValidDate, parseLocal, toDateKey, toTimeKey } from "../dateUtils";
import { errorMessage } from "../util";
import { deleteEvent } from "./confirmations";
import { eventKey } from "../eventLinks";
import { eventExtras } from "../views/eventExtras";
import { attachDraft, draftExtras, EventDraft } from "../views/eventDraft";
import { EventForm, EventModalInit, formForNew, formFromLocal, formFromRemote, LocalEventData } from "./eventForm";

/** Create / edit an event: a local one, or one in a connected Google / Outlook calendar. */
export class EventModal extends Modal {
	/** Number of event dialogs currently open (used to never open two at once from gestures). */
	static openCount = 0;

	/** What the fields of the dialog currently hold. */
	private f: EventForm;

	private timeEls: HTMLElement[] = [];
	private timeFields: Partial<Record<"start" | "end", TimeField>> = {};
	private dateFields: Partial<Record<"start" | "end", DateField>> = {};
	private untilField: DateField | null = null;
	private recurEls: HTMLElement[] = [];
	private busy = false;
	private stopExtras: (() => void) | null = null;
	/** New event: tasks and linked notes to attach on save (the note the event is created from is the first). */
	private draft: EventDraft;
	private draftUi: { setHint: (text: string) => void } | null = null;

	constructor(private plugin: OmniCalendarPlugin, private init: EventModalInit = {}) {
		super(plugin.app);
		this.f = init.remote ? formFromRemote(init.remote) : init.event ? formFromLocal(init.event) : formForNew(plugin, init);
		this.draft = { tasks: [], links: init.notePath ? [init.notePath] : [] };
	}

	onOpen() {
		EventModal.openCount++;
		const { contentEl } = this;
		this.modalEl.addClass("ch-event-modal");
		keepFocusOnTap(this.modalEl);
		const remote = this.init.remote;
		this.setTitle(this.init.event || remote ? "Edit event" : "New event");

		if (this.init.event?.recurrence) {
			contentEl.createDiv({ cls: "ch-modal-hint", text: "This is a recurring event. Changes apply to all occurrences." });
		}
		if (remote) {
			const provider = this.plugin.store.serviceName(remote.sourceId);
			contentEl.createDiv({
				cls: "ch-modal-hint",
				text: remote.recurring
					? `${provider} event. Changes apply to this occurrence only – edit the repeat rule in ${provider}.`
					: `${provider} event. Changes are saved directly to ${provider}.`,
			});
		}

		new Setting(contentEl).setName("Title").addText((t) => {
			t.setPlaceholder("Event title").setValue(this.f.title).onChange((v) => (this.f.title = v));
			t.inputEl.addClass("ch-title-input");
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void this.save();
				}
			});
			window.setTimeout(() => t.inputEl.focus(), 10);
		});

		const store = this.plugin.store;
		const locals = store.localSources();
		const remotes = store.writableRemoteSources();
		const isNew = !this.init.event && !remote;
		if (isNew) this.targetPicker(contentEl);
		else new Setting(contentEl).setName("Calendar").addDropdown((d) => {
			for (const s of [...locals, ...remotes]) d.addOption(s.id, `${s.name} (${store.sourceKindLabel(s)})`);
			if (!d.selectEl.querySelector(`option[value="${CSS.escape(this.f.calendarId)}"]`)) {
				const cur = store.getSource(this.f.calendarId);
				if (cur) d.addOption(cur.id, cur.name);
			}
			d.setValue(this.f.calendarId || locals[0]?.id).onChange((v) => {
				this.f.calendarId = v;
				this.refreshVisibility();
			});
			// Moving a single occurrence of a remote series to another calendar is not possible.
			if (remote?.recurring) d.setDisabled(true);
		});

		new Setting(contentEl).setName("All day").addToggle((t) =>
			t.setValue(this.f.allDay).onChange((v) => {
				this.f.allDay = v;
				// A timed event ending at midnight (e.g. Mon 23:00 – Tue 00:00) doesn't touch the next
				// day. As an all-day event it is only Monday – all-day end dates are inclusive.
				if (v && this.f.endTime === "00:00" && this.f.endDate > this.f.startDate) {
					this.f.endDate = toDateKey(addDays(parseLocal(this.f.endDate), -1));
					this.dateFields.end?.setValue(this.f.endDate);
				}
				this.refreshVisibility();
			})
		);

		this.dateTimeRow(contentEl, "Starts", "start");
		this.dateTimeRow(contentEl, "Ends", "end");

		const repeat = new Setting(contentEl).setName("Repeat").addDropdown((d) =>
			d
				.addOptions({ none: "Does not repeat", daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" })
				.setValue(this.f.freq)
				.onChange((v) => {
					this.f.freq = v as RecurrenceFreq | "none";
					this.refreshVisibility();
				})
		);
		repeat.settingEl.addClass("ch-repeat-row");
		const every = new Setting(contentEl).setName("Repeat every").addText((t) => {
			t.inputEl.type = "number";
			t.inputEl.min = "1";
			t.setValue(String(this.f.interval)).onChange((v) => (this.f.interval = Math.max(1, parseInt(v) || 1)));
		});
		this.recurEls.push(every.settingEl);

		const ends = new Setting(contentEl).setName("Ends");
		ends.addDropdown((d) =>
			d
				.addOptions({ never: "Never", until: "On date", count: "After N times" })
				.setValue(this.f.endsMode)
				.onChange((v) => {
					this.f.endsMode = v as "never" | "until" | "count";
					this.refreshVisibility();
				})
		);
		this.f.until = this.f.until || this.f.startDate;
		this.untilField = new DateField(ends.controlEl, {
			value: this.f.until, placeholder: "Select date", firstDayOfWeek: this.plugin.settings.firstDayOfWeek,
			cls: "ch-until", onChange: (v) => (this.f.until = v ?? this.f.until),
		});
		const countInput = ends.controlEl.createEl("input", { type: "number", cls: "ch-input ch-count" });
		countInput.min = "1";
		countInput.value = String(this.f.count);
		countInput.addEventListener("change", () => (this.f.count = Math.max(1, parseInt(countInput.value) || 1)));
		this.recurEls.push(ends.settingEl);

		new Setting(contentEl).setName("Location").addText((t) =>
			t.setPlaceholder("Optional").setValue(this.f.location).onChange((v) => (this.f.location = v))
		);
		new Setting(contentEl)
			.setName("Description")
			.setClass("ch-description-setting")
			.addTextArea((t) => {
				t.setPlaceholder("Optional").setValue(this.f.description).onChange((v) => (this.f.description = v));
				t.inputEl.rows = 4;
			});

		// Tasks and linked notes of an existing event (kept in Obsidian, also for Google / Outlook events).
		const occ = this.occurrence();
		if (occ) {
			this.stopExtras = eventExtras(this.plugin, contentEl.createDiv({ cls: "ch-event-extras" }), occ, {
				// The note is made from what the dialog shows now: save first (local events).
				beforeCreateNote: async () => {
					if (!this.init.event) return undefined;
					await this.save(false);
					return this.occurrence();
				},
				afterCreateNote: () => this.close(),
			});
		} else if (!this.init.event && !remote) {
			// A new event: tasks and notes are kept here and attached when it is saved.
			this.draftUi = draftExtras(this.plugin, contentEl.createDiv({ cls: "ch-event-extras" }), this.draft);
			this.updateDraftHint();
		}

		const buttons = new Setting(contentEl).setClass("ch-modal-buttons");
		if (remote) {
			if (remote.recurring) {
				buttons.addButton((b) =>
					b.setButtonText("Delete this occurrence").setWarning().onClick(() => void this.delete(false))
				);
			}
			buttons.addButton((b) =>
				b.setButtonText(remote.recurring ? "Delete series" : "Delete").setWarning().onClick(() => void this.delete(remote.recurring))
			);
		}
		if (this.init.event) {
			const ev = this.init.event;
			if (ev.recurrence && this.init.occurrenceDate) {
				buttons.addButton((b) =>
					b.setButtonText("Delete this occurrence").setWarning().onClick(() => void this.delete(false))
				);
			}
			buttons.addButton((b) =>
				b.setButtonText(ev.recurrence ? "Delete all" : "Delete").setWarning().onClick(() => void this.delete(true))
			);
		}
		buttons.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
		buttons.addButton((b) => b.setButtonText("Save").setCta().onClick(() => void this.save()));

		this.refreshVisibility();
	}

	/** The occurrence this dialog edits (null for a new event). */
	private occurrence(): CalendarOccurrence | undefined {
		if (this.init.remote) return this.init.remote;
		const ev = this.init.event;
		if (!ev) return undefined;
		const date = this.init.occurrenceDate;
		return this.plugin.store.findOccurrence(ev.recurrence && date ? `local:${ev.id}@${date}` : `local:${ev.id}`);
	}

	private untilEl(): HTMLElement | null {
		return this.untilField?.el ?? null;
	}
	private countEl(): HTMLInputElement | null {
		return this.contentEl.querySelector(".ch-count");
	}

	private dateTimeRow(container: HTMLElement, label: string, which: "start" | "end") {
		const s = new Setting(container).setName(label);
		const date = new DateField(s.controlEl, {
			value: which === "start" ? this.f.startDate : this.f.endDate,
			placeholder: "Select date",
			firstDayOfWeek: this.plugin.settings.firstDayOfWeek,
			cls: `ch-event-${which}-date`,
			onChange: () => onChange(),
		});
		this.dateFields[which] = date;
		const time = new TimeField(s.controlEl, {
			value: which === "start" ? this.f.startTime : this.f.endTime,
			placeholder: which === "start" ? "Start" : "End",
			use24h: this.plugin.settings.use24h,
			cls: `ch-event-${which}-time`,
			// End on the same day: list times after the start, with durations.
			after: which === "end" ? () => (this.f.endDate === this.f.startDate ? this.f.startTime : undefined) : undefined,
			onChange: () => onChange(),
		});
		this.timeFields[which] = time;
		this.timeEls.push(time.el);

		const onChange = () => {
			if (which === "start") {
				// Keep the duration when the start moves.
				const oldStart = parseLocal(`${this.f.startDate}T${this.f.startTime}`);
				const oldEnd = parseLocal(`${this.f.endDate}T${this.f.endTime}`);
				const durMs = oldEnd.getTime() - oldStart.getTime();
				this.f.startDate = date.getValue() ?? this.f.startDate;
				this.f.startTime = time.getValue() || this.f.startTime;
				const ns = parseLocal(`${this.f.startDate}T${this.f.startTime}`);
				if (isValidDate(ns) && isValidDate(oldStart) && durMs >= 0) {
					const ne = new Date(ns.getTime() + durMs);
					this.f.endDate = toDateKey(ne);
					this.f.endTime = toTimeKey(ne);
					this.dateFields.end?.setValue(this.f.endDate);
					this.timeFields.end?.setValue(this.f.endTime);
				}
			} else {
				this.f.endDate = date.getValue() ?? this.f.endDate;
				this.f.endTime = time.getValue() || this.f.endTime;
			}
		};
		s.settingEl.addClass(which === "start" ? "ch-start-row" : "ch-end-row");
	}

	/** Toggle buttons to choose which calendars a new event is saved to. */
	private targetPicker(container: HTMLElement) {
		const store = this.plugin.store;
		const setting = new Setting(container).setName("Save to").setClass("ch-target-setting");
		setting.setDesc("Click to choose one or more calendars.");
		const wrap = setting.controlEl.createDiv({ cls: "ch-target-chips" });
		const hint = container.createDiv({ cls: "ch-target-hint ch-muted" });
		const render = () => {
			wrap.empty();
			const options = store.writableTargets();
			for (const extra of this.f.targets) {
				const src = store.getSource(extra);
				if (src && !options.includes(src)) options.push(src);
			}
			for (const src of options) {
				const on = this.f.targets.includes(src.id);
				const chip = wrap.createEl("button", { cls: `ch-target-chip${on ? " is-on" : ""}`, attr: { "aria-pressed": String(on), type: "button" } });
				chip.style.setProperty("--ch-event-color", src.color);
				chip.createSpan({ cls: "ch-target-check", text: on ? "✓" : "" });
				chip.createSpan({ cls: "ch-target-name", text: src.name });
				chip.createSpan({ cls: "ch-target-kind", text: store.sourceKindLabel(src) });
				chip.onclick = () => {
					if (on && this.f.targets.length === 1) {
						new Notice("At least one calendar is needed.");
						return;
					}
					this.f.targets = on ? this.f.targets.filter((x) => x !== src.id) : [...this.f.targets, src.id];
					this.f.calendarId = this.f.targets[0];
					render();
				};
			}
			hint.setText(
				this.f.targets.length > 1
					? `The event will be created in ${this.f.targets.length} calendars as separate copies – editing one later does not change the others.`
					: ""
			);
			hint.toggle(this.f.targets.length > 1);
			this.updateDraftHint();
		};
		render();
	}

	private refreshVisibility() {
		for (const el of this.timeEls) el.toggle(!this.f.allDay);
		// The repeat rule can be set for new events; existing remote events keep their rule.
		const canRepeat = !this.init.remote;
		this.contentEl.querySelector<HTMLElement>(".ch-repeat-row")?.toggle(canRepeat);
		const recurring = canRepeat && this.f.freq !== "none";
		for (const el of this.recurEls) el.toggle(recurring);
		this.untilEl()?.toggle(this.f.endsMode === "until");
		this.countEl()?.toggle(this.f.endsMode === "count");
	}

	/** Check the fields and turn them into the event to store. Shows a message and returns null if something is wrong. */
	private collect(): { data: LocalEventData; input: EventInput } | null {
		const f = this.f;
		const title = f.title.trim();
		if (!title) {
			new Notice("Please enter a title");
			return null;
		}
		let start: string;
		let end: string;
		if (f.allDay) {
			start = f.startDate;
			end = f.endDate && f.endDate >= f.startDate ? f.endDate : f.startDate;
		} else {
			start = `${f.startDate}T${f.startTime || "09:00"}`;
			end = `${f.endDate || f.startDate}T${f.endTime || f.startTime}`;
			if (parseLocal(end) < parseLocal(start)) {
				new Notice("The end must be after the start");
				return null;
			}
		}
		if (!isValidDate(parseLocal(start))) {
			new Notice("Invalid start date");
			return null;
		}
		let recurrence: Recurrence | undefined;
		// The repeat rule of an existing Google / Outlook event is edited there.
		if (f.freq !== "none" && !this.init.remote) {
			recurrence = { freq: f.freq, interval: Math.max(1, f.interval) };
			const untilVal = this.untilField?.getValue() ?? f.until;
			const countVal = parseInt(this.countEl()?.value ?? "") || f.count;
			if (f.endsMode === "until" && untilVal) recurrence.until = untilVal;
			if (f.endsMode === "count") recurrence.count = Math.max(1, countVal);
		}
		const data: LocalEventData = {
			title,
			calendarId: f.calendarId || this.plugin.store.defaultLocalSource().id,
			allDay: f.allDay,
			start,
			end,
			location: f.location.trim() || undefined,
			description: f.description.trim() || undefined,
			recurrence,
		};
		// The same event for Google / Outlook: real dates, and an exclusive end.
		const input: EventInput = {
			title,
			allDay: data.allDay,
			start: parseLocal(start),
			end: data.allDay ? addDays(parseLocal(end), 1) : parseLocal(end),
			location: data.location,
			description: data.description,
			recurrence,
		};
		return { data, input };
	}

	private async save(close = true) {
		const event = this.collect();
		if (!event || this.busy) return;
		this.busy = true;
		this.modalEl.addClass("ch-busy");
		try {
			let done = true;
			if (this.init.remote) await this.saveRemoteEdit(this.init.remote, event.data, event.input);
			else if (this.init.event) await this.saveLocalEdit(this.init.event, event.data, event.input);
			else done = await this.saveNew(event.data, event.input);
			if (done && close) this.close();
		} catch (e) {
			new Notice(`Could not save: ${errorMessage(e)}`, 8000);
		} finally {
			this.busy = false;
			this.modalEl.removeClass("ch-busy");
		}
	}

	/** The chosen calendar, if it is a Google / Outlook calendar. */
	private remoteTarget(data: LocalEventData): CalendarSource | null {
		const target = this.plugin.store.getSource(data.calendarId);
		return target && this.plugin.store.isRemoteSource(target) ? target : null;
	}

	/** Save an existing Google / Outlook event – in place, or moved to another calendar. */
	private async saveRemoteEdit(remote: CalendarOccurrence, data: LocalEventData, input: EventInput) {
		const store = this.plugin.store;
		if (data.calendarId === remote.sourceId && store.getSource(data.calendarId)) {
			await store.updateRemote(remote, input);
			return;
		}
		// Move to another calendar: create there first, then delete the original. Tasks and notes move along.
		const target = this.remoteTarget(data);
		const newKey = target ? await store.createRemote(target, input) : `local:${(await store.addEvent({ ...data, exdates: [] })).id}`;
		await this.moveExtras(remote, newKey, data);
		await store.deleteRemote(remote, false);
	}

	/** Save an existing local event – in place, or moved to a Google / Outlook calendar. */
	private async saveLocalEdit(ev: LocalEvent, data: LocalEventData, input: EventInput) {
		const store = this.plugin.store;
		const target = this.remoteTarget(data);
		if (!target) {
			await store.updateEvent(ev.id, data);
			return;
		}
		const old = ev.recurrence ? undefined : this.occurrence();
		const newKey = await store.createRemote(target, input);
		if (old) await this.moveExtras(old, newKey, data);
		await store.deleteEvent(ev.id);
		new Notice(`Moved "${data.title}" to ${target.name}`);
	}

	/**
	 * Create a new event in every selected calendar (separate copies).
	 * Returns false when the dialog should stay open: nothing could be saved, or no calendar is chosen.
	 */
	private async saveNew(data: LocalEventData, input: EventInput): Promise<boolean> {
		const store = this.plugin.store;
		const targets = this.f.targets.map((id) => store.getSource(id)).filter((x): x is CalendarSource => !!x);
		if (!targets.length) {
			new Notice("Choose at least one calendar.");
			return false;
		}
		const saved: CalendarSource[] = [];
		const failed: string[] = [];
		let firstLocal: LocalEvent | null = null;
		const day = data.start.slice(0, 10);
		for (const t of targets) {
			try {
				// The key of this copy, so the draft's tasks and notes can be attached to it.
				let key: string | undefined;
				if (store.isRemoteSource(t)) {
					const created = await store.createRemote(t, input);
					key = created && data.recurrence ? store.firstRepeatKey(created) : created;
				} else {
					const ev = await store.addEvent({ ...data, calendarId: t.id, exdates: [] });
					firstLocal = firstLocal ?? ev;
					key = data.recurrence ? `local:${ev.id}@${day}` : `local:${ev.id}`;
				}
				saved.push(t);
				// Only one copy gets them (the first one saved), so they aren't duplicated.
				if (key && (this.draft.tasks.length || this.draft.links.length)) await attachDraft(this.plugin, this.draft, key, data.title, day);
			} catch (e) {
				failed.push(`${t.name}: ${errorMessage(e)}`);
			}
		}
		// Saved, but no copy told us its id: keep the typed tasks as normal tasks for that day rather than lose them.
		if (saved.length && this.draft.tasks.length) {
			for (const title of this.draft.tasks) await this.plugin.tasks.upsert(this.plugin.tasks.draft({ title, date: day }));
			new Notice(`The tasks couldn't be attached to the event; they were added as normal tasks on that day.`, 8000);
			this.draft.tasks = [];
		}
		// From now on the dialog edits the local copy (e.g. "Create note" saves first).
		if (firstLocal) this.init.event = firstLocal;
		const names = saved.map((t) => t.name).join(", ");
		if (failed.length) {
			new Notice(`Could not save to ${failed.join("; ")}${saved.length ? `\nSaved to: ${names}` : ""}`, 10000);
			if (!saved.length) return false;
			// Do not retry calendars that already have the event.
			this.f.targets = this.f.targets.filter((id) => !saved.some((t) => t.id === id));
		} else if (targets.length > 1 || store.isRemoteSource(targets[0])) {
			new Notice(`Saved "${data.title}" to ${names}`);
		}
		return true;
	}

	/** Which copy gets the tasks and notes, when the new event is saved to several calendars. */
	private updateDraftHint() {
		const first = this.plugin.store.getSource(this.f.targets[0]);
		this.draftUi?.setHint(this.f.targets.length > 1 && first ? `Tasks and linked notes go with the copy in ${first.name}.` : "");
	}

	/** The event moved to another calendar and got a new key: its tasks and linked notes go along. */
	private async moveExtras(from: CalendarOccurrence, newKey: string | undefined, data: LocalEventData) {
		if (!newKey) return;
		await this.plugin.tasks.moveEvent(eventKey(from), newKey, data.title, data.start.slice(0, 10));
		await this.plugin.store.moveLinks(from, newKey);
	}

	/** Delete this occurrence, or (`series`) the whole event – with its tasks, after asking when needed. */
	private async delete(series: boolean) {
		const occ = this.occurrence();
		if (!occ || this.busy) return;
		this.busy = true;
		try {
			if (await deleteEvent(this.plugin, occ, series)) this.close();
		} finally {
			this.busy = false;
		}
	}

	onClose() {
		EventModal.openCount = Math.max(0, EventModal.openCount - 1);
		this.stopExtras?.();
		this.contentEl.empty();
	}
}
