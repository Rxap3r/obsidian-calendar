import { Setting } from "obsidian";
import { DEFAULT_NOTE_TEMPLATE } from "../notes";
import { SettingsContext } from "./controls";

/** Tab "Notes": folder and template of event notes. */
export function notesTab(ctx: SettingsContext, el: HTMLElement) {
	const s = ctx.plugin.settings;
	new Setting(el).setName("Event notes").setDesc("“Create note” on an event makes a note from this template.").setHeading();
	new Setting(el)
		.setName("Notes folder")
		.addText((t) =>
			t.setPlaceholder("Calendar").setValue(s.notesFolder).onChange(async (v) => {
				s.notesFolder = v.trim();
				await ctx.save();
			})
		);
	new Setting(el)
		.setName("Note template")
		.setDesc("Placeholders: {{title}} {{date}} {{start}} {{end}} {{when}} {{location}} {{calendar}} {{description}}")
		.setClass("ch-template-setting")
		.addTextArea((t) => {
			t.setValue(s.noteTemplate).onChange(async (v) => {
				s.noteTemplate = v;
				await ctx.save();
			});
			t.inputEl.rows = 12;
		})
		.addExtraButton((b) =>
			b.setIcon("rotate-ccw").setTooltip("Reset to default").onClick(async () => {
				s.noteTemplate = DEFAULT_NOTE_TEMPLATE;
				await ctx.save(true);
			})
		);
}
