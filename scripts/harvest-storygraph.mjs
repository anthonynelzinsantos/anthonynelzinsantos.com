#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { loadArchive, writeArchive, add, report, parseCSV } from "./lib.mjs";

const filePath = process.argv[2];
if (!filePath) {
	console.error("Usage: harvest-storygraph.mjs <export.csv>");
	process.exit(1);
}
const toISO = (s) => s.replaceAll("/", "-");

const rows = parseCSV(await readFile(filePath, "utf8"));
const header = rows.shift().map((h) => h.trim());
const col = (l, name) => l[header.indexOf(name)]?.trim() ?? "";

const months = await loadArchive();
const tally = { added: 0, enriched: 0, skipped: 0 };

for (const l of rows.filter((l) => l.length > 1)) {
	if (col(l, "Read Status") !== "read") { tally.skipped++; continue; }
	const date = col(l, "Last Date Read") || col(l, "Dates Read").split("-").pop();
	if (!date) { tally.skipped++; continue; }

	const rating = col(l, "Star Rating");
	const outcome = add(months, "books", {
		title: col(l, "Title"),
		author: col(l, "Authors") || col(l, "Author") || undefined,
		date: toISO(date),
		rating: rating ? Math.round(Number(rating)) : undefined,
		format: (col(l, "Format") || "").toLowerCase() || undefined,
	});
	if (outcome === "added") tally.added++;
	else if (outcome === "enriched") tally.enriched++;
}

await writeArchive(months);
report("storygraph", tally);
