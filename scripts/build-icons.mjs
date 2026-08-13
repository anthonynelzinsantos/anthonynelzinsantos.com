import { mkdtemp, readFile, writeFile, rm, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const run = promisify(execFile);
const SOURCE = path.join(ROOT, "assets", "icon.svg");
const OUT = path.join(ROOT, "static");

const SIZES = [
	{ file: "apple-touch-icon.png", size: 180 },
	{ file: "icon-192.png", size: 192 },
	{ file: "icon-512.png", size: 512 },
	{ file: "favicon-32.png", size: 32 },
];

try {
	await access(SOURCE);
} catch {
	console.error(`Missing ${SOURCE} — drop icon.svg in assets/ first.`);
	process.exit(1);
}

await mkdir(OUT, { recursive: true });
const work = await mkdtemp(path.join(tmpdir(), "icons-"));

for (const { file, size } of SIZES) {
	await run("qlmanage", ["-t", "-s", String(size), "-o", work, SOURCE]);
	const rendered = path.join(work, "icon.svg.png");
	await writeFile(path.join(OUT, file), await readFile(rendered));
	await rm(rendered, { force: true });
	console.log(`[icons] ${file} (${size}px)`);
}

await writeFile(path.join(OUT, "site.webmanifest"), JSON.stringify({
	name: "Anthony Nelzin-Santos",
	short_name: "ANS",
	icons: [
		{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
		{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
		{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
	],
	theme_color: "#5D1239",
	background_color: "#5D1239",
	display: "standalone",
}, null, 2) + "\n");

await writeFile(path.join(OUT, "icon.svg"), await readFile(SOURCE));
await rm(work, { recursive: true, force: true });
console.log("[icons] site.webmanifest, icon.svg");
