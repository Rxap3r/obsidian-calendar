/* Calendar views: month/week/day/agenda, drag & drop, touch, narrow layouts. Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {

test("desktop: all views render (screenshots)", {}, async ({ page }) => {
	for (const mode of ["month", "week", "day", "agenda"]) {
		await page.evaluate((m) => view.goTo(new Date(2026, 10, 14), m), mode);
		await page.waitForTimeout(150);
		await shot(page, `desktop-${mode}`);
		if (mode === "week") eq(await page.locator(".ch-tg-col").count(), 7, "week view columns");
		if (mode === "day") eq(await page.locator(".ch-tg-col").count(), 1, "day view columns");
		if (mode === "month") eq(await page.locator(".ch-month-cell").count(), 42, "month view cells");
		if (mode === "agenda") expect(await page.locator(".ch-agenda-item").count() > 5, "agenda lists events");
	}
});

test("desktop: drag on time grid creates exactly one dialog", {}, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(200);
	const col = await page.locator(".ch-tg-col").nth(4).boundingBox();
	const sc = await page.$eval(".ch-grid-scroll", (e) => e.getBoundingClientRect().top);
	await page.mouse.move(col.x + 20, sc + 100);
	await page.mouse.down();
	await page.mouse.move(col.x + 20, sc + 196, { steps: 5 });
	const preview = await page.evaluate(() => {
		const g = document.querySelector(".ch-tg-selection");
		return g && { time: g.querySelector(".ch-tg-selection-time").textContent, title: g.querySelector(".ch-tg-selection-title").textContent,
			color: getComputedStyle(g).getPropertyValue("--ch-event-color").trim() };
	});
	expect(preview && /^\d\d:\d\d – \d\d:\d\d$/.test(preview.time), `preview shows the time range: ${JSON.stringify(preview)}`);
	eq(preview.title, "New event", "preview title");
	eq(preview.color, await page.evaluate(() => plugin.settings.sources.find((s) => s.id === plugin.settings.defaultTargets[0]).color), "preview uses target calendar colour");
	await page.locator(".ch-tg-col").nth(4).screenshot({ path: path.join(SHOTS, "drag-preview.png") });
	await page.mouse.up();
	await page.waitForTimeout(100);
	eq(await page.locator(".modal").count(), 1, "dialogs open");
	await page.fill(".ch-title-input", "Dragged");
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(100);
	const ev = await page.evaluate(() => plugin.data.events.find((e) => e.title === "Dragged"));
	expect(ev && ev.start.startsWith("2026-11-13T"), `event created on Fri 13: ${JSON.stringify(ev)}`);
});

test("desktop: drag & drop moves a local event (month)", {}, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(150);
	const cells = page.locator(".ch-month-cell:not(.ch-other-month)");
	await page.locator(".ch-month .ch-chip", { hasText: "Gym" }).dragTo(cells.nth(24));
	await page.waitForTimeout(150);
	const gym = await page.evaluate(() => plugin.data.events.find((e) => e.title === "Gym"));
	eq([gym.start, gym.end], ["2026-11-25T18:00", "2026-11-25T19:30"], "Gym moved to the 25th");
});

test("desktop: dragging an event in the week view lands exactly where the preview shows", {}, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(250);
	const ev = page.locator(".ch-tg-event", { hasText: "Design review" });
	const box = await ev.boundingBox();
	const H = 48; // px per hour
	// Grab the event 45 minutes below its top edge, move it 2 hours down and one day to the left.
	const x0 = box.x + box.width / 2, y0 = box.y + (45 / 60) * H;
	const colW = (await page.locator(".ch-tg-col").first().boundingBox()).width;
	await page.mouse.move(x0, y0);
	await page.mouse.down();
	await page.mouse.move(x0 - colW, y0 + 2 * H, { steps: 12 });
	await page.waitForTimeout(100);
	const preview = await page.evaluate(() => { const p = document.querySelector(".ch-drop-preview"); return p && { time: p.querySelector(".ch-tg-selection-time").textContent, day: p.closest(".ch-tg-col").dataset.date }; });
	await page.mouse.up();
	await page.waitForTimeout(150);
	const e = await page.evaluate(() => { const x = plugin.data.events.find((x) => x.title === "Design review"); return [x.start, x.end]; });
	eq(preview, { time: "12:00 – 13:30", day: "2026-11-13" }, "preview while dragging");
	eq(e, ["2026-11-13T12:00", "2026-11-13T13:30"], "event lands where the preview showed (not at the mouse position)");
	eq(await page.$$eval(".ch-drop-preview", (x) => x.length), 0, "preview removed after dropping");
	// Screenshot of the preview (drawn directly: screenshots taken during a live browser drag show an old frame).
	await page.evaluate(() => {
		const col = document.querySelector('.ch-tg-col[data-date="2026-11-12"]');
		view.dragInfo = { key: [...view.rendered.keys()].find((k) => view.rendered.get(k).title === "Design review"), offsetMin: 0, durMin: 90, color: "#2f9e44" };
		view.showDropPreview(col, new Date(2026, 10, 12), 14 * 60 + 15);
	});
	await page.screenshot({ path: path.join(SHOTS, "drag-move-preview.png"), clip: { x: 0, y: 40, width: 1120, height: 560 } });
});

test("month view shows start and end time", {}, async ({ page }) => {
	await page.evaluate(async () => {
		await plugin.store.addEvent({ calendarId: "personal", allDay: false, exdates: [], title: "Night shift", start: "2026-11-18T22:00", end: "2026-11-19T02:00" });
		view.goTo(new Date(2026, 10, 14), "month");
	});
	await page.waitForTimeout(150);
	const chip = (title, day) => page.evaluate(([title, day]) => {
		const cell = [...document.querySelectorAll(".ch-month-cell")].find((c) => c.querySelector(".ch-day-num")?.textContent === day && !c.classList.contains("ch-other-month"));
		const ch = [...cell.querySelectorAll(".ch-chip")].find((x) => x.textContent.includes(title));
		return ch?.querySelector(".ch-chip-time")?.textContent ?? null;
	}, [title, day]);
	eq(await chip("Design review", "14"), "10:00–11:30", "same-day range");
	eq(await chip("Night shift", "18"), "22:00 →", "first day of an overnight event");
	eq(await chip("Night shift", "19"), "→ 02:00", "last day");
	await page.evaluate(() => { plugin.settings.use24h = false; view.goTo(new Date(2026, 10, 14), "month"); });
	await page.waitForTimeout(100);
	eq(await chip("Design review", "14"), "10am–11:30am", "12-hour clock");
	await page.evaluate(() => { plugin.settings.use24h = true; view.goTo(new Date(2026, 10, 14), "month"); });
	await page.waitForTimeout(100);
	await page.screenshot({ path: path.join(SHOTS, "month-time-ranges.png"), clip: { x: 0, y: 0, width: 1120, height: 620 } });
});

test("desktop: responsive month/week at narrow widths", { width: 360 }, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(200);
	expect(await page.locator(".ch-month-compact").count() === 1, "month uses the compact grid when narrow");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(200);
	expect(await page.locator(".ch-tg-hscroll").count() === 1, "week scrolls sideways when narrow");
});

test("mobile touch: tap, long-press drag, double tap, cancelled gesture", { mobile: true }, async ({ page, ctx }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 18), "day"));
	await page.waitForTimeout(250);
	const cdp = await ctx.newCDPSession(page);
	const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
	const col = await page.locator(".ch-tg-col").first().boundingBox();
	const sc = await page.$eval(".ch-grid-scroll", (e) => e.getBoundingClientRect().top);
	const x = col.x + col.width / 2, y = sc + 200;
	const state = () => page.evaluate(() => ({ modals: document.querySelectorAll(".modal").length, ghosts: document.querySelectorAll(".ch-tg-selection").length }));
	const close = () => page.evaluate(() => document.querySelectorAll(".modal-container").forEach((m) => { m.remove(); }) || window.lastModal?.onClose?.());

	await touch("touchStart", x, y); await page.waitForTimeout(60); await touch("touchEnd"); await page.waitForTimeout(150);
	eq(await state(), { modals: 1, ghosts: 0 }, "tap"); await page.evaluate(() => window.lastModal.close());

	await touch("touchStart", x, y); await page.waitForTimeout(550);
	for (let i = 1; i <= 6; i++) { await touch("touchMove", x, y + i * 16); await page.waitForTimeout(15); }
	eq((await state()).ghosts, 1, "selection visible during long-press drag");
	await touch("touchEnd"); await page.waitForTimeout(150);
	eq(await state(), { modals: 1, ghosts: 0 }, "long-press drag"); await page.evaluate(() => window.lastModal.close());

	await touch("touchStart", x, y); await touch("touchEnd"); await page.waitForTimeout(30);
	await touch("touchStart", x, y + 50); await touch("touchEnd"); await page.waitForTimeout(150);
	eq((await state()).modals, 1, "double tap opens only one dialog"); await page.evaluate(() => window.lastModal.close());

	await page.evaluate(() => {
		const c = document.querySelector(".ch-tg-col");
		c.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, clientX: 100, clientY: 300, bubbles: true }));
		window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 7, pointerType: "touch", bubbles: true }));
	});
	await page.waitForTimeout(500);
	eq(await state(), { modals: 0, ghosts: 0 }, "cancelled gesture leaves nothing");
	void close;
});

test("mobile week: whole week, swipe, alignment, week bar", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 9), "week"));
	await page.waitForTimeout(300);
	const info = () => page.evaluate(() => {
		const w = document.querySelector(".ch-tg-hscroll"), sc = document.querySelector(".ch-grid-scroll");
		const dayW = parseFloat(w.style.getPropertyValue("--ch-day-w"));
		const heads = [...document.querySelectorAll(".ch-tg-dayhead")], cols = [...document.querySelectorAll(".ch-tg-col")];
		let mis = 0; cols.forEach((c, i) => (mis = Math.max(mis, Math.abs(heads[i].getBoundingClientRect().left - c.getBoundingClientRect().left))));
		return { cols: cols.length, first: cols[Math.round(sc.scrollLeft / dayW)].dataset.date, misalign: Math.round(mis),
			bar: [...document.querySelectorAll(".ch-week-bar-seg")].map((s) => (s.classList.contains("is-visible") ? "■" : "□")).join(""),
			title: document.querySelector(".ch-title").textContent };
	});
	const a = await info();
	eq([a.cols, a.first, a.misalign, a.bar, a.title], [7, "2026-11-09", 0, "■■■■□□□", "November 2026 · W46"], "start of week");
	await page.evaluate(() => { const sc = document.querySelector(".ch-grid-scroll"); sc.scrollLeft = sc.scrollWidth; });
	await page.waitForTimeout(300);
	const b = await info();
	eq([b.misalign, b.bar], [0, "□□□■■■■"], "end of week");
	await shot(page, "mobile-week-end", { x: 0, y: 0, width: 390, height: 400 });
});

test("mobile: compact month grid with bars, selected day list", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(200);
	const r = await page.evaluate(() => ({
		layout: document.querySelector(".ch-month-compact")?.className,
		cells: document.querySelectorAll(".ch-mc-row:not(.ch-mc-head) .ch-mc-cell").length,
		selected: document.querySelector(".ch-mc-cell.ch-selected .ch-mc-num")?.textContent,
		listTitle: document.querySelector(".ch-mc-day-title")?.textContent,
		items: [...document.querySelectorAll(".ch-mc-item .ch-chip-title")].map((e) => e.textContent),
		overflowX: document.querySelector(".ch-body").scrollWidth > document.querySelector(".ch-body").clientWidth,
	}));
	expect(/ch-bars/.test(r.layout), "phone width uses title bars: " + r.layout);
	eq(r.cells, 42, "6 weeks for November 2026 (Mon-first)");
	eq(r.selected, "14", "today selected");
	expect(/14/.test(r.listTitle), "list shows today: " + r.listTitle);
	expect(r.items.includes("Design review") && r.items.includes("Standup"), "today's events listed: " + JSON.stringify(r.items));
	eq(r.overflowX, false, "no sideways scrolling");
	await page.screenshot({ path: path.join(SHOTS, "mobile-month.png") });
	// tap another day: selects it, stays in month view
	const cell = page.locator(".ch-mc-cell", { hasText: "17" }).first();
	await cell.tap();
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => [view.mode, document.querySelector(".ch-mc-cell.ch-selected .ch-mc-num").textContent]), ["month", "17"], "tap selects day");
	expect((await page.textContent(".ch-mc-day")).includes("Vacation"), "list shows the 17th");
	// heading opens the day view
	await page.click(".ch-mc-day-title");
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => view.mode), "day", "heading opens day view");
});

test("desktop: very narrow month uses dots", { width: 560 }, async ({ page }) => {
	await page.evaluate(() => { document.getElementById("main").style.flex = "none"; document.getElementById("main").style.width = "260px"; view.handleResize(); view.goTo(new Date(2026, 10, 14), "month"); });
	await page.waitForTimeout(250);
	const r = await page.evaluate(() => ({ cls: document.querySelector(".ch-month-compact")?.className, dots: document.querySelectorAll(".ch-mc-dot").length }));
	expect(/ch-dots/.test(r.cls) && r.dots > 10, "dots layout: " + JSON.stringify(r));
	await page.locator("#main").screenshot({ path: path.join(SHOTS, "narrow-month-dots.png") });
});

test("mobile: week numbers in narrow layouts", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => { plugin.settings.showWeekNumbers = true; view.goTo(new Date(2026, 10, 14), "month"); });
	await page.waitForTimeout(200);
	eq(await page.$$eval(".ch-mc-row:not(.ch-mc-head) .ch-mc-wn", (d) => d.map((x) => x.textContent)), ["44", "45", "46", "47", "48", "49"], "month week numbers");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "day"));
	await page.waitForTimeout(150);
	expect((await page.textContent(".ch-title")).endsWith("· W46"), "day title has week number");
});

};
