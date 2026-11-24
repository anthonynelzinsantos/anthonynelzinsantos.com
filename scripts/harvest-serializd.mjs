#!/usr/bin/env node
import { loadArchive, writeArchive, add, report } from "./lib.mjs";

const user = process.env.SERIALIZD_USER || "z1nz0l1n";
const DELAY = Number(process.env.DELAY || 250);
const API = "https://serializd.onrender.com/api";

// Serializd has no public API. These are the headers its own web and Android apps send.
const HEADERS = {
	"user-agent": "anthonynelzinsantos.com (archive personal)",
	origin: "https://www.serializd.com",
	referer: "https://www.serializd.com",
	"x-requested-with": "serializd_vercel",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The server sleeps when idle, so the first request can be slow or fail.
async function page(n) {
	let last;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const res = await fetch(`${API}/user/${encodeURIComponent(user)}/diary?page=${n}`,
				{ headers: HEADERS, signal: AbortSignal.timeout(90_000) });
			if (res.ok) return await res.json();
			if (res.status < 500) throw new Error(`http ${res.status}`, { cause: "final" });
			last = new Error(`http ${res.status}`);
		} catch (e) {
			if (e.cause === "final") throw e;
			last = e;
		}
		await sleep(2000 * attempt);
	}
	throw last;
}

const diary = [];
let pages = 1;
for (let n = 1; n <= pages && n <= 200; n++) {
	let data;
	try { data = await page(n); }
	catch (e) { console.error(`[serializd] page ${n}: ${e.message}`); process.exit(1); }
	pages = data.totalPages ?? pages;
	if (!data.reviews?.length) break;
	diary.push(...data.reviews);
	await sleep(DELAY);
}

const shows = [];
let skipped = 0;
for (const r of diary) {
	const date = (r.backdate || r.dateAdded || "").slice(0, 10);
	if (!r.showName || !date || r.isLog === false || r.episodeNumber != null) { skipped++; continue; }
	shows.push({
		title: r.showName,
		season: r.showSeasons?.find((s) => s.id === r.seasonId)?.seasonNumber,
		date,
		rating: r.rating || undefined,
		rewatch: r.isRewatch || undefined,
		showId: r.showId,
	});
}

const months = await loadArchive();
const tally = { added: 0, enriched: 0, skipped };
for (const show of shows) {
	const outcome = add(months, "shows", show);
	if (outcome === "added") tally.added++;
	else if (outcome === "enriched") tally.enriched++;
}

await writeArchive(months);
report("serializd", tally);
