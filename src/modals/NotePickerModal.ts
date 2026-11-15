import { App, normalizePath, Notice, SuggestModal, TFile } from "obsidian";

type Pick = TFile | { create: string };

/**
 * Quick search over the vault's notes, used to link notes to tasks.
 * If nothing matches exactly, the last entry offers to create a new note with that name.
 */
export class NotePickerModal extends SuggestModal<Pick> {
	constructor(app: App, private folder: string, private exclude: string[], private onPick: (path: string) => void) {
		super(app);
		this.setPlaceholder("Type to search notes…");
		this.setInstructions([
			{ command: "↑↓", purpose: "navigate" },
			{ command: "↵", purpose: "link note" },
			{ command: "esc", purpose: "cancel" },
		]);
	}

	getSuggestions(query: string): Pick[] {
		const q = query.trim().toLowerCase();
		const files = this.app.vault.getMarkdownFiles().filter((f) => !this.exclude.includes(f.path));
		const scored = files
			.map((f) => {
				const name = f.basename.toLowerCase();
				const path = f.path.toLowerCase();
				let score = -1;
				if (!q) score = 1;
				else if (name === q) score = 4;
				else if (name.startsWith(q)) score = 3;
				else if (name.includes(q)) score = 2;
				else if (path.includes(q)) score = 1;
				return { f, score };
			})
			.filter((x) => x.score > 0)
			.sort((a, b) => b.score - a.score || b.f.stat.mtime - a.f.stat.mtime)
			.slice(0, 50)
			.map((x) => x.f as Pick);
		if (q && !files.some((f) => f.basename.toLowerCase() === q)) scored.push({ create: query.trim() });
		return scored;
	}

	renderSuggestion(item: Pick, el: HTMLElement) {
		el.addClass("ch-note-suggestion");
		if (item instanceof TFile) {
			el.createDiv({ cls: "ch-note-suggestion-name", text: item.basename });
			const folder = item.parent && item.parent.path !== "/" ? item.parent.path : "";
			if (folder) el.createDiv({ cls: "ch-note-suggestion-path", text: folder });
		} else {
			el.createDiv({ cls: "ch-note-suggestion-name", text: `Create note “${item.create}”` });
			el.createDiv({ cls: "ch-note-suggestion-path", text: `in ${this.folder || "the vault root"}` });
		}
	}

	async onChooseSuggestion(item: Pick) {
		if (item instanceof TFile) {
			this.onPick(item.path);
			return;
		}
		const folder = normalizePath(this.folder || "/");
		const name = item.create.replace(/[\\/:*?"<>|#^[\]]/g, "-").trim() || "Untitled";
		const path = normalizePath(folder === "/" ? `${name}.md` : `${folder}/${name}.md`);
		try {
			if (folder !== "/" && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder).catch(() => {});
			const existing = this.app.vault.getAbstractFileByPath(path);
			const file = existing instanceof TFile ? existing : await this.app.vault.create(path, "");
			this.onPick(file.path);
		} catch (e) {
			new Notice(`Could not create the note: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
}
