# ZA SPaFI Toliara – website

Website of **ZA SPaFI Toliara** (Zanaka Ampielezana Synodam-Paritany Fisakana eto Toliara), a Lutheran choir association.
Static site hosted on GitHub Pages; data will come from a Google Sheet through Google Apps Script (phase 2).

## Structure

| Path | Content |
|---|---|
| `index.html` | Home: verse, goals and steps, donations summary, gallery |
| `mombamomba.html` | About us, Lutheran identity, board, official information, statutes |
| `fanomezana.html` | Donation instructions, declaration form, donor list, share button |
| `mpikambana.html` + `assets/js/members.js` | Members' area: login (phone/ID + PIN), my fees, my materials, tasks, finances, rankings, all fees (board) |
| `apps-script/Code.gs` | Google Apps Script back end (paste into the Google Sheet) – see `apps-script/SETUP.md` |
| `data/sample-member.json` | Sample members' data for test mode (login ZA-001 / PIN 1234) |
| `assets/js/config.js` | **Settings to edit**: mobile money number, official info, API URL |
| `i18n/strings.csv` | **All page text**: `key, en, mg, fr, note`. Edit the `mg` / `fr` columns to correct the Malagasy / French |
| `data/verses.csv` | Bible verses (Malagasy, English KJV, French Louis Segond 1910). `use` = motto / home / donate. `checked` = verified against the Baiboly |
| `data/sample-public.json` | Sample data shown until the Apps Script API is connected |
| `docs/` | Put `sata.pdf` and `fitsipika-anatiny.pdf` here |
| `R/serve_local.R` | Preview the site locally |
| `R/build_content.R` | Rebuild `assets/js/content.js` after editing the CSV/JSON files (needed only to open pages by double-click) |
| `R/optimise_images.R` | Compress new photos before adding them |

## Editing the translations

Open `i18n/strings.csv` in LibreOffice Calc or Excel (encoding **UTF-8**, separator **comma**), edit the `mg` or `fr` column, save as CSV (UTF-8).
Do not change the `key` column. Then run `source("R/build_content.R")`. `{done}` and `{total}` are placeholders filled by the page – keep them.

## Preview locally

In RStudio, open `za-spafi-toliara.Rproj`, then run `source("R/serve_local.R")`.

## Publish on GitHub Pages

1. Create a repository (e.g. `za-spafi-toliara`) on the association's GitHub account and push this folder.
2. Repository **Settings → Pages → Source: Deploy from a branch → main / (root)**.
3. The site appears at `https://<account>.github.io/za-spafi-toliara/` (a custom domain can be added later).
