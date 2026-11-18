/* Calendar views: month/week/day/agenda, drag & drop, touch, narrow layouts. Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, settle, shot, path, SHOTS }) => {

test("desktop: all views render (screenshots)", {}, async ({ page }) => {
	for (const mode of ["month", "week", "day", "agenda"]) {
		await page.evaluate((m) => view.goTo(new Date(2026, 10, 14), m), mode);
		await settle(page);
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
	// Wait until the grid has finished scrolling to its start hour (the block stops moving).
	let box = await ev.boundingBox();
	for (let i = 0; i < 20; i++) {
		await page.waitForTimeout(50);
		const next = await ev.boundingBox();
		if (next.y === box.y) break;
		box = next;
	}
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
		view.drag.grabbed = { key: [...view.drag.rendered.keys()].find((k) => view.drag.rendered.get(k).title === "Design review"), offsetMin: 0, durMin: 90, color: "#2f9e44" };
		view.drag.showPreview(col, new Date(2026, 10, 12), 14 * 60 + 15);
	});
	await page.screenshot({ path: path.join(SHOTS, "drag-move-preview.png"), clip: { x: 0, y: 40, width: 1120, height: 560 } });
});

test("month view shows start and end time", {}, async ({ page }) => {
	await page.evaluate(async () => {
		await plugin.store.addEvent({ calendarId: "personal", allDay: false, exdates: [], title: "Night shift", start: "2026-11-18T22:00", end: "2026-11-19T02:00" });
		view.goTo(new Date(2026, 10, 14), "month");
	});
	await settle(page);
	const chip = (title, day) => page.evaluate(([title, day]) => {
		const cell = [...document.querySelectorAll(".ch-month-cell")].find((c) => c.querySelector(".ch-day-num")?.textContent === day && !c.classList.contains("ch-other-month"));
		const ch = [...cell.querySelectorAll(".ch-chip")].find((x) => x.textContent.includes(title));
		return ch?.querySelector(".ch-chip-time")?.textContent ?? null;
	}, [title, day]);
	eq(await chip("Design review", "14"), "10:00–11:30", "same-day range");
	eq(await chip("Night shift", "18"), "22:00 →", "first day of an overnight event");
	eq(await chip("Night shift", "19"), "→ 02:00", "last day");
	await page.evaluate(() => { plugin.settings.use24h = false; view.goTo(new Date(2026, 10, 14), "month"); });
	await settle(page);
	eq(await chip("Design review", "14"), "10am–11:30am", "12-hour clock");
	await page.evaluate(() => { plugin.settings.use24h = true; view.goTo(new Date(2026, 10, 14), "month"); });
	await settle(page);
	await page.screenshot({ path: path.join(SHOTS, "month-time-ranges.png"), clip: { x: 0, y: 0, width: 1120, height: 620 } });
});

test("desktop: responsive month/week at narrow widths", { width: 360 }, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await settle(page);
	expect(await page.locator(".ch-month-compact").count() === 1, "month uses the compact grid when narrow");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await settle(page);
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
	await settle(page);
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
	await settle(page);
	eq(await page.evaluate(() => [view.mode, document.querySelector(".ch-mc-cell.ch-selected .ch-mc-num").textContent]), ["month", "17"], "tap selects day");
	expect((await page.textContent(".ch-mc-day")).includes("Vacation"), "list shows the 17th");
	// heading opens the day view
	await page.click(".ch-mc-day-title");
	await settle(page);
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
	await settle(page);
	eq(await page.$$eval(".ch-mc-row:not(.ch-mc-head) .ch-mc-wn", (d) => d.map((x) => x.textContent)), ["44", "45", "46", "47", "48", "49"], "month week numbers");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "day"));
	await settle(page);
	expect((await page.textContent(".ch-title")).endsWith("· W46"), "day title has week number");
});


test("desktop: drag to create continues into the next days (overnight, several days, backwards)", {}, async ({ page }) => {
	await page.evaluate(() => { view.goTo(new Date(2026, 10, 9), "week"); });
	await page.waitForTimeout(250);
	// Start at Wednesday 12:00 regardless of where the grid is scrolled.
	await page.evaluate(() => { document.querySelector(".ch-grid-scroll").scrollTop = 11 * 48; });
	await page.waitForTimeout(100);
	const H = 48;
	const cols = page.locator(".ch-tg-col");
	const colBox = async (i) => cols.nth(i).boundingBox();
	const yAt = async (i, hour) => (await colBox(i)).y + hour * H + 2;
	const xAt = async (i) => { const b = await colBox(i); return b.x + b.width / 2; };
	let shotTaken = 0;
	const drag = async (from, to) => {
		await page.mouse.move(await xAt(from[0]), await yAt(from[0], from[1]));
		await page.mouse.down();
		await page.mouse.move(await xAt(to[0]), await yAt(to[0], to[1]), { steps: 10 });
		await page.waitForTimeout(80);
		const shown = await page.evaluate(() => ({ blocks: document.querySelectorAll(".ch-tg-selection").length, label: document.querySelector(".ch-tg-selection-time")?.textContent }));
		if (!shotTaken++) await shot(page, "drag-create-overnight");
		await page.mouse.up();
		await page.waitForTimeout(120);
		await page.fill(".ch-title-input", "Dragged");
		await page.click(".ch-modal-buttons button.mod-cta");
		await page.waitForTimeout(120);
		const ev = await page.evaluate(() => { const e = plugin.data.events.filter((x) => x.title === "Dragged").pop(); return [e.start, e.end]; });
		return { shown, ev };
	};
	// Wednesday 12:00 → Thursday 06:00 (ends at the end of the 05:45 slot = 06:00).
	let r = await drag([2, 12], [3, 5.75]);
	eq(r.shown, { blocks: 2, label: "Wed 12:00 – Thu 06:00" }, "two blocks, label with weekdays");
	eq(r.ev, ["2026-11-11T12:00", "2026-11-12T06:00"], "overnight event");
	// Several days: Monday 22:00 → Thursday 01:00.
	await page.evaluate(() => { document.querySelector(".ch-grid-scroll").scrollTop = 0; });
	await page.waitForTimeout(80);
	r = await drag([0, 15], [3, 0.75]);
	eq(r.shown.blocks, 4, "a block on each day");
	eq(r.ev, ["2026-11-09T15:00", "2026-11-12T01:00"], "multi-day event");
	// Dragging backwards into the previous day.
	r = await drag([4, 3], [3, 15]);
	eq(r.ev, ["2026-11-12T15:00", "2026-11-13T03:15"], "backwards: from the earlier slot to the pressed one");
});


test("mobile touch: long press, then drag into the next day of the week", { mobile: true }, async ({ page, ctx }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 9), "week"));
	await page.waitForTimeout(300);
	await page.evaluate(() => { document.querySelector(".ch-grid-scroll").scrollTop = 18 * 48; });
	await page.waitForTimeout(100);
	const cdp = await ctx.newCDPSession(page);
	const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
	const c0 = await page.locator(".ch-tg-col").nth(0).boundingBox();
	const c1 = await page.locator(".ch-tg-col").nth(1).boundingBox();
	const x0 = c0.x + c0.width / 2, y0 = c0.y + 20 * 48 + 2; // Monday 20:00
	await touch("touchStart", x0, y0); await page.waitForTimeout(550);
	const x1 = c1.x + c1.width / 2, y1 = c1.y + 18 * 48 + 2; // Tuesday 18:00 (still on screen)
	for (let i = 1; i <= 8; i++) { await touch("touchMove", x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8); await page.waitForTimeout(15); }
	eq(await page.evaluate(() => document.querySelectorAll(".ch-tg-selection").length), 2, "selection on both days");
	await touch("touchEnd"); await page.waitForTimeout(150);
	await page.fill(".ch-title-input", "Night shift");
	await page.locator(".ch-modal-buttons button.mod-cta").tap();
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => { const e = plugin.data.events.find((x) => x.title === "Night shift"); return [e.start, e.end]; }), ["2026-11-09T20:00", "2026-11-10T18:15"], "event over two days");
});


for (const mobile of [false, true]) {
	test(`${mobile ? "mobile" : "desktop"}: timed events over several days stay in the hour grid (not the all-day row)`, { mobile }, async ({ page }) => {
		await page.evaluate(async () => {
			const add = (e) => plugin.store.addEvent({ calendarId: "personal", allDay: false, exdates: [], ...e });
			await add({ title: "Overnight", start: "2026-11-09T09:00", end: "2026-11-10T10:00" });
			await add({ title: "Conference", start: "2026-11-11T14:00", end: "2026-11-13T12:00" });
			view.goTo(new Date(2026, 10, 9), "week");
		});
		await page.waitForTimeout(250);
		const r = await page.evaluate(() => {
			const H = 48;
			const blocks = (title) => [...document.querySelectorAll(".ch-tg-event")].filter((b) => b.querySelector(".ch-tg-event-title").textContent === title)
				.map((b) => [b.closest(".ch-tg-col").dataset.date, b.querySelector(".ch-tg-event-time").textContent, Math.round(parseFloat(b.style.top) / H * 4) / 4, Math.round((parseFloat(b.style.height) + 2) / H * 4) / 4]);
			return {
				allDayRow: [...document.querySelectorAll(".ch-tg-allday-cell .ch-chip")].map((c) => c.textContent).filter((t) => /Overnight|Conference/.test(t)),
				overnight: blocks("Overnight"), conference: blocks("Conference"),
			};
		});
		eq(r.allDayRow, [], "not in the all-day row");
		eq(r.overnight, [["2026-11-09", "09:00 →", 9, 15], ["2026-11-10", "→ 10:00", 0, 10]], "Mon 09:00 → end of day, Tue start of day → 10:00");
		eq(r.conference.map((b) => [b[0], b[1]]), [["2026-11-11", "14:00 →"], ["2026-11-12", "→"], ["2026-11-13", "→ 12:00"]], "a block on each day, labels");
		eq(r.conference[1].slice(2), [0, 24], "the day in between is filled");
		await page.evaluate(() => { document.querySelector(".ch-grid-scroll").scrollTop = 7 * 48; });
		await page.waitForTimeout(100);
		await shot(page, `${mobile ? "mobile-" : ""}week-multiday-timed`);
	});
}


{ // Desktop only: the phone version checked the same; the default (hour grid) is tested on both above.
	const mobile = false;
	test(`desktop: setting – events over several days in the all-day row, labelled with their whole span`, { mobile }, async ({ page }) => {
		await page.evaluate(async () => {
			const add = (e) => plugin.store.addEvent({ calendarId: "personal", allDay: false, exdates: [], ...e });
			await add({ title: "Overnight", start: "2026-11-09T09:00", end: "2026-11-10T10:00" });
			await add({ title: "Late show", start: "2026-11-11T20:00", end: "2026-11-12T00:00" }); // ends at midnight: one day only
			plugin.settings.multiDayTimed = "allday";
			view.goTo(new Date(2026, 10, 9), "week");
		});
		await page.waitForTimeout(250);
		const r = await page.evaluate(() => ({
			row: [...document.querySelectorAll(".ch-tg-allday-cell .ch-chip")].filter((c) => /Overnight|Late show/.test(c.textContent))
				.map((c) => [c.closest(".ch-tg-allday-cell") === document.querySelectorAll(".ch-tg-allday-cell")[0] ? "Mon" : "Tue", c.querySelector(".ch-chip-span")?.textContent ?? null, c.querySelector(".ch-chip-title").textContent]),
			grid: [...document.querySelectorAll(".ch-tg-event-title")].map((t) => t.firstChild.textContent).filter((t) => /Overnight|Late show/.test(t)),
		}));
		eq(r.row, [["Mon", "Mon 09:00 – Tue 10:00", "Overnight"], ["Tue", "Mon 09:00 – Tue 10:00", "Overnight"]], "all-day row, whole span on both days");
		eq(r.grid, ["Late show"], "an event ending at midnight stays a normal block");
		await shot(page, `${mobile ? "mobile-" : ""}week-multiday-allday-row`);
		// Back to the default: in the hours.
		await page.evaluate(() => { plugin.settings.multiDayTimed = "grid"; plugin.store.notify(); });
		await settle(page);
		eq(await page.locator(".ch-tg-allday-cell .ch-chip", { hasText: "Overnight" }).count(), 0, "default: not in the all-day row");
	});
}


test("desktop: drag an event's top or bottom edge to change its start or end (also into the next day)", {}, async ({ page }) => {
	await page.evaluate(async () => {
		await plugin.store.addEvent({ calendarId: "personal", allDay: false, exdates: [], title: "Overnight", start: "2026-11-09T09:00", end: "2026-11-10T10:00" });
		window.updates = [];
		plugin.store.updateRemote = async (o, i) => window.updates.push([o.remote.id, i.start.getHours(), i.end.getHours()]);
		view.goTo(new Date(2026, 10, 9), "week");
	});
	await page.waitForTimeout(250);
	await page.evaluate(() => { document.querySelector(".ch-grid-scroll").scrollTop = 7 * 48; });
	await page.waitForTimeout(100);
	const H = 48;
	const ev = (title, i = 0) => page.locator(".ch-tg-event", { hasText: title }).nth(i);
	const dragEdge = async (title, edge, dx, dy, i = 0) => {
		const b = await ev(title, i).locator(`.ch-tg-resize-${edge}`).boundingBox();
		const x = b.x + b.width / 2, y = b.y + b.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + dx, y + dy, { steps: 8 });
		await page.waitForTimeout(60);
		const preview = await page.evaluate(() => document.querySelector(".ch-resize-preview .ch-tg-selection-time")?.textContent ?? null);
		await page.mouse.up();
		await page.waitForTimeout(150);
		return preview;
	};
	const stored = (title) => page.evaluate((t) => { const e = plugin.data.events.find((x) => x.title === t); return [e.start, e.end]; }, title);
	// Saturday's "Design review" 10:00–11:30: end one hour later, then start half an hour earlier.
	eq(await dragEdge("Design review", "end", 0, H), "10:00 – 12:30", "preview while dragging the end");
	eq(await stored("Design review"), ["2026-11-14T10:00", "2026-11-14T12:30"], "end moved");
	eq(await page.locator(".modal").count(), 0, "no dialog opened");
	await dragEdge("Design review", "start", 0, -H / 2);
	eq(await stored("Design review"), ["2026-11-14T09:30", "2026-11-14T12:30"], "start moved");
	// Overnight Mon 09:00 – Tue 10:00: the end is on Tuesday's block; drag it into Wednesday, 2 hours earlier.
	const colW = (await page.locator(".ch-tg-col").first().boundingBox()).width;
	eq(await page.locator(".ch-tg-event", { hasText: "Overnight" }).nth(0).locator(".ch-tg-resize-end").count(), 0, "first day: no end edge");
	eq(await page.locator(".ch-tg-event", { hasText: "Overnight" }).nth(1).locator(".ch-tg-resize-start").count(), 0, "last day: no start edge");
	eq(await dragEdge("Overnight", "end", colW, -2 * H, 1), "Mon 09:00 – Wed 08:00", "preview over three days");
	eq(await stored("Overnight"), ["2026-11-09T09:00", "2026-11-11T08:00"], "end on Wednesday");
	// Google event: saved to Google. Repeating local event: no edges.
	await page.evaluate(() => view.goTo(new Date(2026, 10, 15), "week"));
	await page.waitForTimeout(200);
	await dragEdge("Dentist", "end", 0, H);
	eq(await page.evaluate(() => window.updates), [["g1", 14, 16]], "Google event updated");
	eq(await page.locator(".ch-tg-event", { hasText: "Standup" }).first().locator(".ch-tg-resize").count(), 0, "repeating event: no edges");
	// The edge can't go past the other edge: at least 15 minutes remain.
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(200);
	await dragEdge("Overlapping call", "end", 0, -3 * H);
	eq(await stored("Overlapping call"), ["2026-11-14T11:00", "2026-11-14T11:15"], "at least 15 minutes");
});

test("mobile: drag an event's bottom edge with the finger", { mobile: true }, async ({ page, ctx }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "day"));
	await page.waitForTimeout(250);
	await page.evaluate(() => { document.querySelector(".ch-grid-scroll").scrollTop = 8 * 48; });
	await page.waitForTimeout(100);
	const cdp = await ctx.newCDPSession(page);
	const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
	const b = await page.locator(".ch-tg-event", { hasText: "Design review" }).locator(".ch-tg-resize-end").boundingBox();
	const x = b.x + b.width / 2, y = b.y + b.height / 2;
	await touch("touchStart", x, y);
	for (let i = 1; i <= 6; i++) { await touch("touchMove", x, y + i * 8); await page.waitForTimeout(15); }
	await page.screenshot({ path: path.join(SHOTS, "mobile-resize-event.png") });
	await touch("touchEnd"); await page.waitForTimeout(200);
	eq(await page.evaluate(() => { const e = plugin.data.events.find((x) => x.title === "Design review"); return [e.start, e.end]; }), ["2026-11-14T10:00", "2026-11-14T12:30"], "end one hour later");
	eq(await page.evaluate(() => [document.querySelectorAll(".modal").length, document.querySelectorAll(".ch-tg-selection").length]), [0, 0], "no dialog, no new-event selection");
});


test("desktop: lock the calendar – icon next to the title, no dragging / resizing / creating; unlocking asks; per device", {}, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "day"));
	await settle(page);
	const icon = () => page.evaluate(() => { const i = view.containerEl.querySelector(".view-header-title + .ch-lock-indicator"); return i ? [i.classList.contains("is-locked"), i.getAttribute("aria-label")] : null; });
	const r0 = await icon();
	expect(r0 && r0[0] === false, `faint open lock right of the title while unlocked: ${r0}`);
	const parts = () => page.evaluate(() => [document.querySelectorAll('.ch-tg-event[draggable="true"]').length, document.querySelectorAll(".ch-tg-resize").length]);
	const before = await parts();
	expect(before[0] > 0 && before[1] > 0, `draggable events and resize edges while unlocked: ${before}`);
	// Clicking the icon locks at once.
	await page.evaluate(() => view.containerEl.querySelector(".ch-lock-indicator").click());
	await settle(page);
	eq([(await icon())[0], await page.evaluate(() => [plugin.lock.locked, window.deviceStorage["omni-calendar-locked"]])], [true, [true, "1"]], "locked, stored on this device");
	eq(await parts(), [0, 0], "no dragging, no resize edges");
	// Pressing on an empty slot creates nothing; clicking an event still opens it.
	const col = await page.locator(".ch-tg-col").first().boundingBox();
	await page.mouse.click(col.x + col.width / 2, col.y + 40);
	await settle(page);
	eq(await page.evaluate(() => __eventMod.EventModal.openCount), 0, "no new-event dialog");
	await page.locator(".ch-tg-event", { hasText: "Design review" }).click();
	await settle(page);
	eq(await page.inputValue(".ch-title-input"), "Design review", "an event still opens (and can be edited on purpose)");
	await page.locator(".ch-modal-buttons button", { hasText: "Cancel" }).click();
	// Month: chips can't be dragged, double-click doesn't create.
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await settle(page);
	eq(await page.locator('.ch-chip[draggable="true"]').count(), 0, "month chips not draggable");
	await page.locator(".ch-month-cell").nth(10).dblclick();
	eq(await page.evaluate(() => __eventMod.EventModal.openCount), 0, "double-click creates nothing");
	// Unlocking from the icon asks first; Cancel keeps it locked.
	await page.evaluate(() => view.containerEl.querySelector(".ch-lock-indicator").click());
	await settle(page);
	expect((await page.locator(".modal").last().textContent()).includes("Unlock the calendar?"), "asks before unlocking");
	await page.locator(".modal button", { hasText: "Cancel" }).last().click();
	await settle(page);
	eq(await page.evaluate(() => plugin.lock.locked), true, "Cancel keeps it locked");
	await page.evaluate(() => view.containerEl.querySelector(".ch-lock-indicator").click());
	await page.locator(".modal .mod-warning", { hasText: "Unlock" }).click();
	await settle(page);
	eq([await page.evaluate(() => [plugin.lock.locked, "omni-calendar-locked" in window.deviceStorage]), (await icon())[0]], [[false, false], false], "unlocked");
	expect((await page.locator('.ch-chip[draggable="true"]').count()) > 0, "chips draggable again");
	// Ribbon menu entry and command (no question there: the words say what happens).
	const menu = () => page.evaluate(() => { window.__ts = 0; plugin.ribbonMenuShownAt = 0; plugin.showCalendarMenu({ x: 1, y: 1 }); return window.lastMenu.items.map((i) => i.t); });
	expect((await menu()).includes("Lock calendar"), "menu: Lock calendar");
	await page.evaluate(() => plugin.commands.find((c) => c.id === "toggle-calendar-lock").callback());
	await settle(page);
	expect((await menu()).includes("Unlock calendar"), "command locked it; menu: Unlock calendar");
	// Read back on the next start (stored per device, not in data.json).
	eq(await page.evaluate(() => [new plugin.lock.constructor(plugin).locked, JSON.stringify(plugin.data).includes("locked")]), [true, false], "remembered on this device only");
});

test("mobile: locked calendar – tapping and long-pressing the grid create nothing", { mobile: true }, async ({ page, ctx }) => {
	await page.evaluate(() => { plugin.lock.set(true); view.goTo(new Date(2026, 10, 18), "day"); });
	await page.waitForTimeout(250);
	const cdp = await ctx.newCDPSession(page);
	const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
	const col = await page.locator(".ch-tg-col").first().boundingBox();
	const x = col.x + col.width / 2, y = col.y + 60;
	await touch("touchStart", x, y);
	await touch("touchEnd");
	await page.waitForTimeout(150);
	await touch("touchStart", x, y);
	await page.waitForTimeout(500); // long press
	await touch("touchMove", x, y + 80);
	await touch("touchEnd");
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => __eventMod.EventModal.openCount), 0, "no dialog by tapping or long-pressing");
});

};
