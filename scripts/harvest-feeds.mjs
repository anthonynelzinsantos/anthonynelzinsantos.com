#!/usr/bin/env node
import { loadArchive, writeArchive, add, report } from "./lib.mjs";

const SITES = {
	dispatches: { name: "Z1NZ0L1N", feed: "https://z1nz0l1n.com/feed" },
	architypes: { name: "Architypes", feed: "https://archityp.es/index.xml" },
	episodes: { name: "À bâtons rompus", feed: "https://abatonsrompus.fr/index.xml" },
};

const UA = "anthonynelzinsantos.com (archive personal)";
const decode = (s) => s
	.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
	.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
	.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
	.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
	.replace(/&amp;/g, "&");

const field = (bloc, tag) => {
	const m = bloc.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
	return m ? decode(m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim()) : undefined;
};

async function readFeed(url) {
	const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
	if (!res.ok) throw new Error(`${url} responded ${res.status}`);
	const xml = await res.text();

	const entries = [];
	for (const bloc of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])) {
		const date = field(bloc, "pubDate");
		const link = field(bloc, "link");
		if (!date || !link) continue;
		entries.push({
			title: field(bloc, "title") || link,
			date: new Date(date).toISOString().slice(0, 10),
			source: link,
		});
	}
	return entries;
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SITES);
const months = await loadArchive();
const tally = { added: 0, enriched: 0 };

for (const shelf of wanted) {
	const site = SITES[shelf];
	if (!site) { console.warn(`[feed] unknown shelf: ${shelf}`); continue; }
	try {
		const entries = await readFeed(site.feed);
		for (const e of entries) {
			const outcome = add(months, shelf, e);
			if (outcome === "added") tally.added++;
			else if (outcome === "enriched") tally.enriched++;
		}
		console.log(`[feed] ${site.name} : ${entries.length} entries read`);
	} catch (e) {
		console.error(`[feed] ${site.name} : ${e.message}`);
	}
}

await writeArchive(months);
report("feed", tally);
