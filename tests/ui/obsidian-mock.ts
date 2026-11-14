/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Minimal stand-in for the `obsidian` module so the plugin's views, modals and settings can be
 * rendered in a normal browser (Playwright) – see tests/README.md. It only implements what the
 * plugin uses; extend it when the plugin starts using more of the Obsidian API.
 *
 * Test hooks exposed on `window`:
 *   __Platform   – mutable Platform object (set isMobile before boot to emulate the mobile app)
 *   lastModal    – the most recently opened Modal
 *   lastMenu     – the most recently shown Menu (items: { t: title, fn: onClick })
 *   menuShows    – number of menus shown
 *   ribbonEl     – the ribbon icon element (click = what Obsidian would call)
 *   notices      – texts of all Notices shown
 */

// ---------------------------------------------------------------- DOM helpers Obsidian adds to HTMLElement
const P = HTMLElement.prototype as any;
function applyOpts(el: HTMLElement, o: any) {
	if (typeof o === "string") { el.className = o; return; }
	if (!o) return;
	if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
	if (o.text !== undefined) el.textContent = String(o.text);
	if (o.attr) for (const k in o.attr) el.setAttribute(k, o.attr[k]);
	if (o.type) (el as any).type = o.type;
	if (o.href) (el as any).href = o.href;
}
P.createEl = function (tag: string, o?: any) { const e = document.createElement(tag); applyOpts(e, o); this.appendChild(e); return e; };
P.createDiv = function (o?: any) { return this.createEl("div", o); };
P.createSpan = function (o?: any) { return this.createEl("span", o); };
P.empty = function () { this.innerHTML = ""; };
P.addClass = function (...c: string[]) { this.classList.add(...c); };
P.removeClass = function (...c: string[]) { this.classList.remove(...c); };
P.toggleClass = function (c: string, v: boolean) { this.classList.toggle(c, v); };
P.setText = function (t: string) { this.textContent = t; };
P.setAttr = function (k: string, v: string) { this.setAttribute(k, v); };
P.appendText = function (t: string) { this.appendChild(document.createTextNode(t)); };
P.show = function () { this.style.display = ""; };
P.hide = function () { this.style.display = "none"; };
P.toggle = function (v: boolean) { this.style.display = v ? "" : "none"; };
(window as any).createDiv = (o?: any) => { const e = document.createElement("div"); applyOpts(e, o); return e; };
(window as any).createSpan = (o?: any) => { const e = document.createElement("span"); applyOpts(e, o); return e; };
(window as any).notices = [];

// ---------------------------------------------------------------- core classes
export class Events {
	private h: Record<string, ((...a: any[]) => void)[]> = {};
	on(n: string, f: (...a: any[]) => void) { (this.h[n] ??= []).push(f); return { n, f }; }
	trigger(n: string, ...a: any[]) { (this.h[n] ?? []).forEach((f) => f(...a)); }
}
export function setIcon(el: HTMLElement, name: string) {
	if (!el) return;
	el.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor"/></svg>`;
	el.dataset.icon = name;
}
export function normalizePath(p: string) { return p.replace(/\/+/g, "/").replace(/^\/|\/$/g, "") || "/"; }
export class Notice { constructor(m: string) { (window as any).notices.push(m); } }
export class TFile {}
export class Component {
	register(_cb?: () => void) {}
	registerEvent() {}
	registerInterval(i: number) { return i; }
	addChild() {}
	load() { (this as any).onload?.(); }
}
export class MarkdownRenderChild extends Component { constructor(public containerEl: HTMLElement) { super(); } }
export class ItemView extends Component {
	contentEl: HTMLElement;
	app: any;
	constructor(public leaf: any) {
		super();
		this.contentEl = document.createElement("div");
		this.contentEl.className = "view-content";
		this.app = leaf.app;
	}
	async setState() {}
}
export class Modal {
	modalEl: HTMLElement; contentEl: HTMLElement; titleEl: HTMLElement;
	constructor(public app: any) {
		this.modalEl = document.createElement("div");
		this.modalEl.className = "modal";
		this.titleEl = (this.modalEl as any).createDiv("modal-title");
		this.contentEl = (this.modalEl as any).createDiv("modal-content");
	}
	setTitle(t: string) { this.titleEl.textContent = t; return this; }
	open() {
		const c = (document.body as any).createDiv("modal-container");
		c.appendChild(this.modalEl);
		(this as any).onOpen();
		(window as any).lastModal = this;
	}
	close() { this.modalEl.parentElement?.remove(); (this as any).onClose?.(); }
}

// ---------------------------------------------------------------- Setting + components
class Comp { constructor(public el: any) {} }
class TextC extends Comp {
	inputEl: HTMLInputElement;
	constructor(p: HTMLElement, tag = "input") { const i = document.createElement(tag) as any; p.appendChild(i); super(i); this.inputEl = i; }
	setValue(v: string) { this.inputEl.value = v; return this; }
	setPlaceholder(p: string) { this.inputEl.placeholder = p; return this; }
	onChange(f: any) { this.inputEl.addEventListener("input", () => f(this.inputEl.value)); return this; }
}
class DropC extends Comp {
	selectEl: HTMLSelectElement;
	constructor(p: HTMLElement) { const s = document.createElement("select"); s.className = "dropdown"; p.appendChild(s); super(s); this.selectEl = s; }
	addOption(v: string, t: string) { const o = document.createElement("option"); o.value = v; o.text = t; this.selectEl.appendChild(o); return this; }
	addOptions(o: any) { for (const k in o) this.addOption(k, o[k]); return this; }
	setDisabled(d: boolean) { this.selectEl.disabled = d; return this; }
	setValue(v: string) { this.selectEl.value = v; return this; }
	onChange(f: any) { this.selectEl.addEventListener("change", () => f(this.selectEl.value)); return this; }
}
class ToggleC extends Comp {
	v = false;
	constructor(p: HTMLElement) { const d = document.createElement("div"); d.className = "checkbox-container"; p.appendChild(d); super(d); }
	setValue(v: boolean) { this.v = v; this.el.classList.toggle("is-enabled", v); return this; }
	setTooltip() { return this; }
	onChange(f: any) { this.el.addEventListener("click", () => { this.setValue(!this.v); f(this.v); }); return this; }
}
class BtnC extends Comp {
	buttonEl: HTMLButtonElement;
	constructor(p: HTMLElement) { const b = document.createElement("button"); p.appendChild(b); super(b); this.buttonEl = b; }
	setDisabled(d: boolean) { this.el.disabled = d; return this; }
	setButtonText(t: string) { this.el.textContent = t; return this; }
	setCta() { this.el.classList.add("mod-cta"); return this; }
	setWarning() { this.el.classList.add("mod-warning"); return this; }
	setIcon(i: string) { setIcon(this.el, i); return this; }
	setTooltip() { return this; }
	onClick(f: any) { this.el.addEventListener("click", f); return this; }
}
class ColorC extends Comp {
	constructor(p: HTMLElement) { const i = document.createElement("input"); i.type = "color"; p.appendChild(i); super(i); }
	setValue(v: string) { this.el.value = v; return this; }
	onChange(f: any) { this.el.addEventListener("input", () => f(this.el.value)); return this; }
}
export class Setting {
	settingEl: HTMLElement; infoEl: HTMLElement; nameEl: HTMLElement; descEl: HTMLElement; controlEl: HTMLElement;
	constructor(c: HTMLElement) {
		const s: any = (c as any).createDiv("setting-item");
		this.settingEl = s;
		this.infoEl = s.createDiv("setting-item-info");
		this.nameEl = (this.infoEl as any).createDiv("setting-item-name");
		this.descEl = (this.infoEl as any).createDiv("setting-item-description");
		this.controlEl = s.createDiv("setting-item-control");
	}
	setName(n: string) { this.nameEl.textContent = n; return this; }
	setDesc(d: string) { this.descEl.textContent = d; return this; }
	setClass(c: string) { this.settingEl.classList.add(c); return this; }
	setHeading() { this.settingEl.classList.add("setting-item-heading"); return this; }
	addText(cb: any) { cb(new TextC(this.controlEl)); return this; }
	addTextArea(cb: any) { cb(new TextC(this.controlEl, "textarea")); return this; }
	addDropdown(cb: any) { cb(new DropC(this.controlEl)); return this; }
	addToggle(cb: any) { cb(new ToggleC(this.controlEl)); return this; }
	addButton(cb: any) { cb(new BtnC(this.controlEl)); return this; }
	addExtraButton(cb: any) { cb(new BtnC(this.controlEl)); return this; }
	addColorPicker(cb: any) { cb(new ColorC(this.controlEl)); return this; }
}
export class PluginSettingTab { containerEl = document.createElement("div"); constructor(public app: any, public plugin: any) {} }
export class Menu {
	items: any[] = [];
	addItem(f: any) {
		const it: any = {
			setTitle(t: string) { it.t = t; return it; }, setIcon() { return it; }, setChecked() { return it; },
			setWarning() { return it; }, onClick(fn: any) { it.fn = fn; return it; },
		};
		f(it);
		this.items.push(it);
		return this;
	}
	addSeparator() { return this; }
	private shown() { (window as any).lastMenu = this; (window as any).menuShows = ((window as any).menuShows || 0) + 1; }
	showAtMouseEvent() { this.shown(); }
	showAtPosition() { this.shown(); }
}

// ---------------------------------------------------------------- Plugin
export class Plugin extends Component {
	manifest = { id: "omni-calendar", dir: ".obsidian/plugins/omni-calendar" };
	_data: any = null;
	constructor(public app: any) { super(); }
	async loadData() { return this._data; }
	async saveData(d: any) { this._data = JSON.parse(JSON.stringify(d)); }
	registerView() {}
	addSettingTab() {}
	addRibbonIcon(_icon: string, title: string, cb: any) {
		const d = document.createElement("div");
		d.title = title;
		d.className = "test-ribbon";
		d.addEventListener("click", cb);
		document.body.appendChild(d);
		(window as any).ribbonEl = d;
		return d;
	}
	addCommand() {}
	registerMarkdownCodeBlockProcessor() {}
}
export async function requestUrl(r: any) { const res = await fetch(r.url); return { status: res.status, text: await res.text() }; }
export class WorkspaceLeaf {}
export const Platform = { isDesktopApp: false, isMobile: false };
(window as any).__Platform = Platform;
export type ViewStateResult = any;
