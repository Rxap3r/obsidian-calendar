/* Settings tab: tabs, scroll position, period settings. Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {

test("desktop: settings tabs and calendar menu", {}, async ({ page }) => {
	await page.evaluate(() => { const m = document.getElementById("main"); m.innerHTML = ""; tab.display(); m.appendChild(tab.containerEl); });
	const expected = { 0: "New events", 1: "Google & Outlook accounts", 2: "Calendar", 3: "Tasks", 4: "Event notes" };
	for (let i = 0; i < 5; i++) {
		await page.locator(".ch-settings-tab").nth(i).click();
		await page.waitForTimeout(80);
		const first = await page.$eval(".ch-settings-body .setting-item-heading .setting-item-name", (e) => e.textContent);
		eq(first, expected[i], `tab ${i} first heading`);
		await shot(page, `settings-tab-${i}`);
	}
	const r = await page.evaluate(() => {
		let opened = ""; plugin.app.setting = { open() { opened += "open"; }, openTabById(id) { opened += ":" + id; } };
		plugin.showCalendarMenu({ x: 10, y: 10 });
		window.lastMenu.items.find((i) => i.t === "Settings").fn();
		return { items: window.lastMenu.items.map((i) => i.t), opened };
	});
	eq(r.opened, "open:omni-calendar", "Settings menu entry opens plugin settings");
});

test("desktop: settings keep their scroll position, don't reveal the sidebar, defaults", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const out = {};
		const fresh = new plugin.constructor(plugin.app); await fresh.loadPluginData?.call(fresh);
		out.defaults = [fresh.settings?.sidebarOnExpand, fresh.settings?.sidebarAfterClose];
		const box = document.createElement("div");
		box.style.cssText = "position:fixed;left:0;top:0;width:600px;height:300px;overflow:auto;background:rgb(250, 250, 250);z-index:200";
		document.body.appendChild(box); box.appendChild(tab.containerEl);
		tab.constructor.tab = "display"; tab.display();
		tab.containerEl.style.padding = "24px 32px";
		box.scrollTop = 400; const before = box.scrollTop;
		const row = (re) => [...tab.containerEl.querySelectorAll(".setting-item")].find((x) => re.test(x.textContent));
		const sel = row(/When the day planner opens/).querySelector("select");
		sel.value = "close"; sel.dispatchEvent(new Event("change")); await new Promise((r) => setTimeout(r, 50));
		out.kept = Math.abs(box.scrollTop - before) < 2 && before > 0;
		out.subShown = !!row(/Then show this sidebar tab/);
		out.afterCloseDefault = row(/Then show this sidebar tab/).querySelector("select").value;
		ws.reveals = 0;
		const side = row(/Calendar in sidebar/).querySelector("select");
		side.value = "mini"; side.dispatchEvent(new Event("change")); await new Promise((r) => setTimeout(r, 50));
		out.reveals = ws.reveals;
		const mini = plugin.sidebarLeaves("omni-calendar-mini")[0];
		out.miniSelected = !!mini && mini.parent.selected === mini;
		const wrap = tab.containerEl.querySelector(".ch-settings-tabs-wrap");
		out.bg = getComputedStyle(wrap, "::before").backgroundColor;
		const b2 = box.scrollTop; tab.containerEl.querySelectorAll(".ch-settings-tab")[0].click();
		out.tabSwitchTop = box.scrollTop === 0 && b2 > 0;
		return out;
	});
	await page.evaluate(() => { tab.containerEl.parentElement.scrollTop = 250; });
	await page.screenshot({ path: path.join(SHOTS, "settings-scrolled.png"), clip: { x: 0, y: 0, width: 600, height: 300 } });
	eq(r.defaults, ["mini", ""], "defaults: switch to mini, let Obsidian decide");
	eq(r.kept, true, "scroll position kept after a change");
	eq([r.subShown, r.afterCloseDefault], [true, ""], "'Close' shows sub-setting with 'Let Obsidian decide'");
	eq([r.reveals, r.miniSelected], [0, true], "sidebar changed without revealing / closing settings");
	eq(r.bg, "rgb(250, 250, 250)", "tab bar background covers its surroundings");
	eq(r.tabSwitchTop, true, "switching tabs starts at the top");
});

test("settings: 'Custom…' periods (days / weeks / months / years)", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const m = document.getElementById("main"); m.innerHTML = ""; tab.constructor.tab = "tasks"; tab.display(); m.appendChild(tab.containerEl);
		const row = (re) => [...tab.containerEl.querySelectorAll(".setting-item")].find((x) => re.test(x.querySelector(".setting-item-name")?.textContent ?? ""));
		const out = {};
		const del = row(/Delete completed tasks after/);
		out.delOpts = [...del.querySelector("select").options].map((o) => o.text);
		out.customHidden = del.querySelector(".ch-period-custom").style.display;
		const sel = del.querySelector("select"); sel.value = "custom"; sel.dispatchEvent(new Event("change"));
		await new Promise((r) => setTimeout(r, 20));
		const num = del.querySelector(".ch-period-num"), unit = del.querySelector(".ch-period-unit");
		num.value = "2"; unit.value = "365"; unit.dispatchEvent(new Event("change"));
		await new Promise((r) => setTimeout(r, 20));
		out.del = plugin.settings.tasksDeleteDoneAfterDays;
		const up = row(/Upcoming list$/); const us = up.querySelector("select"); us.value = "custom"; us.dispatchEvent(new Event("change"));
		up.querySelector(".ch-period-num").value = "200"; up.querySelector(".ch-period-unit").value = "1"; up.querySelector(".ch-period-num").dispatchEvent(new Event("change"));
		await new Promise((r) => setTimeout(r, 20));
		out.up = plugin.settings.tasksUpcomingDays;
		// re-render shows the custom values in the best unit
		tab.display();
		const del2 = row(/Delete completed tasks after/);
		out.redisplay = [del2.querySelector("select").value, del2.querySelector(".ch-period-num").value, del2.querySelector(".ch-period-unit").selectedOptions[0].text];
		// limits: mini calendar upcoming max 365
		tab.constructor.tab = "display"; tab.display();
		const mini = row(/Upcoming list in the mini calendar/); const ms = mini.querySelector("select"); ms.value = "custom"; ms.dispatchEvent(new Event("change"));
		mini.querySelector(".ch-period-num").value = "5"; mini.querySelector(".ch-period-unit").value = "365"; mini.querySelector(".ch-period-num").dispatchEvent(new Event("change"));
		await new Promise((r) => setTimeout(r, 20));
		out.mini = plugin.settings.sidebarUpcomingDays;
		out.miniShown = [mini.querySelector(".ch-period-num").value, mini.querySelector(".ch-period-unit").selectedOptions[0].text];
		return out;
	});
	eq(r.delOpts, ["Never", "7 days", "2 weeks", "30 days", "60 days", "90 days", "6 months", "1 year", "Custom…"], "presets");
	eq(r.customHidden, "none", "custom field hidden for presets");
	eq([r.del, r.up, r.redisplay, r.mini, r.miniShown], [730, 200, ["custom", "2", "years"], 365, ["1", "years"]], "custom values (2 years, 200 days), redisplay, limit shown");
	await page.screenshot({ path: path.join(SHOTS, "settings-periods.png") });
});

test("settings: every period setting offers the same standard choices", {}, async ({ page }) => {
	const r = await page.evaluate(() => {
		const out = {};
		for (const tabId of ["display", "tasks"]) {
			tab.constructor.tab = tabId; tab.display();
			for (const row of tab.containerEl.querySelectorAll(".ch-period-setting")) {
				out[row.querySelector(".setting-item-name").textContent] = [...row.querySelector("select").options].map((o) => o.text);
			}
		}
		return out;
	});
	const STD = ["7 days", "2 weeks", "30 days", "60 days", "90 days", "6 months", "1 year"];
	eq(Object.keys(r), ["Agenda length", "Upcoming list in the mini calendar", "Upcoming list", "Show completed tasks from the last", "Delete completed tasks after"], "period settings found");
	for (const [name, opts] of Object.entries(r)) {
		eq(opts.filter((o) => STD.includes(o)), STD, `${name}: standard choices`);
		eq(opts[opts.length - 1], "Custom…", `${name}: Custom… last`);
	}
	eq(r["Upcoming list in the mini calendar"], ["Hidden", "Tomorrow only", ...STD, "Same as agenda length", "Custom…"], "mini calendar extras");
	eq(r["Delete completed tasks after"][0], "Never", "Never first");
});

test("desktop: settings tab bar – no arrows when everything fits; arrows beside, not over the tabs", {}, async ({ page }) => {
	// Like Obsidian: the settings content is rendered before the window has its width.
	await page.evaluate(() => {
		const m = document.getElementById("main"); m.innerHTML = "";
		const host = document.createElement("div"); host.style.width = "0px"; host.id = "settings-host"; m.appendChild(host);
		tab.display(); host.appendChild(tab.containerEl);
	});
	await page.waitForTimeout(100);
	await page.evaluate(() => (document.getElementById("settings-host").style.width = "900px"));
	await page.waitForTimeout(150);
	const wide = await page.evaluate(() => [...document.querySelectorAll(".ch-tabs-arrow")].map((a) => getComputedStyle(a).display));
	eq(wide, ["none", "none"], "wide window: no arrows");
	await page.evaluate(() => (document.getElementById("settings-host").style.width = "300px"));
	await page.waitForTimeout(150);
	const narrow = await page.evaluate(() => {
		const bar = document.querySelector(".ch-settings-tabs").getBoundingClientRect();
		const next = document.querySelector(".ch-tabs-next"); const n = next.getBoundingClientRect();
		return { shown: getComputedStyle(next).display !== "none", beside: n.left >= bar.right - 1 };
	});
	eq(narrow, { shown: true, beside: true }, "narrow: right arrow shown, beside the tabs");
	await page.evaluate(() => (document.getElementById("settings-host").style.width = "900px"));
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => [...document.querySelectorAll(".ch-tabs-arrow")].map((a) => getComputedStyle(a).display)), ["none", "none"], "widened again: arrows gone");
	await page.locator("#settings-host").screenshot({ path: path.join(SHOTS, "settings-tabs-wide.png") });
});

test("mobile: settings tabs stay on one line and scroll", { mobile: true, width: 340 }, async ({ page }) => {
	await page.evaluate(() => { const m = document.getElementById("main"); m.innerHTML = ""; tab.display(); m.appendChild(tab.containerEl); });
	await page.waitForTimeout(150);
	const r = await page.evaluate(() => {
		const bar = document.querySelector(".ch-settings-tabs");
		return { oneLine: new Set([...bar.children].map((c) => Math.round(c.getBoundingClientRect().top))).size === 1,
			scrollable: bar.scrollWidth > bar.clientWidth, nextArrow: !document.querySelector(".ch-tabs-next").classList.contains("is-hidden") };
	});
	eq(r, { oneLine: true, scrollable: true, nextArrow: true }, "tab bar");
});

};
