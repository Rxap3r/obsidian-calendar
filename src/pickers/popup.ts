/**
 * Pop-up and focus helpers shared by the date and time fields and the dialogs that use them.
 * They exist because of tablet bugs (the keyboard opening by itself) – see "Dialog and picker rules" in CLAUDE.md.
 */

/**
 * Create a pop-up inside the dialog that contains the field (not at the end of the page): Obsidian
 * keeps the focus inside an open dialog and would otherwise move it to the dialog's first field
 * (the title), which opened the keyboard on tablets. Tapping the pop-up also never takes the focus.
 */
export function createPopup(field: HTMLElement, cls: string, attr: Record<string, string>): HTMLElement {
	const host = (field.closest(".modal-container") as HTMLElement | null) ?? document.body;
	const popup = host.createDiv({ cls, attr });
	// Keep the focus where it is (buttons in the pop-up would take it); clicks still work.
	popup.addEventListener("pointerdown", (e) => {
		if ((e.target as HTMLElement).closest("input, textarea")) return;
		e.preventDefault();
		releaseTextField(field.closest(".modal") as HTMLElement | null, field);
	});
	popup.addEventListener("mousedown", (e) => e.preventDefault());
	return popup;
}

/** Put a fixed pop-up below the anchor (or above it when there's no room), on top of dialogs. */
export function placePopup(popup: HTMLElement, anchor: HTMLElement, width: number, maxHeight: number) {
	const r = anchor.getBoundingClientRect();
	const below = window.innerHeight - r.bottom - 8;
	const above = r.top - 8;
	const h = Math.min(maxHeight, Math.max(below, above));
	popup.style.width = `${Math.min(width, window.innerWidth - 16)}px`;
	popup.style.maxHeight = `${h}px`;
	const w = popup.offsetWidth || width;
	popup.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - w - 8)}px`;
	const need = Math.min(h, popup.scrollHeight);
	if (below >= need || below >= above) popup.style.top = `${r.bottom + 4}px`;
	else popup.style.top = `${Math.max(8, r.top - 4 - need)}px`;
}

/** Close the pop-up when tapping outside it or scrolling the page behind it. Returns the cleanup. */
export function closeOnOutside(popup: HTMLElement, anchor: HTMLElement, close: () => void): () => void {
	const onDown = (e: PointerEvent) => {
		if (!popup.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
	};
	const onScroll = (e: Event) => {
		if (!popup.contains(e.target as Node)) close();
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			close();
		}
	};
	document.addEventListener("pointerdown", onDown, true);
	document.addEventListener("scroll", onScroll, true);
	document.addEventListener("keydown", onKey, true);
	window.addEventListener("resize", close);
	return () => {
		document.removeEventListener("pointerdown", onDown, true);
		document.removeEventListener("scroll", onScroll, true);
		document.removeEventListener("keydown", onKey, true);
		window.removeEventListener("resize", close);
	};
}

/**
 * Buttons in a dialog don't take the focus when tapped. Otherwise a button that disappears after
 * the tap (re-rendered rows, closed pop-ups) leaves the dialog without focus, and Obsidian then
 * focuses the first field (the title), which opens the keyboard on tablets and phones.
 */
export function keepFocusOnTap(container: HTMLElement) {
	// The dialog itself can hold the focus (so the keyboard can close without the focus leaving it).
	if (!container.hasAttribute("tabindex")) container.tabIndex = -1;
	container.addEventListener("pointerdown", (e) => {
		const t = e.target as HTMLElement;
		if (t.closest("button, .ch-target-chip") && !t.closest("input, textarea, select")) {
			e.preventDefault();
			releaseTextField(container);
		}
	});
}

/**
 * If a text field (notes, subtask, title, …) is being typed in, hand the focus to the dialog
 * itself: the keyboard closes, and the focus stays inside the dialog. `except` is a field that
 * should keep its own input focused (e.g. a time field while typing).
 */
function releaseTextField(dialog: HTMLElement | null, except?: HTMLElement) {
	const ae = document.activeElement as HTMLElement | null;
	if (!dialog || !ae || !dialog.contains(ae) || (except && except.contains(ae))) return;
	const typing = ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && !(ae as HTMLInputElement).readOnly && !["checkbox", "radio", "color", "button"].includes((ae as HTMLInputElement).type));
	if (!typing) return;
	if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;
	dialog.focus({ preventScroll: true });
}
