import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian", "electron",
		"@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands",
		"@codemirror/language", "@codemirror/lint", "@codemirror/search",
		"@codemirror/state", "@codemirror/view",
		"@lezer/common", "@lezer/highlight", "@lezer/lr",
		...builtins,
	],
	format: "cjs",
	target: "es2020",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	minify: prod,
	outfile: "main.js",
	// Built-in Google OAuth client (see src/sync/builtin.ts). Empty when not provided.
	define: {
		__OMNI_GOOGLE_CLIENT_ID__: JSON.stringify(process.env.OMNI_GOOGLE_CLIENT_ID ?? ""),
		__OMNI_GOOGLE_CLIENT_SECRET__: JSON.stringify(process.env.OMNI_GOOGLE_CLIENT_SECRET ?? ""),
	},
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
