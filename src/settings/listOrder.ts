import { setIcon } from "obsidian";

export interface SortableItem {
	id: string;
	name: string;
	icon: string;
	hidden: boolean;
}

/**
 * A short list to put in order by dragging (handle on the left) with a small eye button per row to hide / show it
 * (settings → Tasks → Automatic lists). Dragging uses pointer events, so it works with a mouse and with a finger
 * (the browser's own drag & drop doesn't work on touch screens).
 */
export function sortableList(
	container: HTMLElement,
	items: SortableItem[],
	opts: { onReorder: (ids: string[]) => void; onToggle: (id: string, hidden: boolean) => void }
) {
	const list = container.createDiv({ cls: "ch-sortable" });
	for (const it of items) {
		const row = list.createDiv({ cls: "ch-sortable-row", attr: { "data-id": it.id } });
		row.toggleClass("is-hidden", it.hidden);
		const handle = row.createSpan({ cls: "ch-sortable-handle", attr: { "aria-label": `Drag to move ${it.name}` } });
		setIcon(handle, "grip-vertical");
		setIcon(row.createSpan({ cls: "ch-sortable-icon" }), it.icon);
		row.createSpan({ cls: "ch-sortable-name", text: it.name });
		const eye = row.createEl("button", { cls: "ch-icon-btn ch-sortable-eye", attr: { "aria-label": it.hidden ? `Show ${it.name}` : `Hide ${it.name}`, "aria-pressed": String(it.hidden) } });
		setIcon(eye, it.hidden ? "eye-off" : "eye");
		eye.onclick = () => opts.onToggle(it.id, !it.hidden);
		handle.addEventListener("pointerdown", (e) => startDrag(e, row));
	}

	function startDrag(e: PointerEvent, row: HTMLElement) {
		e.preventDefault();
		row.addClass("is-dragging");
		// Listen on the window: moving the row in the list would otherwise lose the pointer.
		const win = row.win ?? window;
		const before = order();
		const move = (ev: PointerEvent) => {
			if (ev.pointerId !== e.pointerId) return;
			// Put the row before the first other row whose middle is below the pointer.
			const rows = Array.from(list.children).filter((r) => r !== row) as HTMLElement[];
			const next = rows.find((r) => {
				const b = r.getBoundingClientRect();
				return ev.clientY < b.top + b.height / 2;
			});
			if (next) {
				if (row.nextElementSibling !== next) list.insertBefore(row, next);
			} else if (list.lastElementChild !== row) list.appendChild(row);
		};
		const end = (ev: PointerEvent) => {
			if (ev.pointerId !== e.pointerId) return;
			win.removeEventListener("pointermove", move);
			win.removeEventListener("pointerup", end);
			win.removeEventListener("pointercancel", end);
			row.removeClass("is-dragging");
			const after = order();
			if (after.join() !== before.join()) opts.onReorder(after);
		};
		win.addEventListener("pointermove", move);
		win.addEventListener("pointerup", end);
		win.addEventListener("pointercancel", end);
	}

	function order(): string[] {
		return Array.from(list.children).map((r) => (r as HTMLElement).dataset.id ?? "");
	}
}
