/* eslint-disable */
/**
 * Tests for sign-in (OAuth/PKCE loopback flow) and the Google / Outlook connectors,
 * against simulated provider responses. Usage: npm run test:sync
 */
const path = require("path");
const { execFileSync } = require("child_process");
const esbuild = require("esbuild");
const out = path.resolve(__dirname, "../.out/sync-test.cjs");
esbuild.buildSync({
	entryPoints: [path.join(__dirname, "sync.test.ts")], bundle: true, platform: "node", format: "cjs", outfile: out,
	alias: { obsidian: path.join(__dirname, "obsidian-mock.ts") }, logLevel: "error",
});
try {
	execFileSync(process.execPath, [out], { stdio: "inherit", env: { ...process.env, TZ: "Europe/Zurich" } });
} catch {
	process.exit(1);
}
