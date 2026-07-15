# The Office — Episode Files

A fast, responsive, static browser for all 201 episodes of the U.S. television series *The Office*. It is built with plain HTML, CSS, and JavaScript and needs no server or build step.

## Features

- Search episode titles, summaries, and characters
- Filter by season, character, recurring joke, or favorites
- Sort by canonical episode number, original air date, or IMDb rating
- Save favorites in browser local storage
- Light and dark themes
- Episode links to Peacock's current search page
- Responsive, accessible cards for phones, tablets, and desktops

## Run locally

Because the episode data is loaded from JSON, serve the folder with any small static server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Data notes

The site uses the official 201-episode count, treating the supersized “Goodbye, Michael” broadcast as one episode while retaining split hour-long broadcasts where used by the official count. Ratings come from an IMDb-derived public dataset. Episode summaries and image URLs come from TVMaze. Character appearances and transcript-visible running-joke counts are derived from the open `the-office` transcript dataset; visual prank counts are curated.

This is a non-commercial fan project and is not affiliated with NBCUniversal, Peacock, IMDb, or TVMaze.
