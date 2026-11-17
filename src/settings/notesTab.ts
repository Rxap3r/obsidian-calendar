import { Setting } from "obsidian";
import { DEFAULT_NOTE_TEMPLATE, DEFAULT_TASK_NOTE_TEMPLATE } from "../notes";
import { SettingsContext } from "./controls";

/** Tab "Notes": folder, template of event notes and of task notes. */
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

	new Setting(el).setName("Task notes").setDesc("“Create note” on a task or subtask makes a note from this template, in the same folder. It's named “YYYY-MM-DD Task” (only the title when the task has no date), or “YYYY-MM-DD Task – Subtask”.").setHeading();
	new Setting(el)
		.setName("Task note template")
		.setDesc("Placeholders: {{title}} {{task}} {{subtask}} {{date}} {{time}} {{list}} {{priority}} {{notes}} ({{notes}} is the task's notes, or the subtask's description)")
		.setClass("ch-template-setting")
		.addTextArea((t) => {
			t.setValue(s.taskNoteTemplate).onChange(async (v) => {
				s.taskNoteTemplate = v;
				await ctx.save();
			});
			t.inputEl.rows = 10;
		})
		.addExtraButton((b) =>
			b.setIcon("rotate-ccw").setTooltip("Reset to default").onClick(async () => {
				s.taskNoteTemplate = DEFAULT_TASK_NOTE_TEMPLATE;
				await ctx.save(true);
			})
		);
}
