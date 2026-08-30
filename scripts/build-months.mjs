import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadArchive, identity, count, ROOT, CREATOR, SHELVES, DRY_RUN } from "./lib.mjs";

const OUT = path.join(ROOT, "content", "maintenant");
const SINCE = process.env.SINCE || "";
const ALBUMS_NAMED = Number(process.env.ALBUMS_NAMED || 1);
const FIRST_PUBLISHED = "2025-05";

const START = "<!-- archive:début -->";
const END = "<!-- archive:fin -->";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin",
	"juillet", "aout", "septembre", "octobre", "novembre", "décembre"];

const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
	"neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const TENS = { 20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante", 60: "soixante" };

function spellOut(n) {
	if (n < 17) return UNITS[n];
	if (n < 20) return `dix-${UNITS[n - 10]}`;
	if (n < 70) {
		const t = Math.floor(n / 10) * 10, u = n % 10;
		if (!u) return TENS[t];
		if (u === 1) return `${TENS[t]}-et-un`;
		return `${TENS[t]}-${UNITS[u]}`;
	}
	if (n < 80) {
		const r = n - 60;
		return r === 11 ? "soixante-et-onze" : `soixante-${spellOut(r)}`;
	}
	if (n < 100) {
		const r = n - 80;
		return r ? `quatre-vingt-${spellOut(r)}` : "quatre-vingts";
	}
	if (n < 1000) {
		const h = Math.floor(n / 100), r = n % 100;
		const head = h === 1 ? "cent" : `${UNITS[h]}-cent${r ? "" : "s"}`;
		return r ? `${head}-${spellOut(r)}` : head;
	}
	return String(n);
}

const spell = (n, feminine) => {
	const words = spellOut(n);
	return feminine ? words.replace(/un$/, "une") : words;
};

const VOWEL = /^[aeiouàâäåãéèêëíîïóôöõúùûü]/i;
const of = (name) => (VOWEL.test(name) ? "d’" : "de ") + name;

function join(items) {
	if (items.length <= 1) return items[0] || "";
	return `${items.slice(0, -1).join(", ")} et ${items.at(-1)}`;
}

const ofPeople = (raw) => of(join(String(raw).split(",").map((n) => n.trim()).filter(Boolean)));

const withoutEdition = (t) => t.replace(/\s*[([][^)\]]*[)\]]\s*$/, "").trim() || t;
const withoutSubtitle = (t) => {
	const cut = t.split(/\s*:\s+/)[0].trim();
	return cut.length >= 8 ? cut : t;
};

const italic = (t) => `_${t}_`;
const TITLE = {
	books: (t) => italic(withoutSubtitle(withoutEdition(t))),
	films: (t) => italic(withoutEdition(t)),
	albums: (t) => italic(withoutEdition(t)),
};

const VERBS = {
	books: ["lu", "relu"],
	films: ["vu", "revu"],
	albums: ["écouté", "réécouté"],
};

const PROFILES = {
	books: "https://app.thestorygraph.com/profile/z1nz0l1n",
	films: "https://letterboxd.com/z1nz0l1n/",
	albums: "https://www.last.fm/user/z1nz0l1n",
};

const PUBLISHED = [
	{ shelf: "contributions", verb: "fait", feminine: true,
		noun: ["contribution", "contributions"],
		where: "[GitHub](https://github.com/anthonynelzinsantos)" },
	{ shelf: "dispatches", verb: "publié",
		noun: ["_dispatch_", "_dispatches_"],
		where: "[_Z1NZ0L1N_](https://z1nz0l1n.com/)" },
	{ shelf: "architypes", verb: "publié",
		noun: ["architype", "architypes"],
		where: "[_Architypes_](https://archityp.es/)" },
	{ shelf: "episodes", verb: "enregistré",
		noun: ["épisode", "épisodes"],
		join: "de mon podcast",
		where: "[_À bâtons rompus_](https://abatonsrompus.fr/)" },
];

function names(shelf, items) {
	const groups = [];
	for (const item of items) {
		const who = item[CREATOR[shelf]];
		const key = who ? String(who).trim().toLowerCase() : null;
		const same = key && groups.find((g) => g.key === key);
		if (same) same.titles.push(TITLE[shelf](item.title));
		else groups.push({ key, who, titles: [TITLE[shelf](item.title)] });
	}
	return groups.map((g) => ({
		text: g.who ? `${join(g.titles)} ${ofPeople(g.who)}` : join(g.titles),
		coordinated: g.titles.length > 1,
	}));
}

const joinNames = (parts) => parts.at(-1)?.coordinated
	? parts.map((p) => p.text).join(", ")
	: join(parts.map((p) => p.text));

function weigh(albums) {
	const table = new Map();
	for (const item of albums) {
		const id = identity("albums", item);
		if (!table.has(id)) table.set(id, { tracks: 0, sessions: 0 });
		const w = table.get(id);
		w.tracks += item.tracks ?? 0;
		w.sessions++;
	}
	return table;
}

function sentences(month) {
	const lines = [];
	const scale = weigh(month.albums ?? []);
	const mostPlayed = (lot) => [...lot].sort((a, b) => {
		const A = scale.get(identity("albums", a)), B = scale.get(identity("albums", b));
		return B.tracks - A.tracks || B.sessions - A.sessions || a.date.localeCompare(b.date);
	});

	for (const shelf of ["books", "albums", "films"]) {
		const all = month[shelf] ?? [];
		const fresh = new Set(all.filter((x) => !x.repeat).map((x) => identity(shelf, x)));
		const groups = [
			all.filter((x) => fresh.has(identity(shelf, x))),
			all.filter((x) => x.repeat && !fresh.has(identity(shelf, x))),
		];

		for (const [i, verb] of VERBS[shelf].entries()) {
			const lot = groups[i].sort((a, b) => a.date.localeCompare(b.date));
			if (!lot.length) continue;

			const cap = shelf === "albums" ? ALBUMS_NAMED : lot.length;
			const order = shelf === "albums" ? mostPlayed(lot) : lot;
			const chosen = order.slice(0, cap);
			const named = names(shelf, chosen);
			const rest = lot.length - chosen.length;

			const head = PROFILES[shelf] ? `[j’ai ${verb}](${PROFILES[shelf]})` : `j’ai ${verb}`;
			let line = `${head} ` + joinNames(named);
			if (rest === 1) line += " et un autre album";
			else if (rest > 1) line += ` et ${spell(rest)} autres albums`;
			lines.push(line);
		}
	}

	for (const p of PUBLISHED) {
		const n = count(month[p.shelf]);
		if (!n) continue;
		const noun = p.noun[n === 1 ? 0 : 1];
		lines.push(`j’ai ${p.verb} ${spell(n, p.feminine)} ${noun} ${p.join ?? "sur"} ${p.where}`);
	}

	return lines;
}

function frontMatter(text) {
	const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	return m ? { head: m[1], body: m[2] } : { head: "", body: text };
}

function merge(old, lines) {
	const block = [START, ...lines.map((l) => `- ${l}`), END].join("\n");
	if (!old) return block + "\n";
	const i = old.indexOf(START), j = old.indexOf(END);
	if (i === -1 || j === -1) {
		const before = old.trim();
		return (before ? before + "\n\n" : "") + block + "\n";
	}
	return old.slice(0, i) + block + old.slice(j + END.length);
}

function head(old, keys) {
	const owned = new Set(Object.keys(keys));
	const kept = [];
	let skipping = false;
	for (const line of (old ? frontMatter(old).head.split("\n") : [])) {
		if (/^\s/.test(line)) { if (!skipping) kept.push(line); continue; }
		skipping = owned.has(line.slice(0, line.indexOf(":")).trim());
		if (!skipping && line.trim()) kept.push(line);
	}
	const lines = Object.entries(keys).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
	return ["---", ...lines, ...kept, "---"].join("\n");
}

const OWN_TALLY = [...SHELVES, "photos"];
const TALLY_LABEL = { books: "livres", episodes: "épisodes" };

function mergeTally(old, computed) {
	let extra = {};
	const m = old && old.match(/^tally:\s*(\{.*\})\s*$/m);
	if (m) { try { extra = JSON.parse(m[1]); } catch { extra = {}; } }
	for (const k of OWN_TALLY) delete extra[TALLY_LABEL[k] ?? k];
	return { ...computed, ...extra };
}

const archive = await loadArchive();
if (!archive.size) {
	console.error("archive/ is empty — run a harvest first.");
	process.exit(1);
}

const occurrences = new Map();
for (const contents of archive.values()) {
	for (const shelf of ["albums", "books", "films"]) {
		for (const item of contents[shelf] ?? []) {
			const id = identity(shelf, item);
			if (!occurrences.has(id)) occurrences.set(id, []);
			occurrences.get(id).push(item);
		}
	}
}
for (const list of occurrences.values()) {
	list.sort((a, b) => a.date.localeCompare(b.date));
	list.forEach((item, i) => { item.repeat = i > 0; });
}

await mkdir(OUT, { recursive: true });
let created = 0, updated = 0, unchanged = 0;

for (const [month, contents] of [...archive.entries()].sort()) {
	if (SINCE && month < SINCE) continue;
	const [year, m] = month.split("-").map(Number);
	const monthName = MONTHS[m - 1];
	const slug = `${String(year).slice(2)}${String(m).padStart(2, "0")}`;
	const spelled = `${monthName}-${year}`.normalize("NFD").replace(/[̀-ͯ]/g, "");

	const dir = path.join(OUT, slug);
	const file = path.join(dir, "index.md");

	let old = null;
	try { old = await readFile(file, "utf8"); } catch { old = null; }

	const computed = {};
	for (const shelf of SHELVES) {
		const n = count(contents[shelf]);
		if (n) computed[TALLY_LABEL[shelf] ?? shelf] = n;
	}

	const keys = {
		title: `${monthName[0].toUpperCase()}${monthName.slice(1)} ${year}`,
		slug,
		monthName,
		year,
		date: new Date(Date.UTC(year, m - 1, 1, 12)).toISOString(),
		month,
		tally: mergeTally(old, computed),
		aliases: [`/maintenant/${spelled}/`],
	};
	if (month >= FIRST_PUBLISHED) keys.aliases.push(`/now/${spelled}/`);

	const body = old ? frontMatter(old).body : "";
	const next = `${head(old, keys)}\n\n${merge(body.trim(), sentences(contents))}`.replace(/\n*$/, "\n");
	if (old === next) { unchanged++; continue; }
	if (DRY_RUN) { old ? updated++ : created++; continue; }
	await mkdir(dir, { recursive: true });
	await writeFile(file, next);
	old ? updated++ : created++;
}

console.log(`[months] ${created} created, ${updated} updated, ${unchanged} unchanged`
	+ ` — ${archive.size} months in the archive${SINCE ? `, published since ${SINCE}` : ""}`
	+ (DRY_RUN ? "  — DRY_RUN: nothing written" : ""));
