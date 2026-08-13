#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadArchive, writeArchive, add, report, parseCSV } from "./lib.mjs";
const decode = (s) => s
	.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
	.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
	.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
	.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
	.replace(/&amp;/g, "&");

async function fromRSS() {
	const user = process.env.LETTERBOXD_USER;
	if (!user) { console.error("Missing LETTERBOXD_USER."); process.exit(1); }
	const res = await fetch(`https://letterboxd.com/${user}/rss/`);
	if (!res.ok) { console.error("Letterboxd responded", res.status); process.exit(1); }
	const xml = await res.text();

	const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
	const field = (bloc, tag) => {
		const m = bloc.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
		return m ? decode(m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim()) : undefined;
	};

	const films = [];
	for (const it of items) {
		const title = field(it, "letterboxd:filmTitle") || field(it, "title");
		const date = field(it, "letterboxd:watchedDate") || field(it, "pubDate");
		if (!title || !date) continue;
		const rating = field(it, "letterboxd:memberRating");
		const year = field(it, "letterboxd:filmYear");
		films.push({
			title,
			year: year ? Number(year) : undefined,
			date: new Date(date).toISOString().slice(0, 10),
			rating: rating ? Math.round(Number(rating)) : undefined,
			source: field(it, "link"),
		});
	}
	return films;
}

async function fromCSV(arg) {
	const folder = arg.endsWith(".csv") ? path.dirname(arg) : arg;
	const rows = parseCSV(await readFile(path.join(folder, "diary.csv"), "utf8"));
	const header = rows.shift().map((h) => h.trim());
	const col = (l, name) => l[header.indexOf(name)]?.trim() ?? "";

	const films = [];
	for (const l of rows.filter((l) => l.length > 1)) {
		const date = col(l, "Watched Date") || col(l, "Date");
		if (!date) continue;
		const rating = col(l, "Rating"), year = col(l, "Year");
		films.push({
			title: col(l, "Name"),
			year: year ? Number(year) : undefined,
			date,
			rating: rating ? Math.round(Number(rating)) : undefined,
			source: col(l, "Letterboxd URI") || undefined,
		});
	}
	return films;
}

const arg = process.argv[2];
const films = arg ? await fromCSV(arg) : await fromRSS();

const months = await loadArchive();
const tally = { added: 0, enriched: 0 };
for (const film of films) {
	const outcome = add(months, "films", film);
	if (outcome === "added") tally.added++;
	else if (outcome === "enriched") tally.enriched++;
}

await writeArchive(months);
report(arg ? "letterboxd (csv)" : "letterboxd", tally);
