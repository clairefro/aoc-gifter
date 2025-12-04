#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const candidates = {
  merch: [path.join(root, "src", "assets", "merch")],
  sound: [path.join(root, "src", "assets", "sound")],
};

const docsDir = path.join(root, "docs");
const docsAssetsDir = path.join(docsDir, "assets");

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
        if (!/\.(png|jpg|jpeg|webp|avif|mp3)$/i.test(f)) continue;
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
const soundFiles = gatherFiles(candidates.sound);

// prepare docs folders and copy files into docs/assets/merch
ensureDir(docsAssetsDir);
const docsMerchDir = path.join(docsAssetsDir, "merch");
ensureDir(docsMerchDir);
const docsSoundDir = path.join(docsAssetsDir, "sound");
ensureDir(docsSoundDir);

function copyList(list, destDir) {
  const docsPaths = [];
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
      docsPaths.push(
        path.posix.join("assets", path.basename(destDir), item.name)
      );
    } catch (err) {
      console.error("Failed to copy", item.src, "->", dest, err.message);
    }
  }
  return docsPaths;
}

const docsMerch = copyList(merchFiles, docsMerchDir);
const docsSound = copyList(soundFiles, docsSoundDir);

// Ensure styles.css is copied to the docs directory
const stylesSrc = path.join(root, "src", "styles.css");
const stylesDest = path.join(docsDir, "src", "styles.css");
ensureDir(path.dirname(stylesDest));
try {
  fs.copyFileSync(stylesSrc, stylesDest);
  console.log("Copied", stylesSrc, "to", stylesDest);
} catch (err) {
  console.error("Failed to copy styles.css", err.message);
}

// Ensure app.js is copied to the docs directory
const appJsSrc = path.join(root, "src", "app.js");
const appJsDest = path.join(docsDir, "src", "app.js");
ensureDir(path.dirname(appJsDest));
try {
  fs.copyFileSync(appJsSrc, appJsDest);
  console.log("Copied", appJsSrc, "to", appJsDest);
} catch (err) {
  console.error("Failed to copy app.js", err.message);
}

// Automatically select the first merch item in the HTML
const merchHtml = docsMerch
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

// Update HTML layout to ensure controls are on the left and canvas is on the right
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="AoC gift giving for the unemployed" />
  <title>AoC Gifter — Editor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./src/styles.css" />
</head>
<body>
  <header>
    <h1>(Unofficial) AoC Gifter</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">If you're employed, consider buying <a href="https://cottonbureau.com/people/advent-of-code" target="_blank" rel="noopener noreferrer" style="color: #007bff;">real merch</a></p>
    <button id="audioToggle" style="position: absolute; top: 20px; right: 20px; padding: 8px 16px; cursor: pointer; font-size: 14px;">🔊 Sound On</button>
  </header>
  <main style="display: flex;">
    <div style="flex: 1;">
      <section class="controls">
        <div class="panel">
          <h2>Head</h2>
          <input id="fgFile" type="file" accept="image/png" />
          <div id="headControls" style="display: none;">
            <div class="row">
              <label>Tolerance: <span id="tolVal">32</span></label>
              <input id="tolerance" type="range" min="0" max="200" value="32" />
            </div>

            <div class="row">
              <label>Head Scale: <span id="scaleVal">1.00</span></label>
              <input id="scale" type="range" min="0.1" max="3" step="0.01" value="1" />
            </div>
            <div class="row">
              <label>Head Rotation: <span id="rotationVal">0</span>°</label>
              <input id="rotation" type="range" min="0" max="360" step="1" value="0" />
            </div>
            <div class="row">
              <button id="resetFg">Reset Head</button>
            </div>
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
      </section>
    </div>

    <div style="flex: 2;">
      <section class="canvas-area">
        <canvas id="preview" width="600" height="700"></canvas>
        <div class="help">Drag the head and merch on the canvas to position. Use the sliders to resize and rotate.</div>
        <div style="text-align: center; margin-top: 20px;">
          <button id="exportCanvasBtn" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Export PNG</button>
        </div>
      </section>
    </div>
  </main>

  <footer>
    <small>All processing is done locally in your browser.</small>
  </footer>

  <audio id="bgMusic" loop>
    <source src="./assets/sound/Nullsleep - silent night.mp3" type="audio/mpeg">
  </audio>

  <script src="./preload.js"></script>
  <script type="module" src="./src/app.js"></script>
</body>
</html>`;

try {
  const htmlPath = path.join(docsDir, "index.html");

  fs.writeFileSync(htmlPath, html, { encoding: "utf8" });
  console.log("Wrote", htmlPath);
} catch (err) {
  console.error("Failed to write docs/index.html", err);
}

// Update preload.js to ensure the blue background is consistently redrawn during merch selection
const preloadJs = `window.PRELOAD_MERCH_URLS = ${JSON.stringify(docsMerch)};

// Function to draw the canvas background
const drawBackground = (ctx, canvas) => {
  ctx.fillStyle = '#0e1022'; // Blue background color
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

// Function to draw text with glow
const drawText = (ctx) => {
  ctx.save();
  ctx.font = 'bold 24px "Source Code Pro", monospace';
  ctx.fillStyle = '#39ff14';
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillText('Advent of Code', 20, 40);
  ctx.fillText('0xffff&2025', 20, 70);
  ctx.restore();
};

// Function to draw the merch image with glow
const drawMerch = (ctx, canvas, merchImage) => {
  const centerX = (canvas.width - merchImage.width) / 2;
  const centerY = (canvas.height - merchImage.height) / 2;
  
  // Draw white glow behind merch
  ctx.save();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(merchImage, centerX, centerY);
  ctx.restore();
  
  // Draw merch on top
  ctx.drawImage(merchImage, centerX, centerY);
};

// Load and center the selected merch item
const loadMerch = (merchUrl) => {
  const canvas = document.getElementById('preview');
  const ctx = canvas.getContext('2d');
  const merchImage = new Image();
  merchImage.src = merchUrl;
  merchImage.onload = () => {
    // Always redraw the background first
    drawBackground(ctx, canvas);
    drawMerch(ctx, canvas, merchImage);
    drawText(ctx);
  };
};

// Automatically load the first merch item
if (window.PRELOAD_MERCH_URLS.length > 0) {
  loadMerch(window.PRELOAD_MERCH_URLS[0]);
}

// Add event listener for merch selection
const merchOptions = document.querySelectorAll('input[name="merch"]');
merchOptions.forEach((option) => {
  option.addEventListener('change', (e) => {
    loadMerch(e.target.value);
  });
});

// Play background music on user interaction
const bgMusic = document.getElementById('bgMusic');
const audioToggle = document.getElementById('audioToggle');

// Restore audio preference from localStorage (default to true)
let audioEnabled = localStorage.getItem('aocAudioEnabled') !== 'false';

if (bgMusic && audioToggle) {
  // Set initial button state based on saved preference
  audioToggle.textContent = audioEnabled ? '🔊 Nullsleep - silent night' : '🔇 Sound is Off';
  
  const playMusic = () => {
    if (audioEnabled) {
      bgMusic.play().catch(err => console.log('Audio play prevented:', err));
    }
    // Remove listeners after first play attempt
    document.removeEventListener('click', playMusic);
    document.removeEventListener('keydown', playMusic);
  };
  
  audioToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    audioEnabled = !audioEnabled;
    
    // Save preference to localStorage
    localStorage.setItem('aocAudioEnabled', audioEnabled);
    
    if (audioEnabled) {
      bgMusic.play().catch(err => console.log('Audio play prevented:', err));
      audioToggle.textContent = '🔊 Nullsleep - silent night';
    } else {
      bgMusic.pause();
      audioToggle.textContent = '🔇 Sound Off';
    }
  });
  
  document.addEventListener('click', playMusic);
  document.addEventListener('keydown', playMusic);
}

// Add flicker effect to file input if no avatar chosen
const fgFileInput = document.getElementById('fgFile');
const headControls = document.getElementById('headControls');
if (fgFileInput) {
  // Start with flicker
  fgFileInput.classList.add('flicker');
  
  // Show head controls and remove flicker when file is chosen
  fgFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      fgFileInput.classList.remove('flicker');
      if (headControls) {
        headControls.style.display = 'block';
      }
    }
  });
}`;

const preloadJsPath = path.join(docsDir, "preload.js");
try {
  fs.writeFileSync(preloadJsPath, preloadJs, { encoding: "utf8" });
  console.log("Wrote", preloadJsPath);
} catch (err) {
  console.error("Failed to write preload.js", err);
}
