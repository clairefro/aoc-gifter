# AOC Gifter — PNG Background Cutter (Client-side)

Simple client-side web tool to remove the background from an uploaded PNG (A) and paste it onto one of up to four background PNGs (B). All processing is done locally in the browser — no server needed.

Quick local dev server

Install dependencies and run the dev server (recommended):

```bash
npm install
npm run dev
```

This runs `live-server` and opens `index.html` at `http://localhost:8000`.

If you prefer a minimal Python server, you can also run:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Usage

- Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
- Upload your foreground image (PNG A) using the `Foreground (PNG A)` file input.
- Adjust `Tolerance` to remove a mostly-uniform background color.
- Upload up to four merch images (PNG B) in the `Merch` panel, then click a thumbnail's `Select` button to choose it.
- Drag the foreground on the canvas to position it. Use `Scale` to resize.
- Click `Export PNG` to download the merged image.

Preloading backgrounds (optional)

If you'd like to preload background images so the slots are populated on page load, create two folders at the project root:

- `./merch` — put your 4 merch/background PNGs here (these are the main selectable backgrounds)
- `./backgrounds` — put your super/background images here (used behind the main merch image)

Then set `window.PRELOAD_BG_URLS` and `window.PRELOAD_SUPER_BG` before `src.app.js` runs; `index.html` already contains logic to fetch a generated `asset-manifest.json` and falls back to `/merch` and `/backgrounds` defaults.

The project includes a helper script that generates `asset-manifest.json` automatically. When you run `npm run dev` the `predev` script runs `scripts/generate-assets.js`, producing `asset-manifest.json` with the lists of files discovered in `./merch` and `./backgrounds`.

If you add or remove files later, regenerate the manifest with:

```bash
node scripts/generate-assets.js
# or
npm run build:assets
```

Then start the dev server:

```bash
npm run dev
```

Notes:

- Ensure your merch images are saved under `./merch` and your background(s) under `./backgrounds` before running the build script.
- The manifest lists image paths relative to the project root (e.g. `/merch/foo.png`) so they are directly fetchable by the browser when the dev server serves the project folder.

Merch scaling and backgrounds

- Use the **Merch Scale** slider to scale the selected merch image inside the canvas. This affects the preview and the exported PNG.
- Use the **Backgrounds** upload (previously called super-background) to provide a large image placed behind the selected merch (also scalable with the Backgrounds scale slider). This is useful for adding a textured or patterned backdrop behind your merch.

Notes & tips

- The built-in remover is a simple chroma-key (color-distance) method. For complex backgrounds, consider preparing a cleaner alpha mask beforehand.
- The app scales large images down for performance; output uses the selected background's original size.
