/* eslint-disable */
/**
 * Browser tests for Omni Calendar's UI (views, modals, settings, touch gestures).
 * Usage:  npm run test:ui            (all tests)
 *         npm run test:ui -- touch   (only tests whose name contains "touch")
 * Screenshots of key screens are written to tests/.out/shots/ for visual checks.
 *
 * The real plugin code is bundled against tests/ui/obsidian-mock.ts. Time is frozen at
 * 2026-11-14 10:00 (Europe/Zurich) so results are reproducible. Requires Playwright with Chromium.
 */
const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "tests/.out");
const SHOTS = path.join(OUT, "shots");
const PAGE = "file://" + path.join(__dirname, "index.html");
const ICS = fs.readFileSync(path.join(__dirname, "fixtures.ics"), "utf8");
const NOW = new Date("2026-11-14T10:00:00+01:00");
const filter = process.argv[2] || "";

const tests = [];
let currentFile = "";
const test = (name, opts, fn) => tests.push({ name, opts, fn, file: currentFile });
function expect(cond, msg) { if (!cond) throw new Error(msg); }
const eq = (a, b, msg) => expect(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

async function open(browser, { mobile = false, width, height } = {}) {
	const ctx = await browser.newContext({
		viewport: { width: width ?? (mobile ? 390 : 1400), height: height ?? (mobile ? 800 : 900) },
		hasTouch: mobile, isMobile: mobile, timezoneId: "Europe/Zurich", locale: "en-US",
	});
	const page = await ctx.newPage();
	const errors = [];
	page.on("pageerror", (e) => errors.push(String(e)));
	await page.clock.setFixedTime(NOW);
	await page.goto(PAGE);
	await page.evaluate(([ics, mobile]) => window.boot(ics, { mobile }), [ICS, mobile]);
	await settle(page);
	if (mobile || (width && width < 700)) await page.evaluate(() => (document.getElementById("side").style.display = "none"));
	return { ctx, page, errors };
}
/** Waits until the plugin has redrawn: two animation frames (views redraw in the next frame) plus a short
 *  moment for the dialogs' 10 ms focus timer. Use it instead of a fixed pause after a click or a change.
 *  Drags, touch gestures, scrolling and the sidebar have their own timers (150–400 ms): keep real pauses there. */
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 25)))));
const shot = (page, name, clip) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), clip });

// Tests live in tests/ui/specs/<topic>.cjs (one file per topic). `npm run test:ui -- tasks` runs a whole topic
// file; any other word runs only the tests whose name contains it.
const SPECS = path.join(__dirname, "specs");
for (const f of fs.readdirSync(SPECS).filter((f) => f.endsWith(".cjs")).sort()) {
	currentFile = f.replace(/\.cjs$/, "");
	require(path.join(SPECS, f))({ test, expect, eq, settle, shot, path, SHOTS });
}

// ======================================================================== runner

(async () => {
	fs.mkdirSync(SHOTS, { recursive: true });
	await esbuild.build({
		entryPoints: [path.join(__dirname, "entry.ts")], bundle: true, format: "iife", outfile: path.join(OUT, "ui-bundle.js"),
		alias: { obsidian: path.join(__dirname, "obsidian-mock.ts") }, external: ["http"], logLevel: "error",
		define: { __OMNI_GOOGLE_CLIENT_ID__: '""', __OMNI_GOOGLE_CLIENT_SECRET__: '""' },
	});
	const browser = await chromium.launch();
	let failed = 0, ran = 0;
	for (const t of tests) {
		if (filter && t.file !== filter && !t.name.includes(filter)) continue;
		ran++;
		const env = await open(browser, t.opts);
		try {
			await t.fn(env);
			const errs = env.errors.filter((e) => !/getRightLeaf|getLeftLeaf/.test(e));
			expect(!errs.length, `page errors: ${errs.join(" | ")}`);
			console.log(`PASS  [${t.file}] ${t.name}`);
		} catch (e) {
			failed++;
			console.log(`FAIL  [${t.file}] ${t.name}\n      ${e.message.split("\n")[0]}`);
			await shot(env.page, `FAIL-${t.name.replace(/[^\w]+/g, "_")}`).catch(() => {});
		}
		await env.ctx.close();
	}
	await browser.close();
	console.log(`\n${ran - failed}/${ran} passed${failed ? ` – ${failed} failed (see tests/.out/shots/FAIL-*.png)` : ""}`);
	process.exit(failed ? 1 : 0);
})();
