import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ARCHIVE = path.join(ROOT, "archive");

export const CREATOR = { books: "author", albums: "artist", films: "director" };
export const SHELVES = [...Object.keys(CREATOR), "contributions", "dispatches", "architypes"];

export const DRY_RUN = process.env.DRY_RUN === "1";

export function parseCSV(text) {
	const rows = [];
	let row = [], field = "", quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
			else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") { row.push(field); field = ""; }
		else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
		else if (c !== "\r") field += c;
	}
	if (field || row.length) { row.push(field); rows.push(row); }
	return rows;
}

const flatten = (s) => String(s ?? "").toLowerCase().normalize("NFKD")
	.replace(/[̀-ͯ]/g, "").replace(/[^\w\s-]/g, "")
	.replace(/[\s-]+/g, "-").replace(/^-+|-+$/g, "");

export function identity(shelf, item) {
	if (!CREATOR[shelf]) return `${shelf}:${item.source || item.date || flatten(item.title)}`;

	const key = shelf === "films" ? item.year : item[CREATOR[shelf]];
	const slug = [flatten(key), flatten(item.title)].filter(Boolean).join("-");
	if (slug) return `${shelf}:${slug}`;

	const raw = `${key} ${item.title}`;
	const hash = [...raw].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0).toString(36);
	return `${shelf}:x-${hash}`;
}

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export async function loadArchive() {
	const months = new Map();
	let files = [];
	try { files = await readdir(ARCHIVE); } catch { return months; }
	for (const f of files.filter((f) => f.endsWith(".json"))) {
		months.set(f.replace(/\.json$/, ""), JSON.parse(await readFile(path.join(ARCHIVE, f), "utf8")));
	}
	return months;
}

const emptyMonth = () => Object.fromEntries(SHELVES.map((s) => [s, []]));

export async function writeArchive(months) {
	if (DRY_RUN) return;
	await mkdir(ARCHIVE, { recursive: true });
	for (const [key, contents] of months) {
		for (const shelf of SHELVES) {
			contents[shelf] = (contents[shelf] ?? []).sort((a, b) =>
				a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
		}
		await writeFile(path.join(ARCHIVE, `${key}.json`), JSON.stringify(contents, null, 2) + "\n");
	}
}

export function add(months, shelf, item) {
	const key = monthKey(new Date(item.date));
	if (!months.has(key)) months.set(key, emptyMonth());
	const contents = months.get(key);
	contents[shelf] ??= [];

	const id = identity(shelf, item);
	const known = contents[shelf].find((x) => identity(shelf, x) === id && x.date === item.date);
	if (known) {
		let enriched = false;
		for (const [k, v] of Object.entries(item)) {
			if (v !== undefined && v !== "" && known[k] === undefined) { known[k] = v; enriched = true; }
		}
		for (const k of ["tracks", "count"]) {
			if (item[k] > (known[k] ?? 0)) { known[k] = item[k]; enriched = true; }
		}
		return enriched ? "enriched" : "known";
	}
	contents[shelf].push(item);
	return "added";
}

export function count(items) {
	return (items ?? []).reduce((n, x) => n + (x.count ?? 1), 0);
}

export function report(source, tally) {
	const parts = Object.entries(tally).filter(([, n]) => n).map(([what, n]) => `${n} ${what}`);
	console.log(`[${source}] ${parts.length ? parts.join(", ") : "nothing new"}`
		+ (DRY_RUN ? "  — DRY_RUN: nothing written" : ""));
}

export function sessions(times, gap) {
	const sorted = [...times].sort((a, b) => a - b);
	const all = [];
	let current = [];
	for (const t of sorted) {
		if (current.length && t - current.at(-1) > gap) { all.push(current); current = []; }
		current.push(t);
	}
	if (current.length) all.push(current);
	return all;
}

export function credit(name) {
	const parts = String(name).split(";").map((s) => s.trim()).filter(Boolean);
	return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} & ${parts.at(-1)}` : String(name).trim();
}
