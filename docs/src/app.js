// New app script: left-side controls (avatar upload + merch), right-side preview
const preview = document.getElementById("preview");
const ctx = preview.getContext("2d");

const fgFile = document.getElementById("fgFile");
const toleranceEl = document.getElementById("tolerance");
const tolVal = document.getElementById("tolVal");
const scaleEl = document.getElementById("scale");
const scaleVal = document.getElementById("scaleVal");
const rotationEl = document.getElementById("rotation");
const rotationVal = document.getElementById("rotationVal");
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
let fgRotation = 0;
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

rotationEl.addEventListener("input", () => {
  fgRotation = Number(rotationEl.value);
  rotationVal.textContent = fgRotation;
  drawPreview();
});

resetFgBtn.addEventListener("click", () => {
  if (!processedFgCanvas) return;
  fgScale = 1;
  scaleEl.value = 1;
  scaleVal.textContent = "1.00";
  fgRotation = 0;
  rotationEl.value = 0;
  rotationVal.textContent = "0";
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

const exportCanvasBtn = document.getElementById("exportCanvasBtn");
if (exportCanvasBtn) {
  exportCanvasBtn.addEventListener("click", () => {
    const url = preview.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "hohoho.png";
    a.click();
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

  // draw avatar with glow (bottom layer)
  if (processedFgCanvas) {
    const dw = processedFgCanvas.width * fgScale;
    const dh = processedFgCanvas.height * fgScale;

    g.save();

    // Apply rotation
    g.translate(fgPos.x + dw / 2, fgPos.y + dh / 2);
    g.rotate((fgRotation * Math.PI) / 180);
    g.translate(-dw / 2, -dh / 2);

    g.shadowColor = "rgba(255, 255, 255, 0.8)";
    g.shadowBlur = 40;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    g.drawImage(processedFgCanvas, 0, 0, dw, dh);

    // Draw avatar on top (no shadow)
    g.shadowColor = "transparent";
    g.shadowBlur = 0;
    g.drawImage(processedFgCanvas, 0, 0, dw, dh);

    g.restore();
  }

  // draw merch with glow (top layer)
  const merch = merchImages[merchSelected];
  if (merch) {
    const mw = merch.width * merchScale;
    const mh = merch.height * merchScale;

    g.save();
    g.shadowColor = "rgba(255, 255, 255, 0.8)";
    g.shadowBlur = 40;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    g.drawImage(merch, merchPos.x, merchPos.y, mw, mh);
    g.restore();
    g.drawImage(merch, merchPos.x, merchPos.y, mw, mh);
  } // Draw text
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

  // Draw avatar with glow (bottom layer)
  if (processedFgCanvas) {
    const w = processedFgCanvas.width * fgScale;
    const h = processedFgCanvas.height * fgScale;

    ctx.save();

    // Translate to center of avatar, rotate, then translate back
    ctx.translate(fgPos.x + w / 2, fgPos.y + h / 2);
    ctx.rotate((fgRotation * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);

    // Draw white glow behind avatar
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(processedFgCanvas, 0, 0, w, h);

    // Draw avatar on top (no shadow)
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.drawImage(processedFgCanvas, 0, 0, w, h);

    ctx.restore();
  }

  // Draw merch with glow (top layer)
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

  // Draw text
  drawText(ctx);
}

// Consolidated dragging handler - checks top layer first (merch), then bottom (avatar)
preview.addEventListener("mousedown", (e) => {
  const rect = preview.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check merch first (it's drawn on top)
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
      return; // Stop here, don't check avatar
    }
  }

  // Check avatar (only if merch wasn't hit)
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
  preview.classList.remove("can-drag");
});

// Show move cursor when hovering over draggable items
preview.addEventListener("mousemove", (e) => {
  if (dragging || merchDragging) return;

  const rect = preview.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  let canDrag = false;

  // Check merch first (top layer)
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
      canDrag = true;
    }
  }

  // Then check avatar (bottom layer)
  if (!canDrag && processedFgCanvas) {
    const fw = processedFgCanvas.width * fgScale;
    const fh = processedFgCanvas.height * fgScale;
    if (
      x >= fgPos.x &&
      x <= fgPos.x + fw &&
      y >= fgPos.y &&
      y <= fgPos.y + fh
    ) {
      canDrag = true;
    }
  }

  if (canDrag) {
    preview.classList.add("can-drag");
  } else {
    preview.classList.remove("can-drag");
  }
});

// touch - check merch first, then avatar
preview.addEventListener("touchstart", (e) => {
  const rect = preview.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;

  // Check merch first (top layer)
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

  // Check avatar (only if merch wasn't hit)
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
