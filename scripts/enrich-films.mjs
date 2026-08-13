#!/usr/bin/env node
import { loadArchive, writeArchive } from "./lib.mjs";

const DELAY = Number(process.env.DELAY || 250);
const LIMIT = Number(process.env.LIMIT || Infinity);
const UA = "anthonynelzinsantos.com (archive personal)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function directors(html) {
	const bloc = html.match(/"director":\[(.*?)\]/s);
	if (!bloc) return [];
	return [...bloc[1].matchAll(/"name":"([^"]*)"/g)]
		.map((m) => { try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; } })
		.filter(Boolean);
}

const archive = await loadArchive();
if (!archive.size) { console.error("archive/ is empty."); process.exit(1); }
const todo = new Map();
let already = 0, noLink = 0;
for (const contenu of archive.values()) {
	for (const film of contenu.films ?? []) {
		if (film.director) { already++; continue; }
		if (!film.source) { noLink++; continue; }
		if (!todo.has(film.source)) todo.set(film.source, []);
		todo.get(film.source).push(film);
	}
}

let enriched = 0, failures = 0, processed = 0;
const misses = [];

for (const [url, occurrences] of todo) {
	if (processed >= LIMIT) break;
	processed++;
	try {
		const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
		if (!res.ok) { misses.push(`${occurrences[0].title} : http ${res.status}`); failures++; continue; }
		const noms = directors(await res.text());
		if (!noms.length) { misses.push(`${occurrences[0].title} : no director on the page`); failures++; continue; }
		for (const film of occurrences) film.director = noms.join(", ");
		enriched += occurrences.length;
	} catch (e) {
		misses.push(`${occurrences[0].title} : ${e.message}`);
		failures++;
	}
	await sleep(DELAY);
}

await writeArchive(archive);
console.log(`[films] ${enriched} enriched, ${failures} failed, ${already} already done`
	+ (noLink ? `, ${noLink} sans link Letterboxd` : ""));
if (misses.length) console.log(misses.map((m) => "  " + m).join("\n"));
