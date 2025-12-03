// New app script: left-side controls (avatar upload + merch), right-side preview
const preview = document.getElementById("preview");
const ctx = preview.getContext("2d");

const fgFile = document.getElementById("fgFile");
const toleranceEl = document.getElementById("tolerance");
const tolVal = document.getElementById("tolVal");
const scaleEl = document.getElementById("scale");
const scaleVal = document.getElementById("scaleVal");
const resetFgBtn = document.getElementById("resetFg");
const exportBtn = document.getElementById("exportBtn");
let useAIRemoval = false;

const merchContainer = document.getElementById("merchOptions");
const merchScaleEl = document.getElementById("merchScale");
const merchScaleVal = document.getElementById("merchScaleVal");

let merchImages = [];
let merchSelected = 0;

let originalFgImage = null;
let processedFgCanvas = null;
let fgScale = 1;
let fgPos = { x: 50, y: 50 };
let dragging = false;
let dragOffset = { x: 0, y: 0 };

let merchScale = 1;

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

        // Auto-select first merch item when it loads
        if (idx === 0) {
          onSelect(0);
        }
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
}

function selectMerch(i) {
  merchSelected = i;
  refreshSelectionUI();

  // Center the selected merch horizontally, slightly down (15%) vertically
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;
    merchPos.x = (preview.width - mw) / 2;
    merchPos.y = (preview.height - mh) / 2 + preview.height * 0.15;
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

  // Background removal
  const bgColor = sampleEdges(g, w, h);
  const tolerance = Number(toleranceEl.value);
  const id = g.getImageData(0, 0, w, h);
  const data = id.data;

  // First pass: Remove background with tolerance
  for (let p = 0; p < data.length; p += 4) {
    const dr = data[p] - bgColor.r;
    const dg = data[p + 1] - bgColor.g;
    const db = data[p + 2] - bgColor.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= tolerance) {
      data[p + 3] = 0;
    } else if (dist <= tolerance * 1.5) {
      // Feather edge pixels for smoother transition
      data[p + 3] = Math.round(((dist - tolerance) / (tolerance * 0.5)) * 255);
    }
  }

  g.putImageData(id, 0, 0);

  processedFgCanvas = c;
  return c;
}

function applyManualMask() {
  if (!processedFgCanvas || !manualMask) return;
  const ctx = processedFgCanvas.getContext("2d");
  const imgData = ctx.getImageData(
    0,
    0,
    processedFgCanvas.width,
    processedFgCanvas.height
  );
  for (let i = 0; i < imgData.data.length; i += 4) {
    if (manualMask.data[i + 3] === 0) {
      imgData.data[i + 3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function magicWandErase(x, y, tolerance) {
  if (!processedFgCanvas) return;
  const ctx = processedFgCanvas.getContext("2d");
  const w = processedFgCanvas.width;
  const h = processedFgCanvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Get seed color
  const seedIdx = (y * w + x) * 4;
  const seedR = data[seedIdx];
  const seedG = data[seedIdx + 1];
  const seedB = data[seedIdx + 2];

  const visited = new Uint8Array(w * h);
  const stack = [[x, y]];
  const tol = Number(toleranceEl.value);

  while (stack.length > 0) {
    const [px, py] = stack.pop();
    if (px < 0 || px >= w || py < 0 || py >= h) continue;
    const idx = py * w + px;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pidx = idx * 4;
    const dr = data[pidx] - seedR;
    const dg = data[pidx + 1] - seedG;
    const db = data[pidx + 2] - seedB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist <= tol) {
      data[pidx + 3] = 0;
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function isPointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function applyLassoMask() {
  if (!processedFgCanvas || lassoPoints.length < 3) return;
  const ctx = processedFgCanvas.getContext("2d");
  const w = processedFgCanvas.width;
  const h = processedFgCanvas.height;

  if (!manualMask) {
    manualMask = ctx.createImageData(w, h);
    for (let i = 0; i < manualMask.data.length; i += 4) {
      manualMask.data[i + 3] = 255; // Start with everything visible
    }
  }

  const imgData = ctx.getImageData(0, 0, w, h);

  // Convert canvas points to image coordinates
  const scale = fgScale;
  const offsetX = fgPos.x;
  const offsetY = fgPos.y;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const canvasX = x * scale + offsetX;
      const canvasY = y * scale + offsetY;
      const idx = (y * w + x) * 4;

      if (!isPointInPolygon(canvasX, canvasY, lassoPoints)) {
        imgData.data[idx + 3] = 0;
        manualMask.data[idx + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  lassoPoints = [];
  editMode = null;
  lassoBtn.style.background = "";
  drawPreview();
}

function sampleEdges(g, w, h) {
  const samples = [];
  const box = Math.max(4, Math.floor(Math.min(w, h) / 20));

  // Sample all four corners
  const corners = [
    [0, 0, box, box],
    [w - box, 0, box, box],
    [0, h - box, box, box],
    [w - box, h - box, box, box],
  ];

  // Sample along edges (top, bottom, left, right)
  const edgeSamples = [
    [w / 4, 0, box, box],
    [w / 2, 0, box, box],
    [(3 * w) / 4, 0, box, box],
    [w / 4, h - box, box, box],
    [w / 2, h - box, box, box],
    [(3 * w) / 4, h - box, box, box],
    [0, h / 4, box, box],
    [0, h / 2, box, box],
    [0, (3 * h) / 4, box, box],
    [w - box, h / 4, box, box],
    [w - box, h / 2, box, box],
    [w - box, (3 * h) / 4, box, box],
  ];

  const allSamples = [...corners, ...edgeSamples];

  allSamples.forEach(([sx, sy, sw, sh]) => {
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
    samples.push({
      r: r / cnt,
      g: gr / cnt,
      b: b / cnt,
    });
  });

  // Use median instead of mean for more robust color detection
  samples.sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));
  const mid = Math.floor(samples.length / 2);
  return {
    r: Math.round(samples[mid].r),
    g: Math.round(samples[mid].g),
    b: Math.round(samples[mid].b),
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

exportBtn.addEventListener("click", () => {
  const out = document.createElement("canvas");
  out.width = preview.width;
  out.height = preview.height;
  const g = out.getContext("2d");

  // Draw blue background
  g.fillStyle = "#0e1022";
  g.fillRect(0, 0, out.width, out.height);

  // draw merch with glow
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;
    const mx = (out.width - mw) / 2;
    const my = (out.height - mh) / 2;

    g.save();
    g.shadowColor = "rgba(255, 255, 255, 0.8)";
    g.shadowBlur = 40;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    g.drawImage(merch, mx, my, mw, mh);
    g.restore();
    g.drawImage(merch, mx, my, mw, mh);
  }

  // draw avatar with glow
  if (processedFgCanvas) {
    const dw = processedFgCanvas.width * fgScale;
    const dh = processedFgCanvas.height * fgScale;

    g.save();
    g.shadowColor = "rgba(255, 255, 255, 0.8)";
    g.shadowBlur = 40;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    g.drawImage(processedFgCanvas, fgPos.x, fgPos.y, dw, dh);
    g.restore();
    g.drawImage(processedFgCanvas, fgPos.x, fgPos.y, dw, dh);
  }

  // Draw text
  drawText(g);

  const url = out.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "merged.png";
  a.click();
});

// Function to draw text with glow
function drawText(context) {
  context.save();
  context.font = '24px "Source Code Pro", monospace';
  context.fillStyle = "#39ff14";
  context.shadowColor = "#39ff14";
  context.shadowBlur = 15;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.fillText("Advent of Code", 20, 40);
  context.fillText("0xffff&2025", 20, 70);
  context.restore();
}

// Define the drawPreview function
function drawPreview() {
  // Always draw blue background first
  ctx.fillStyle = "#0e1022";
  ctx.fillRect(0, 0, preview.width, preview.height);

  // Draw merch with glow
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;

    // Draw white glow behind merch
    ctx.save();
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(merch, merchPos.x, merchPos.y, mw, mh);
    ctx.restore();

    // Draw merch on top
    ctx.drawImage(merch, merchPos.x, merchPos.y, mw, mh);
  }

  // Draw avatar with glow
  if (processedFgCanvas) {
    const w = processedFgCanvas.width * fgScale;
    const h = processedFgCanvas.height * fgScale;

    // Draw white glow behind avatar
    ctx.save();
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(processedFgCanvas, fgPos.x, fgPos.y, w, h);
    ctx.restore();

    // Draw avatar on top
    ctx.drawImage(processedFgCanvas, fgPos.x, fgPos.y, w, h);
  }

  // Draw text
  drawText(ctx);
}

// Consolidated dragging handler - checks top layer first (avatar), then bottom (merch)
preview.addEventListener("mousedown", (e) => {
  const rect = preview.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check avatar first (it's drawn on top)
  if (processedFgCanvas) {
    const w = processedFgCanvas.width * fgScale;
    const h = processedFgCanvas.height * fgScale;
    if (x >= fgPos.x && x <= fgPos.x + w && y >= fgPos.y && y <= fgPos.y + h) {
      dragging = true;
      dragOffset.x = x - fgPos.x;
      dragOffset.y = y - fgPos.y;
      return; // Stop here, don't check merch
    }
  }

  // Check merch (only if avatar wasn't hit)
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;
    if (
      x >= merchPos.x &&
      x <= merchPos.x + mw &&
      y >= merchPos.y &&
      y <= merchPos.y + mh
    ) {
      merchDragging = true;
      merchDragOffset.x = x - merchPos.x;
      merchDragOffset.y = y - merchPos.y;
      return;
    }
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

// touch - check avatar first, then merch
preview.addEventListener("touchstart", (e) => {
  const rect = preview.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;

  // Check avatar first (top layer)
  if (processedFgCanvas) {
    const w = processedFgCanvas.width * fgScale;
    const h = processedFgCanvas.height * fgScale;
    if (x >= fgPos.x && x <= fgPos.x + w && y >= fgPos.y && y <= fgPos.y + h) {
      dragging = true;
      dragOffset.x = x - fgPos.x;
      dragOffset.y = y - fgPos.y;
      e.preventDefault();
      return;
    }
  }

  // Check merch (only if avatar wasn't hit)
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;
    if (
      x >= merchPos.x &&
      x <= merchPos.x + mw &&
      y >= merchPos.y &&
      y <= merchPos.y + mh
    ) {
      merchDragging = true;
      merchDragOffset.x = x - merchPos.x;
      merchDragOffset.y = y - merchPos.y;
      e.preventDefault();
      return;
    }
  }
});
preview.addEventListener("touchmove", (e) => {
  const rect = preview.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;

  if (dragging) {
    fgPos.x = x - dragOffset.x;
    fgPos.y = y - dragOffset.y;
    drawPreview();
    e.preventDefault();
  } else if (merchDragging) {
    merchPos.x = x - merchDragOffset.x;
    merchPos.y = y - merchDragOffset.y;
    drawPreview();
    e.preventDefault();
  }
});
preview.addEventListener("touchend", () => {
  dragging = false;
  merchDragging = false;
});

// Merch dragging state (handler is consolidated above with avatar)
let merchDragging = false;
let merchDragOffset = { x: 0, y: 0 };
let merchPos = { x: preview.width / 2, y: preview.height / 2 }; // Default merch position (will be updated on load)

window.addEventListener("mousemove", (e) => {
  if (merchDragging) {
    const rect = preview.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    merchPos.x = x - merchDragOffset.x;
    merchPos.y = y - merchDragOffset.y;
    drawPreview();
  }
});

window.addEventListener("mouseup", () => {
  merchDragging = false;
});

// Add resizable handles for avatar and merch
let resizingAvatar = false;
let resizingMerch = false;
const handleSize = 10; // Size of the draggable corner handles

function isOverHandle(x, y, objPos, objWidth, objHeight) {
  return (
    x >= objPos.x + objWidth - handleSize &&
    x <= objPos.x + objWidth &&
    y >= objPos.y + objHeight - handleSize &&
    y <= objPos.y + objHeight
  );
}

preview.addEventListener("mousedown", (e) => {
  const rect = preview.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check if resizing avatar
  if (processedFgCanvas) {
    const w = processedFgCanvas.width * fgScale;
    const h = processedFgCanvas.height * fgScale;
    if (isOverHandle(x, y, fgPos, w, h)) {
      resizingAvatar = true;
      dragging = false; // Disable dragging
      return;
    }
  }

  // Check if resizing merch
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;
    if (isOverHandle(x, y, merchPos, mw, mh)) {
      resizingMerch = true;
      merchDragging = false; // Disable dragging
      return;
    }
  }

  // Enable dragging if not resizing
  if (processedFgCanvas) {
    const w = processedFgCanvas.width * fgScale;
    const h = processedFgCanvas.height * fgScale;
    if (x >= fgPos.x && x <= fgPos.x + w && y >= fgPos.y && y <= fgPos.y + h) {
      dragging = true;
      dragOffset.x = x - fgPos.x;
      dragOffset.y = y - fgPos.y;
      return;
    }
  }

  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;
    if (
      x >= merchPos.x &&
      x <= merchPos.x + mw &&
      y >= merchPos.y &&
      y <= merchPos.y + mh
    ) {
      merchDragging = true;
      merchDragOffset.x = x - merchPos.x;
      merchDragOffset.y = x - merchPos.y;
      return;
    }
  }
});

window.addEventListener("mousemove", (e) => {
  if (resizingAvatar) {
    const rect = preview.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dw = x - fgPos.x;
    const dh = y - fgPos.y;
    fgScale = Math.min(
      dw / processedFgCanvas.width,
      dh / processedFgCanvas.height
    );
    scaleEl.value = fgScale;
    scaleVal.textContent = fgScale.toFixed(2);
    drawPreview();
  }

  if (resizingMerch) {
    const rect = preview.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dw = x - merchPos.x;
    const dh = y - merchPos.y;
    merchScale = Math.min(
      dw / merchImages[merchSelected].width,
      dh / merchImages[merchSelected].height
    );
    merchScaleEl.value = merchScale;
    merchScaleVal.textContent = merchScale.toFixed(2);
    drawPreview();
  }
});

window.addEventListener("mouseup", () => {
  resizingAvatar = false;
  resizingMerch = false;
});

// Prevent context menu on right click
preview.addEventListener("contextmenu", (e) => e.preventDefault());

// Remove references to assets/backgrounds
// Removed background gallery initialization
const preloadMerch = window.PRELOAD_MERCH_URLS || [];
populateGallery(merchContainer, preloadMerch, merchImages, selectMerch);
