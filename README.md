# anthonynelzinsantos.com

My portfolio, in Hugo. No dependencies, no downloaded fonts, no build step beyond Hugo itself. Its "maintenant" pages double as my media archive: one per month, generated from what i read, listened to, watched and published.

## Pages

| Page             | URL              | Source                               |
| ---------------- | ---------------- | ------------------------------------ |
| Ma mission       | `/mission/`      | `content/mission.md`                 |
| Mon parcours     | `/parcours/`     | `content/parcours.md` (front matter) |
| Mes réalisations | `/realisations/` | `content/realisations/`              |
| Mes projets      | `/projets/`      | `content/projets.md` (front matter)  |
| Maintenant       | `/maintenant/`   | `content/maintenant/`                |
| Mon atelier      | `/atelier/`      | `content/atelier/`                   |

## Running it

```bash
hugo server                        # preview on :1313
node scripts/build-months.mjs      # regenerate month pages
hugo --minify                      # build into ./public
```

## The archive

One JSON file per month, `archive/<YYYY-MM>.json`, with one shelf per source:

| Shelf                                  | Source                | Script                   |
| -------------------------------------- | --------------------- | ------------------------ |
| `books`                                | StoryGraph CSV export | `harvest-storygraph.mjs` |
| `albums`                               | Last.fm               | `harvest-lastfm.mjs`     |
| `films`                                | Letterboxd            | `harvest-letterboxd.mjs` |
| `contributions`                        | GitHub                | `harvest-github.mjs`     |
| `dispatches`, `architypes`, `episodes` | RSS feeds             | `harvest-feeds.mjs`      |

The shelf order is set once, in `SHELVES` in `scripts/lib.mjs`, and mirrored in `layouts/_partials/tally-order.html`. If i reorder one, i reorder both.

Harvesters can be re-run safely: the same item on the same day is never counted twice, and a later run fills in what an earlier one lacked. Repeats (`relu`, `revu`, `réécouté`) aren't stored; they're worked out from the whole archive.

### Harvesting

```bash
LASTFM_API_KEY=… LASTFM_USER=…  node scripts/harvest-lastfm.mjs
LETTERBOXD_USER=…               node scripts/harvest-letterboxd.mjs
node scripts/harvest-feeds.mjs                       # or: dispatches | architypes | episodes
node scripts/harvest-github.mjs                      # or: 2011 2012 … (one year at a time)
node scripts/harvest-storygraph.mjs ~/Downloads/export.csv
node scripts/enrich-films.mjs                        # director and original title
```

Last.fm and Letterboxd also take a full export (a CSV, a folder) as an argument, for a one-shot catch-up. `DRY_RUN=1` writes nothing; i use it before any bulk backfill. The scripts don't read `.env`, so locally: `node --env-file=.env scripts/harvest-lastfm.mjs`.

Things to know:

- **StoryGraph has no API.** Books only arrive from a CSV i pass by hand.
- **Albums, not tracks.** A run of plays with no gap over `LASTFM_GAP_HOURS` (6) and at least `LASTFM_MIN_TRACKS` (3) tracks counts as one listen.
- **RSS feeds only go back so far** (24 items for Z1NZ0L1N and Architypes). Older months don't backfill themselves.
- **Dates are when things happened**, not when i logged them.

## The month pages

`node scripts/build-months.mjs` reads `archive/` and writes one page bundle per month into `content/maintenant/`, e.g. `/maintenant/2511/` for November 2025. Variables: `SINCE` (`SINCE=2025-05`), `ALBUMS_NAMED` (`1`), `DRY_RUN=1`.

Earlier months keep their old URLs (`/maintenant/novembre-2025/`, `/now/novembre-2025/`) through `aliases` in their front matter.

### Hand-written lines

Generated lines live between the markers. Anything outside them is mine and is never touched, and neither is any front matter key the generator doesn't compute:

```markdown
- j’ai repris l’enregistrement du podcast _À bâtons rompus_ avec Arnaud Jourdain

<!-- archive:début -->
- j’ai lu _La chute du British Museum_ de David Lodge
- j’ai écouté _Fourth Generation_ de Juan Chiavassa et neuf autres albums
<!-- archive:fin -->

- j’ai assisté à quatre concerts
```

Punctuation is added by the layout, so my own lines can go bare.

### The counter

The month banner shows `tally`. I add my own counters by hand, on one line, as JSON:

```yaml
tally: {"albums":39,"films":3,"contributions":36,"villes":4}
```

Photos are counted at build time.

### Photos

Each month is a page bundle. i drop JPEGs next to `index.md`, numbered in order:

```
content/maintenant/2511/
├── index.md
├── 2511-1.jpg
└── 2511-2.jpg
```

The JPEGs are the source and never ship; the site serves AVIF. Captions are optional, per filename, in Markdown, and double as alt text:

```yaml
photos:
  "2511-1.jpg": "The restoration of *The Adoration of the Magi*"
```

## The atelier

The colophon: this site, my computers, my writing machines. Pages live in `content/atelier/` as bundles, with photos and captions like the months. They need a `slug` in the front matter, or Hugo slugifies the title into an accented URL.

For one subject, drop images in the bundle and write. For several on one page, use the `piece` shortcode, one block per machine; `images` is a glob over the bundle, and all three attributes are optional:

```markdown
{{< piece date="1998-2004" title="iMac G3" images="imac-*" >}}
Du texte sur cette machine.
{{< /piece >}}
```

A page that uses `piece` doesn't also get the automatic gallery.

## Deployment

`.github/workflows/months.yml`:

- on push to `main`: build and deploy;
- every day at 17:00 UTC, or on manual dispatch: harvest, enrich, regenerate, commit, build and deploy.

Deploy is FTPS to Infomaniak. Secrets set on the repo: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_REMOTE_DIR`, `LASTFM_API_KEY`, `LASTFM_USER`, `LETTERBOXD_USER`.

## Icons

`node scripts/build-icons.mjs` rasterises `assets/icon.svg` into the touch icons, favicon and web manifest in `static/`. macOS only (`qlmanage`), and only needed when the icon changes.

## Licence

Content and code are under [CC BY-NC-SA 4.0](LICENCE.md).
