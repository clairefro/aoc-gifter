#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const candidates = {
  merch: [path.join(root, "src", "assets", "merch")],
  backgrounds: [path.join(root, "src", "assets", "backgrounds")],
};

const publicDir = path.join(root, "public");
const publicAssetsDir = path.join(publicDir, "assets");

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function gatherFiles(candidateDirs) {
  const seen = new Set();
  const out = [];
  for (const dir of candidateDirs) {
    try {
      const items = fs.readdirSync(dir);
      for (const f of items) {
        if (!/\.(png|jpg|jpeg|webp|avif)$/i.test(f)) continue;
        if (seen.has(f)) continue;
        seen.add(f);
        out.push({ name: f, src: path.join(dir, f) });
      }
    } catch (err) {
      // skip missing dirs
    }
  }
  return out;
}

// collect files
const merchFiles = gatherFiles(candidates.merch);
const bgFiles = gatherFiles(candidates.backgrounds);

// prepare public folders and copy files into public/assets/merch and public/assets/backgrounds
ensureDir(publicAssetsDir);
const publicMerchDir = path.join(publicAssetsDir, "merch");
const publicBgDir = path.join(publicAssetsDir, "backgrounds");
ensureDir(publicMerchDir);
ensureDir(publicBgDir);

function copyList(list, destDir) {
  const publicPaths = [];
  for (const item of list) {
    const dest = path.join(destDir, item.name);
    try {
      // copy, overwrite if different
      if (
        !fs.existsSync(dest) ||
        fs.statSync(dest).mtimeMs < fs.statSync(item.src).mtimeMs
      ) {
        fs.copyFileSync(item.src, dest);
      }
      publicPaths.push(
        path.posix.join("assets", path.basename(destDir), item.name)
      );
    } catch (err) {
      console.error("Failed to copy", item.src, "->", dest, err.message);
    }
  }
  return publicPaths;
}

const publicMerch = copyList(merchFiles, publicMerchDir);
const publicBgs = copyList(bgFiles, publicBgDir);

// Ensure styles.css is copied to the public directory
const stylesSrc = path.join(root, "src", "styles.css");
const stylesDest = path.join(publicDir, "src", "styles.css");
ensureDir(path.dirname(stylesDest));
try {
  fs.copyFileSync(stylesSrc, stylesDest);
  console.log("Copied", stylesSrc, "to", stylesDest);
} catch (err) {
  console.error("Failed to copy styles.css", err.message);
}

// Ensure app.js is copied to the public directory
const appJsSrc = path.join(root, "src", "app.js");
const appJsDest = path.join(publicDir, "src", "app.js");
ensureDir(path.dirname(appJsDest));
try {
  fs.copyFileSync(appJsSrc, appJsDest);
  console.log("Copied", appJsSrc, "to", appJsDest);
} catch (err) {
  console.error("Failed to copy app.js", err.message);
}

// Update paths in the HTML template to reflect the new asset structure
const merchHtml = publicMerch
  .map(
    (p, i) => `
      <li>
        <label>
          <input type="radio" name="merch" value="${p}" ${
      i === 0 ? "checked" : ""
    } />
          <img src="${p}" alt="merch-${i}" />
        </label>
      </li>`
  )
  .join("\n");
const bgHtml = publicBgs
  .map(
    (p, i) => `
      <li>
        <label>
          <input type="radio" name="background" value="${p}" ${
      i === 0 ? "checked" : ""
    } />
          <img src="${p}" alt="bg-${i}" />
        </label>
      </li>`
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AOC Gifter — Editor</title>
  <link rel="stylesheet" href="/src/styles.css" />
  <style>
    .bg-options img {
      max-width: 100px;
      max-height: 100px;
    }
    .bg-options ul {
      list-style: none; /* Remove bullet styling */
      padding: 0;
      margin: 0; /* Ensure no extra spacing */
    }
    .bg-options li {
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <header>
    <h1>AOC Gifter — Cut & Paste PNGs</h1>
  </header>
  <main style="display: flex;">
    <div style="flex: 3;">
      <section class="controls">
        <div class="panel">
          <h2>Avatar (foreground)</h2>
          <input id="fgFile" type="file" accept="image/png" />
          <div class="row">
            <label>Tolerance: <span id="tolVal">32</span></label>
            <input id="tolerance" type="range" min="0" max="200" value="32" />
          </div>
          <div class="row">
            <label>Avatar Scale: <span id="scaleVal">1.00</span></label>
            <input id="scale" type="range" min="0.1" max="3" step="0.01" value="1" />
          </div>
          <div class="row">
            <button id="resetFg">Reset Avatar</button>
            <button id="exportBtn">Export PNG</button>
          </div>
        </div>

        <div class="panel">
          <h2>Merch — choose one</h2>
          <ul id="merchOptions" class="bg-options">
${merchHtml}
          </ul>
          <div class="row">
            <label>Merch Scale: <span id="merchScaleVal">1.00</span></label>
            <input id="merchScale" type="range" min="0.1" max="3" step="0.01" value="1" />
          </div>
        </div>

        <div class="panel">
          <h2>Backgrounds — choose one</h2>
          <ul id="bgOptions" class="bg-options">
${bgHtml}
          </ul>
        </div>
      </section>

      <section class="canvas-area">
        <canvas id="preview" width="800" height="600"></canvas>
        <div class="help">Drag the avatar on the canvas to position it. Use the Avatar Scale slider to resize.</div>
      </section>
    </div>
  </main>

  <footer>
    <small>All processing is done locally in your browser.</small>
  </footer>

  <script type="module" src="/src/app.js"></script>
</body>
</html>`;

try {
  const htmlPath = path.join(publicDir, "index.html");

  fs.writeFileSync(htmlPath, html, { encoding: "utf8" });
  console.log("Wrote", htmlPath);
} catch (err) {
  console.error("Failed to write public/index.html", err);
}
