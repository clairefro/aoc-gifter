// New app script: left-side controls (avatar upload + merch + backgrounds), right-side preview
const preview = document.getElementById("preview");
const ctx = preview.getContext("2d");

const fgFile = document.getElementById("fgFile");
const toleranceEl = document.getElementById("tolerance");
const tolVal = document.getElementById("tolVal");
const scaleEl = document.getElementById("scale");
const scaleVal = document.getElementById("scaleVal");
const resetFgBtn = document.getElementById("resetFg");
const exportBtn = document.getElementById("exportBtn");

const merchContainer = document.getElementById("merchOptions");
const bgContainer = document.getElementById("bgOptions");
const merchScaleEl = document.getElementById("merchScale");
const merchScaleVal = document.getElementById("merchScaleVal");
const bgScaleEl = document.getElementById("bgScale");
const bgScaleVal = document.getElementById("bgScaleVal");

let merchImages = [];
let bgImages = [];
let merchSelected = 0;
let bgSelected = 0;

let originalFgImage = null;
let processedFgCanvas = null;
let fgScale = 1;
let fgPos = { x: 50, y: 50 };
let dragging = false;
let dragOffset = { x: 0, y: 0 };

let merchScale = 1;
let bgScale = 1;

const MAX_DIM = 1200;

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function makeSlot(img) {
  const slot = document.createElement("div");
  slot.className = "bg-slot";
  const thumb = document.createElement("img");
  thumb.src = img.src;
  thumb.alt = "";
  slot.appendChild(thumb);
  return { slot, thumb };
}

function populateGallery(container, urls, imagesArray, onSelect) {
  container.innerHTML = "";
  imagesArray.length = 0;
  urls = Array.isArray(urls) ? urls : [];
  urls.forEach((u, idx) => {
    loadImageFromUrl(u)
      .then((im) => {
        imagesArray[idx] = im;
        const { slot, thumb } = makeSlot(im);
        thumb.addEventListener("click", () => onSelect(idx));
        container.appendChild(slot);
        refreshSelectionUI();
      })
      .catch(() => {
        // skip if fails
      });
  });
}

function refreshSelectionUI() {
  // merch
  Array.from(merchContainer.children).forEach((el, i) =>
    el.classList.toggle("selected", i === merchSelected)
  );
  Array.from(bgContainer.children).forEach((el, i) =>
    el.classList.toggle("selected", i === bgSelected)
  );
}

function selectMerch(i) {
  merchSelected = i;
  refreshSelectionUI();
  drawPreview();
}
function selectBg(i) {
  bgSelected = i;
  refreshSelectionUI();
  const im = bgImages[i];
  if (im) {
    preview.width = im.width;
    preview.height = im.height;
  }
  // center avatar
  if (processedFgCanvas) {
    fgPos.x = (preview.width - processedFgCanvas.width) / 2;
    fgPos.y = (preview.height - processedFgCanvas.height) / 2;
  }
  drawPreview();
}

fgFile.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  originalFgImage = await loadImageFromFile(f);
  await processForeground();
  fgPos.x = (preview.width - processedFgCanvas.width) / 2;
  fgPos.y = (preview.height - processedFgCanvas.height) / 2;
  drawPreview();
});

async function processForeground() {
  if (!originalFgImage) return;
  const scale = Math.min(
    1,
    MAX_DIM / Math.max(originalFgImage.width, originalFgImage.height)
  );
  const w = Math.round(originalFgImage.width * scale);
  const h = Math.round(originalFgImage.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.drawImage(originalFgImage, 0, 0, w, h);
  const bgColor = sampleCorners(g, w, h);
  const tolerance = Number(toleranceEl.value);
  const id = g.getImageData(0, 0, w, h);
  const data = id.data;
  for (let p = 0; p < data.length; p += 4) {
    const dr = data[p] - bgColor.r;
    const dg = data[p + 1] - bgColor.g;
    const db = data[p + 2] - bgColor.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= tolerance) data[p + 3] = 0;
  }
  g.putImageData(id, 0, 0);
  processedFgCanvas = c;
  return c;
}

function sampleCorners(g, w, h) {
  const sample = (sx, sy, sw, sh) => {
    const d = g.getImageData(sx, sy, sw, sh).data;
    let r = 0,
      gr = 0,
      b = 0,
      cnt = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      gr += d[i + 1];
      b += d[i + 2];
      cnt++;
    }
    return {
      r: Math.round(r / cnt),
      g: Math.round(gr / cnt),
      b: Math.round(b / cnt),
    };
  };
  const box = Math.max(4, Math.floor(Math.min(w, h) / 20));
  const a = sample(0, 0, box, box),
    b = sample(w - box, 0, box, box),
    c = sample(0, h - box, box, box),
    d = sample(w - box, h - box, box, box);
  return {
    r: Math.round((a.r + b.r + c.r + d.r) / 4),
    g: Math.round((a.g + b.g + c.g + d.g) / 4),
    b: Math.round((a.b + b.b + c.b + d.b) / 4),
  };
}

tolElHandler();
function tolElHandler() {
  if (toleranceEl)
    toleranceEl.addEventListener("input", async () => {
      tolVal.textContent = toleranceEl.value;
      if (!originalFgImage) return;
      await processForeground();
      drawPreview();
    });
}

scaleEl.addEventListener("input", () => {
  fgScale = Number(scaleEl.value);
  scaleVal.textContent = fgScale.toFixed(2);
  drawPreview();
});
resetFgBtn.addEventListener("click", () => {
  if (!processedFgCanvas) return;
  fgScale = 1;
  scaleEl.value = 1;
  scaleVal.textContent = "1.00";
  fgPos.x = (preview.width - processedFgCanvas.width) / 2;
  fgPos.y = (preview.height - processedFgCanvas.height) / 2;
  drawPreview();
});

if (merchScaleEl) {
  merchScaleEl.addEventListener("input", () => {
    merchScale = Number(merchScaleEl.value);
    merchScaleVal.textContent = merchScale.toFixed(2);
    drawPreview();
  });
}
if (bgScaleEl) {
  bgScaleEl.addEventListener("input", () => {
    bgScale = Number(bgScaleEl.value);
    bgScaleVal.textContent = bgScale.toFixed(2);
    drawPreview();
  });
}

exportBtn.addEventListener("click", () => {
  const out = document.createElement("canvas");
  const bg = bgImages[bgSelected];
  if (bg) {
    out.width = bg.width;
    out.height = bg.height;
  } else {
    out.width = preview.width;
    out.height = preview.height;
  }
  const g = out.getContext("2d");
  // draw background
  if (bg) {
    const w = bg.width * bgScale;
    const h = bg.height * bgScale;
    const x = (out.width - w) / 2;
    const y = (out.height - h) / 2;
    g.drawImage(bg, x, y, w, h);
  }
  // draw merch
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;
    const mx = (out.width - mw) / 2;
    const my = (out.height - mh) / 2;
    g.drawImage(merch, mx, my, mw, mh);
  }
  // draw avatar
  if (processedFgCanvas) {
    const dw = processedFgCanvas.width * fgScale;
    const dh = processedFgCanvas.height * fgScale;
    g.drawImage(processedFgCanvas, fgPos.x, fgPos.y, dw, dh);
  }
  const url = out.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "merged.png";
  a.click();
});

function drawPreview() {
  ctx.clearRect(0, 0, preview.width, preview.height);
  const bg = bgImages[bgSelected];
  if (bg) {
    const w = bg.width * bgScale;
    const h = bg.height * bgScale;
    const x = (preview.width - w) / 2;
    const y = (preview.height - h) / 2;
    ctx.drawImage(bg, x, y, w, h);
  }
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;
    const mx = (preview.width - mw) / 2;
    const my = (preview.height - mh) / 2;
    ctx.drawImage(merch, mx, my, mw, mh);
  }
  if (processedFgCanvas) {
    const w = processedFgCanvas.width * fgScale;
    const h = processedFgCanvas.height * fgScale;
    ctx.drawImage(processedFgCanvas, fgPos.x, fgPos.y, w, h);
  }
}

// dragging avatar
preview.addEventListener("mousedown", (e) => {
  if (!processedFgCanvas) return;
  const rect = preview.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = processedFgCanvas.width * fgScale;
  const h = processedFgCanvas.height * fgScale;
  if (x >= fgPos.x && x <= fgPos.x + w && y >= fgPos.y && y <= fgPos.y + h) {
    dragging = true;
    dragOffset.x = x - fgPos.x;
    dragOffset.y = y - fgPos.y;
  }
});
window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const rect = preview.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  fgPos.x = x - dragOffset.x;
  fgPos.y = y - dragOffset.y;
  drawPreview();
});
window.addEventListener("mouseup", () => {
  dragging = false;
});
// touch
preview.addEventListener("touchstart", (e) => {
  if (!processedFgCanvas) return;
  const rect = preview.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;
  const w = processedFgCanvas.width * fgScale;
  const h = processedFgCanvas.height * fgScale;
  if (x >= fgPos.x && x <= fgPos.x + w && y >= fgPos.y && y <= fgPos.y + h) {
    dragging = true;
    dragOffset.x = x - fgPos.x;
    dragOffset.y = y - fgPos.y;
    e.preventDefault();
  }
});
preview.addEventListener("touchmove", (e) => {
  if (!dragging) return;
  const rect = preview.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;
  fgPos.x = x - dragOffset.x;
  fgPos.y = y - dragOffset.y;
  drawPreview();
  e.preventDefault();
});
preview.addEventListener("touchend", () => {
  dragging = false;
});

// initialize galleries from preload arrays set by index.html (asset-manifest)
const preloadMerch = window.PRELOAD_MERCH_URLS || window.PRELOAD_BG_URLS || [];
const preloadBgs =
  window.PRELOAD_BG_URLS ||
  (window.PRELOAD_SUPER_BG ? [window.PRELOAD_SUPER_BG] : []);
populateGallery(merchContainer, preloadMerch, merchImages, selectMerch);
populateGallery(bgContainer, preloadBgs, bgImages, selectBg);

// set initial default preview size
preview.width = 800;
preview.height = 600;
if (merchScaleVal) merchScaleVal.textContent = merchScale.toFixed(2);
if (bgScaleVal) bgScaleVal.textContent = bgScale.toFixed(2);
