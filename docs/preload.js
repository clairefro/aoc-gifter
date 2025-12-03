window.PRELOAD_MERCH_URLS = ["assets/merch/long-t-500.png","assets/merch/t-500.png"];

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