# anthonynelzinsantos.com

My portfolio, in Hugo. No dependencies, no downloaded fonts, no build step beyond Hugo itself. Five sections, plus one auto-generated "maintenant" page per month that doubles as my media archive.

## Pages

| Page             | URL              | Source                                |
| ---------------- | ---------------- | ------------------------------------- |
| Ma mission       | `/mission/`      | `content/mission.md`                   |
| Mon parcours     | `/parcours/`     | `content/parcours.md` (front matter)   |
| Mes réalisations | `/realisations/` | `content/realisations/`                |
| Mes projets      | `/projets/`      | `content/projets.md` (front matter)    |
| Maintenant       | `/maintenant/`   | generated from `archive/`              |

My career and side projects live in front matter rather than body text: they are data.

## Running it

```bash
hugo server                          # preview on :1313
node scripts/build-months.mjs        # regenerate month pages
hugo --minify                        # build into ./public
```

## The archive

One JSON file per month: `archive/<YYYY-MM>.json`, six shelves.

```json
{
  "books":         [ { "title": "…", "author": "…", "date": "…", "rating": 4 } ],
  "albums":        [ { "title": "…", "artist": "…", "date": "…", "tracks": 11,
                       "source": "https://www.last.fm/…" } ],
  "films":         [ { "title": "…", "director": "…", "year": 2025,
                       "date": "…", "rating": 3 } ],
  "contributions": [ { "title": "…", "date": "…", "count": 13 } ],
  "dispatches":    [ { "title": "…", "date": "…", "source": "https://z1nz0l1n.com/…" } ],
  "architypes":    [ { "title": "…", "date": "…", "source": "https://archityp.es/…" } ]
}
```

That shelf order matters and is defined once, in `SHELVES` in `scripts/lib.mjs`. It drives the sentence order, the counter order, and the front-matter key order. `layouts/_partials/tally-order.html` mirrors it for the templates. If i reorder one, i reorder both.

Every harvester is idempotent: the same item on the same day is never counted twice, and a later run that brings something the earlier one lacked (a rating, a director) fills the gap without overwriting.

Repeats are not stored. Nothing in the JSON says "reread". The generator looks at every occurrence of an item across the whole archive: the earliest is the original, the rest are repeats. Harvest order is therefore irrelevant.

## Harvesting

```bash
LASTFM_API_KEY=… LASTFM_USER=…  node scripts/harvest-lastfm.mjs
LETTERBOXD_USER=…               node scripts/harvest-letterboxd.mjs
node scripts/harvest-feeds.mjs
node scripts/harvest-github.mjs
node scripts/harvest-storygraph.mjs ~/Downloads/export.csv
node scripts/enrich-films.mjs
```

`DRY_RUN=1` harvests, counts and writes nothing. i use it before any bulk backfill — an import that "adds" where it should "enrich" would silently double ten years of counters.

```bash
DRY_RUN=1 node scripts/harvest-lastfm.mjs ~/Downloads/recenttracks.csv
```

Last.fm and Letterboxd also take a full export as an argument, for a one-shot catch-up:

```bash
node scripts/harvest-lastfm.mjs     ~/Downloads/recenttracks.csv
node scripts/harvest-letterboxd.mjs ~/Downloads/letterboxd-export/
```

The scripts don't read `.env` themselves, so locally i pass it to Node:

```bash
node --env-file=.env scripts/harvest-lastfm.mjs
```

### What each source can and can't do

**StoryGraph has no API.** Books only ever arrive from a CSV export i pass by hand. This is the one thing the weekly job cannot do for me.

**Music is albums, not tracks.** Plays are grouped by album, then cut into sessions: a run with no gap longer than `LASTFM_GAP_HOURS` (6) counts as one listen, from `LASTFM_MIN_TRACKS` (3) tracks up. `tracks` keeps the session length, which is the only real measure of what i actually listened to — and it decides which album the month's sentence names.

**My two other sites come in via RSS**, and both feeds serve 24 items, so a harvest only sees the last few weeks. Fine as long as i run it regularly, but a month older than the feed will not backfill itself. To reach further back, raise `services.rss.limit` in those sites' Hugo config for one run. The feed URLs are in `SITES` in `scripts/harvest-feeds.mjs`; passing `dispatches` or `architypes` as an argument harvests just that one.

**GitHub counts contributions, not commits** Commits on the default branch *plus* issues, pull requests and reviews. The calendar reads without a token, but then only shows public activity unless "Include private contributions on my profile" is ticked. History goes back to December 2011, harvested year by year:

```bash
node scripts/harvest-github.mjs 2011 2012 2013 2014 2015
node scripts/harvest-github.mjs
```

**Directors are fetched separately.** Neither the Letterboxd RSS feed nor `diary.csv` carries the director; it is only on the film's page. `enrich-films.mjs` scrapes it, for films that lack one and only those. Separate pass on purpose: if Letterboxd changes its markup, the rest of the harvest keeps working.

**Dates are when things happened, not when i logged them.** Letterboxd uses `Watched Date`, StoryGraph the finish date. A backlog entered in one evening spreads across the months it belongs to.

## The month pages

```bash
node scripts/build-months.mjs
```

Reads `archive/`, writes one page bundle per month into `content/maintenant/`. Separate from harvesting so i can read what was collected before publishing it. Variables: `SINCE` (`SINCE=2025-05` to publish only from the site's first page), `ALBUMS_NAMED` (`1`), `DRY_RUN=1`.

### The French it handles

- number words and their traps (`soixante-et-onze`, `quatre-vingts`);
- gender agreement on a trailing one (`vingt-et-une contributions`);
- elision before a vowel and only a vowel: `d'Alexandre Dumas`, but
  `de Hayao Miyazaki` and `de Yorgos Lanthimos`;
- coordination (`A, B et C`, never `A, B, C`);
- co-authors (`de Jay Foreman et Mark Cooper-Jones`);
- repeat verbs: `j'ai relu`, `j'ai revu`, `j'ai réécouté`;
- singular and plural (`un dispatch`, `deux dispatches`).

It does not punctuate the list. i write my own lines bare or terminated however i like; the layout strips trailing punctuation and adds its own, without doubling an abbreviation's full stop. The `;` on each line and the final `.`
depend on the *final* order of lines, and i add lines by hand between runs — so `layouts/_partials/enumeration.html` owns punctuation, and it always wins.

### Hand-written lines survive

Generated lines live between the markers. Anything outside them is mine and is never touched:

```markdown
- j’ai repris l’enregistrement du podcast _À bâtons rompus_ avec Arnaud Jourdain

<!-- archive:début -->
- j’ai lu _La chute du British Museum_ de David Lodge
- j’ai écouté _Fourth Generation_ de Juan Chiavassa et neuf autres albums
- j’ai vu _A House of Dynamite_, _Maria_ et _A Minecraft Movie_
<!-- archive:fin -->

- j’ai assisté à quatre concerts
```

Front matter works the same way: the generator rewrites the keys it computes and copies anything else through unchanged.

A month can be 129 albums, so i name `ALBUMS_NAMED` of them and count the rest. The one named is the month's most played, summing tracks across all its sessions, discoveries and repeats together; failing tracks, session count, then date.

An item discovered *and* repeated in the same month gets only one verb — "j'ai écouté X ; j'ai réécouté X" is nonsense. Only repeats of something known from an earlier month earn the re- verb.

Books lose their subtitle (`Could Should Might Don't`), films keep theirs, or `Mission: Impossible` wouldn't get far.

### URLs

A month's URL is its position in the calendar: `/maintenant/2511/` for November 2025. Four digits that sort themselves, in the address bar and in `content/maintenant/` alike. Every URL a month has ever had still works, via `aliases`: the spelled-out form (`/maintenant/novembre-2025/`) for all months, plus `/now/novembre-2025/` for those published back on WordPress.

### The counter

The month banner renders `tally` and knows no field names. Computed keys come first in shelf order, then `photos`, then anything i add by hand, alphabetically:

```yaml
tally: {"livres":1,"albums":39,"films":3,"contributions":36,"photos":18,"villes":4}
```

`villes` shows up in the banner and in the record's density without touching a template, and survives the next harvest: the generator rewrites the keys it computes and copies the rest. Keep it on one line, as JSON — that's how it's
read back. A count of 1 goes singular.

`photos` is never stored. `layouts/_partials/tally.html` counts the bundle's images at build time and merges the result in, so adding or removing a JPEG is enough — no script run, no front-matter edit. The generator strips any `photos` key it finds.

## Photos

Each month is a page bundle. i drop JPEGs next to `index.md`:

```
content/maintenant/2511/
├── index.md
├── 2511-1.jpg
└── 2511-2.jpg
```

They appear as a contact sheet in the right-hand column on wide screens, and as a scrolling strip under 900 px. Order is by the last run of digits in the filename.

The JPEG is the source: it's what i archive, and it never ships — the cascade in `content/maintenant/_index.md` sets `build.publishResources: false`. What's served is AVIF in several widths, with a resized JPEG fallback. Hugo caches the
derivatives in `resources/`.

Captions are optional, declared per filename, and render Markdown:

```yaml
photos:
  "2511-1.jpg": "The restoration of *The Adoration of the Magi*"
```

The caption doubles as alt text, with Markdown stripped. A photo without one gets an empty `alt`.

The viewer is a `<dialog>`; without JavaScript the thumbnails remain images.

## Deployment

`.github/workflows/months.yml` does both jobs:

- on push to `main`: build and deploy only;
- on Fridays evenings: harvest, enrich, regenerate, commit, then build and deploy.

The harvest steps are gated on `github.event_name != 'push'` so an ordinary edit doesn't hammer every API. The scheduled run's own commit does not retrigger the workflow, because pushes made with `GITHUB_TOKEN` don't fire triggers.

Deploy is FTPS to Infomaniak. Secrets i set on the repo:

| Secret            | Use                                |
| ----------------- | ---------------------------------- |
| `FTP_SERVER`      | Infomaniak host                    |
| `FTP_USERNAME`    | FTP account                        |
| `FTP_PASSWORD`    | FTP password                       |
| `FTP_REMOTE_DIR`  | target directory                   |
| `LASTFM_API_KEY`  | Last.fm API                        |
| `LASTFM_USER`     | Last.fm account                    |
| `LETTERBOXD_USER` | Letterboxd account                 |

## Icons

```bash
node scripts/build-icons.mjs
```

Rasterises `assets/icon.svg` via `qlmanage` into the touch icons, favicon and web manifest in `static/`. macOS only, and only needed when the icon changes.

## Licence

Content and code are under [CC BY-NC-SA 4.0](LICENCE.md).
