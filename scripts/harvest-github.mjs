#!/usr/bin/env node
import { loadArchive, writeArchive, add, report } from "./lib.mjs";

const USER = process.env.GITHUB_USER || "anthonynelzinsantos";
const UA = "anthonynelzinsantos.com (archive personal)";
async function calendar(year) {
	const url = `https://github.com/users/${USER}/contributions?from=${year}-01-01&to=${year}-12-31`;
	const res = await fetch(url, { headers: { "user-agent": UA } });
	if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
	const html = await res.text();

	const dates = new Map();
	for (const m of html.matchAll(/<td[^>]*?id="([^"]+)"[^>]*?data-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g)) {
		dates.set(m[1], m[2]);
	}
	for (const m of html.matchAll(/<td[^>]*?data-date="(\d{4}-\d{2}-\d{2})"[^>]*?id="([^"]+)"[^>]*>/g)) {
		dates.set(m[2], m[1]);
	}

	const days = [];
	for (const m of html.matchAll(/<tool-tip[^>]*?for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
		const date = dates.get(m[1]);
		if (!date) continue;
		const n = /^(\d+)\s+contribution/.exec(m[2].trim());
		if (n) days.push({ date, count: Number(n[1]) });
	}
	return days;
}

const years = process.argv.slice(2).length
	? process.argv.slice(2)
	: [String(new Date().getFullYear())];

const months = await loadArchive();
const tally = { added: 0, enriched: 0 };
let total = 0;

for (const year of years) {
	try {
		const days = await calendar(year);
		for (const j of days) {
			total += j.count;
			const outcome = add(months, "contributions", { title: `contributions du ${j.date}`, ...j });
			if (outcome === "added") tally.added++;
			else if (outcome === "enriched") tally.enriched++;
		}
		console.log(`[github] ${year} : ${days.length} active days`);
	} catch (e) {
		console.error(`[github] ${year} : ${e.message}`);
	}
}

await writeArchive(months);
report("github", { ...tally, contributions: total });
