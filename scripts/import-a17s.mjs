#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { loadArchive, writeArchive, add, report } from "./lib.mjs";

const SOURCE = path.resolve((process.argv[2] || "../a17s.com/content").replace(/^~/, homedir()));
function frontMatter(texte) {
	const m = texte.match(/^---\n([\s\S]*?)\n---/);
	const data = {};
	for (const row of (m ? m[1].split("\n") : [])) {
		const i = row.indexOf(":");
		if (i === -1) continue;
		const brut = row.slice(i + 1).trim();
		try { data[row.slice(0, i).trim()] = JSON.parse(brut); }
		catch { data[row.slice(0, i).trim()] = brut.replace(/^"|"$/g, ""); }
	}
	return data;
}
const SHELVES = {
	listens: ["albums", (d) => ({ title: d.title, artist: d.artist || d.by || undefined, source: d.external })],
	reads:   ["books", (d) => ({ title: d.title, author: d.author || d.by || undefined, rating: d.rating })],
	watches: ["films",  (d) => ({ title: d.title, director: d.director || undefined, year: d.year, rating: d.rating, source: d.external })],
};

const months = await loadArchive();
const tally = { added: 0, enriched: 0, reprises: 0 };
let read = 0;

for (const [section, [shelf, traduire]] of Object.entries(SHELVES)) {
	const dir = path.join(SOURCE, section);
	let bundles;
	try {
		bundles = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory());
	} catch {
		console.error(`Nothing to import from ${dir} — indiquez le filePath de content/ en argument.`);
		process.exit(1);
	}

	for (const b of bundles) {
		const d = frontMatter(await readFile(path.join(dir, b.name, "index.md"), "utf8"));
		if (!d.date || !d.title) continue;
		read++;

		const base = traduire(d);
		for (const k of Object.keys(base)) if (base[k] === undefined || base[k] === "") delete base[k];

		for (const [date, estReprise] of [[d.date, false], [d.updated, true]]) {
			if (!date) continue;
			const day = new Date(date).toISOString().slice(0, 10);
			const outcome = add(months, shelf, { ...base, date: day });
			if (outcome === "added") { tally.added++; if (estReprise) tally.reprises++; }
			else if (outcome === "enriched") tally.enriched++;
		}
	}
}

await writeArchive(months);
console.log(`[reprise] ${read} records read from ${SOURCE}`);
report("reprise a17s", tally);
console.log(`[reprise] archive/ now holds ${months.size} months.`);
