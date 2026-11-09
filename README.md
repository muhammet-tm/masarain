# Masarain

Two paths, one call.

This repository holds the website of Masarain, a team entry for the EDGE challenge of Advanced Technology Pioneers 2026. Masarain keeps a voice call alive while a device moves between Wi-Fi, 5G, satellite, and wired networks.

## What is here

| File | Purpose |
|---|---|
| `index.html` | The landing page: the real Wi-Fi test replayed on an instrument, the results, the method, how Masarain decides, the limits, the team, and the files |
| `simulation.html` | A replay of recorded runs of the prototype over emulated links, one run per route |
| `materials.html` | The reference materials: every table of results, the link models and their sources, the method, the plan for the test on real networks, and the references |
| `deck.html` | The deck, with motion |
| `files/` | The data files of the tables, as comma-separated text, and the two raw logs of the real Wi-Fi test |
| `assets/` | The style sheets, the page scripts, the data the landing page draws, the recorded runs, the logo, two icons, and anime.js in `assets/vendor/` |
| `fonts/` | The three typefaces of the site |

The site is static. Opening `index.html` in a browser is enough. Every figure on the pages is generated from the team's results files; the pages are built elsewhere and copied here.

## What the simulation page shows

Each recording is one voice call carried over the same route by two methods at the same time: switching after failure, which is what devices do today, and Masarain. The radio links were emulated; the prototype that produced the recordings is real software. On this site the page replays the recordings. The same page can show a live run when the team's demo server serves it, and that server is not part of this repository.

## Fonts

Big Shoulders Display, Archivo, and Martian Mono, each distributed under the SIL Open Font License 1.1. See `LICENSE-FONTS.md`.

## Third-party code

The landing page uses anime.js 4.0.2 by Julian Garnier for its entrances, under the MIT License. The notice is in `assets/vendor/anime-LICENSE.txt`.

## Team

Muhammet Yalkapov, Sulaymon Sadullo, and Ahmed Mohamed Almheiri, Abu Dhabi University.

