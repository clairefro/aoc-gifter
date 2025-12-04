window.PRELOAD_MERCH_URLS = ["assets/merch/hoodie-globe.png","assets/merch/hoodie-santa.png","assets/merch/long-t-10.png","assets/merch/onesie-santa.png","assets/merch/pullover-globe.png","assets/merch/pullover-santa.png","assets/merch/t-10.png","assets/merch/t-globe.png","assets/merch/t-santa.png","assets/merch/tank-globe.png"];
window.PRELOAD_STAMP_URLS = ["assets/stamps/aoc-hat-rr.png","assets/stamps/bag-globe.png","assets/stamps/star.png","assets/stamps/tumbler.png"];

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
    
    // Update audioEnabled in app.js scope
    if (window.updateAudioEnabled) {
      window.updateAudioEnabled(audioEnabled);
    }
    
    if (audioEnabled) {
      bgMusic.play().catch(err => console.log('Audio play prevented:', err));
      audioToggle.textContent = '🔊 Nullsleep - silent night';
    } else {
      bgMusic.pause();
      audioToggle.textContent = '🔇 Sound is Off';
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
}