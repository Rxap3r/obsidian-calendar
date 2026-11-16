import { App, Notice, Setting } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarSource } from "../types";
import { STANDARD_PERIODS } from "../periods";
import { clamp } from "../util";

/** What the settings tabs need from the settings window. */
export interface SettingsContext {
	app: App;
	plugin: OmniCalendarPlugin;
	/** Save the settings and update the views; `rerender` also redraws the settings. */
	save(rerender?: boolean): Promise<void>;
	/** Redraw the settings (keeps the scroll position). */
	redraw(): void;
}

/** Collapsible "more info" block, used to keep long explanations out of the way. */
export function info(el: HTMLElement, summary: string, fill: (box: HTMLElement) => void, cls = "") {
	const det = el.createEl("details", { cls: `ch-provider-help ch-info ${cls}`.trim() });
	det.createEl("summary", { text: summary });
	fill(det);
	return det;
}

/** Colour, name and on/off switch of a calendar – the same three controls for every kind of calendar. */
export function sourceControls(
	ctx: SettingsContext, row: Setting, src: CalendarSource,
	opts: { toggleTip: string; namePlaceholder?: string; afterToggle?: (on: boolean) => unknown }
) {
	row.addColorPicker((c) =>
		c.setValue(src.color).onChange(async (v) => {
			src.color = v;
			await ctx.save();
		})
	);
	row.addText((t) => {
		if (opts.namePlaceholder) t.setPlaceholder(opts.namePlaceholder);
		t.setValue(src.name).onChange(async (v) => {
			src.name = v || "Untitled";
			await ctx.save();
		});
	});
	row.addToggle((t) =>
		t.setTooltip(opts.toggleTip).setValue(src.enabled).onChange(async (v) => {
			src.enabled = v;
			await ctx.save();
			await opts.afterToggle?.(v);
		})
	);
}

/**
 * A "how long / how far" setting: common choices in a dropdown plus "Custom…", which shows a
 * number and a unit (days, weeks, months, years). Values are stored in days (special values such
 * as 0 / -1 are presets). Custom values are limited to min…max days.
 * Use this for every such setting, so they all offer the same standard choices.
 */
export function periodSetting(
	ctx: SettingsContext, el: HTMLElement, name: string, desc: string, value: number,
	special: { before?: [number, string][]; after?: [number, string][] },
	min: number, max: number, set: (days: number) => void
) {
	const UNITS: [string, number][] = [["days", 1], ["weeks", 7], ["months", 30], ["years", 365]];
	// The same standard choices everywhere; only setting-specific extras (Never, Hidden, …) differ.
	const presets: [number, string][] = [...(special.before ?? []), ...STANDARD_PERIODS.filter(([d]) => d <= max), ...(special.after ?? [])];
	const isPreset = presets.some(([v]) => v === value);
	const setting = new Setting(el).setName(name).setDesc(desc).setClass("ch-period-setting");
	let customEl: HTMLElement;
	let numInput: HTMLInputElement;
	let unitSel: HTMLSelectElement;
	const apply = async () => {
		const n = parseInt(numInput.value);
		if (isNaN(n) || n < 1) return;
		const wanted = n * Number(unitSel.value);
		const days = clamp(wanted, min, max);
		if (days !== wanted) {
			// Over the limit: show the value that is actually used.
			const [, u] = [...UNITS].reverse().find(([, f]) => days % f === 0) ?? UNITS[0];
			numInput.value = String(days / u);
			unitSel.value = String(u);
			new Notice(`${name}: the maximum is ${days === 365 ? "1 year" : `${days} days`}.`);
		}
		set(days);
		await ctx.save();
	};
	setting.addDropdown((d) => {
		for (const [v, label] of presets) d.addOption(String(v), label);
		d.addOption("custom", "Custom…");
		d.setValue(isPreset ? String(value) : "custom").onChange(async (v) => {
			customEl.toggle(v === "custom");
			if (v === "custom") {
				numInput.focus();
				await apply();
			} else {
				set(Number(v));
				await ctx.save();
			}
		});
	});
	customEl = setting.controlEl.createDiv({ cls: "ch-period-custom" });
	numInput = customEl.createEl("input", { type: "number", cls: "ch-input ch-period-num" });
	numInput.min = "1";
	unitSel = customEl.createEl("select", { cls: "dropdown ch-period-unit" });
	for (const [label, f] of UNITS) unitSel.createEl("option", { text: label, value: String(f) });
	// Show the current custom value in the largest unit that fits exactly.
	const start = !isPreset && value > 0 ? value : 30;
	const [, f] = [...UNITS].reverse().find(([, u]) => start % u === 0) ?? UNITS[0];
	numInput.value = String(start / f);
	unitSel.value = String(f);
	numInput.addEventListener("change", () => void apply());
	unitSel.addEventListener("change", () => void apply());
	customEl.toggle(!isPreset);
}

export function numberSetting(ctx: SettingsContext, el: HTMLElement, name: string, desc: string, value: number, min: number, max: number, set: (v: number) => void) {
	new Setting(el)
		.setName(name)
		.setDesc(desc)
		.addText((t) => {
			t.inputEl.type = "number";
			t.inputEl.min = String(min);
			t.inputEl.max = String(max);
			t.setValue(String(value)).onChange(async (v) => {
				const n = parseInt(v);
				if (isNaN(n)) return;
				set(clamp(n, min, max));
				await ctx.save();
			});
		});
}
