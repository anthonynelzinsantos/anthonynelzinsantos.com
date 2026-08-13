#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { loadArchive, writeArchive, add, report, parseCSV, sessions, credit } from "./lib.mjs";

const GAP = Number(process.env.LASTFM_GAP_HOURS || 6) * 3600 * 1000;
const MIN_TRACKS = Number(process.env.LASTFM_MIN_TRACKS || 3);

const link = (artist, album) =>
	"https://www.last.fm/music/" +
	[String(artist).split(";")[0], album].map((s) => encodeURIComponent(s).replace(/%20/g, "+")).join("/");

function byAlbum(plays) {
	const albums = new Map();
	for (const { artist, album, t, key } of plays) {
		const k = key || `${album} ${artist}`.toLowerCase();
		if (!albums.has(k)) albums.set(k, { album, times: [], artists: new Map() });
		const g = albums.get(k);
		g.times.push(t);
		g.artists.set(artist, (g.artists.get(artist) || 0) + 1);
	}
	return albums;
}

async function fromAPI() {
	const key = process.env.LASTFM_API_KEY, user = process.env.LASTFM_USER;
	if (!key || !user) {
		console.error("Missing LASTFM_API_KEY and LASTFM_USER.");
		process.exit(1);
	}
	const url = new URL("https://ws.audioscrobbler.com/2.0/");
	url.search = new URLSearchParams({
		method: "user.getRecentTracks", user, api_key: key,
		format: "json", limit: String(process.env.LASTFM_LIMIT || 200),
	}).toString();

	const res = await fetch(url);
	if (!res.ok) { console.error("Last.fm responded", res.status); process.exit(1); }
	const data = await res.json();

	const plays = [];
	for (const t of data?.recenttracks?.track ?? []) {
		const album = t.album?.["#text"], artist = t.artist?.["#text"];
		if (t["@attr"]?.nowplaying || !t.date?.uts || !album || !artist) continue;
		plays.push({ artist, album, t: Number(t.date.uts) * 1000 });
	}
	return plays;
}

async function fromCSV(filePath) {
	const rows = parseCSV(await readFile(filePath, "utf8"));
	const header = rows.shift().map((h) => h.trim());
	const i = (name) => header.indexOf(name);
	const [I_UTS, I_ARTISTE, I_ALBUM, I_MBID] = [i("uts"), i("artist"), i("album"), i("album_mbid")];

	const plays = [];
	for (const l of rows) {
		const album = (l[I_ALBUM] || "").trim(), artist = (l[I_ARTISTE] || "").trim();
		const uts = Number(l[I_UTS]);
		if (!album || !artist || !uts) continue;
		plays.push({ artist, album, t: uts * 1000, key: (l[I_MBID] || "").trim() || undefined });
	}
	return plays;
}

const filePath = process.argv[2];
const plays = filePath ? await fromCSV(filePath) : await fromAPI();

const months = await loadArchive();
const tally = { added: 0, enriched: 0 };

for (const { album, times, artists } of byAlbum(plays).values()) {
	const artist = [...artists.entries()].sort((a, b) => b[1] - a[1])[0][0];
	for (const session of sessions(times, GAP)) {
		if (session.length < MIN_TRACKS) continue;
		const start = new Date(session[0]);
		const outcome = add(months, "albums", {
			title: album,
			artist: credit(artist),
			date: start.toISOString().slice(0, 10),
			tracks: session.length,
			source: link(artist, album),
		});
		if (outcome === "added") tally.added++;
		else if (outcome === "enriched") tally.enriched++;
	}
}

await writeArchive(months);
report(filePath ? "last.fm (csv)" : "last.fm", tally);
