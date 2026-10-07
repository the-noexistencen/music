/**
 * Main Application Coordinator
 * Binds UI components to AudioPlayer, Storage, and ID3Parser.
 */

import { AppStorage } from './storage.js';
import { AudioPlayer, LoopMode } from './audio-player.js';
import { ID3Parser } from './id3-parser.js';

class App {
  constructor() {
    this.storage = new AppStorage();
    this.player = new AudioPlayer();
    
    this.tracks = [];
    this.filteredTracks = [];
    this.isDraggingScrubber = false;

    this.cacheDOMElements();
    this.init();
  }

  cacheDOMElements() {
    // Header & Actions
    this.uploadBtn = document.getElementById('uploadBtn');
    this.emptyUploadBtn = document.getElementById('emptyUploadBtn');
    this.fileInput = document.getElementById('fileInput');
    this.searchInput = document.getElementById('searchInput');
    this.quickActions = document.getElementById('quickActions');
    this.playAllBtn = document.getElementById('playAllBtn');
    this.shuffleAllBtn = document.getElementById('shuffleAllBtn');
    this.trackCountLabel = document.getElementById('trackCountLabel');

    // List & Empty state
    this.emptyLibrary = document.getElementById('emptyLibrary');
    this.trackList = document.getElementById('trackList');
    this.storageStatus = document.getElementById('storageStatus');

    // Mini Player
    this.miniPlayer = document.getElementById('miniPlayer');
    this.miniThumb = document.getElementById('miniThumb');
    this.miniTitle = document.getElementById('miniTitle');
    this.miniArtist = document.getElementById('miniArtist');
    this.miniPlayBtn = document.getElementById('miniPlayBtn');
    this.miniPlayIcon = document.getElementById('miniPlayIcon');
    this.miniNextBtn = document.getElementById('miniNextBtn');

    // Full Player Sheet
    this.fullPlayerSheet = document.getElementById('fullPlayerSheet');
    this.sheetBgBlur = document.getElementById('sheetBgBlur');
    this.sheetDismissBtn = document.getElementById('sheetDismissBtn');
    this.sheetHandle = document.getElementById('sheetHandle');
    this.sheetArtwork = document.getElementById('sheetArtwork');
    this.sheetTrackTitle = document.getElementById('sheetTrackTitle');
    this.sheetTrackArtist = document.getElementById('sheetTrackArtist');
    this.scrubberSlider = document.getElementById('scrubberSlider');
    this.currentTimeLabel = document.getElementById('currentTimeLabel');
    this.remainingTimeLabel = document.getElementById('remainingTimeLabel');
    this.shuffleBtn = document.getElementById('shuffleBtn');
    this.prevBtn = document.getElementById('prevBtn');
    this.sheetPlayBtn = document.getElementById('sheetPlayBtn');
    this.sheetPlayIcon = document.getElementById('sheetPlayIcon');
    this.nextBtn = document.getElementById('nextBtn');
    this.loopBtn = document.getElementById('loopBtn');
    this.loopIcon = document.getElementById('loopIcon');

    // Toast
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');
  }

  async init() {
    this.bindEvents();
    this.bindPlayerEvents();
    this.registerServiceWorker();

    try {
      await this.storage.init();
      await this.loadTracks();
      await this.updateStorageUsageDisplay();
    } catch (err) {
      console.error('Initialization error:', err);
      this.showToast('Error initializing local database.');
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(
          (reg) => console.log('ServiceWorker registered:', reg.scope),
          (err) => console.warn('ServiceWorker registration failed:', err)
        );
      });
    }
  }

  bindEvents() {
    // Upload triggers
    const triggerUpload = () => this.fileInput.click();
    this.uploadBtn.addEventListener('click', triggerUpload);
    this.emptyUploadBtn.addEventListener('click', triggerUpload);

    this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e.target.files));

    // Drag and drop onto document
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleFileSelection(e.dataTransfer.files);
      }
    });

    // Search filter
    this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

    // Quick actions
    this.playAllBtn.addEventListener('click', () => {
      if (this.tracks.length > 0) {
        if (this.player.isShuffle) this.player.toggleShuffle();
        this.player.setPlaylist(this.tracks, 0, true);
      }
    });

    this.shuffleAllBtn.addEventListener('click', () => {
      if (this.tracks.length > 0) {
        if (!this.player.isShuffle) this.player.toggleShuffle();
        this.player.setPlaylist(this.tracks, 0, true);
      }
    });

    // Mini Player
    this.miniPlayer.addEventListener('click', (e) => {
      // Don't expand if clicking mini controls
      if (e.target.closest('.mini-ctrl-btn')) return;
      this.openFullPlayer();
    });

    this.miniPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.player.togglePlay();
    });

    this.miniNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.player.next();
    });

    // Full Sheet Player Controls
    this.sheetDismissBtn.addEventListener('click', () => this.closeFullPlayer());
    this.sheetHandle.addEventListener('click', () => this.closeFullPlayer());

    this.sheetPlayBtn.addEventListener('click', () => this.player.togglePlay());
    this.prevBtn.addEventListener('click', () => this.player.previous());
    this.nextBtn.addEventListener('click', () => this.player.next());
    this.shuffleBtn.addEventListener('click', () => this.player.toggleShuffle());
    this.loopBtn.addEventListener('click', () => this.player.cycleLoop());

    // Scrubber
    this.scrubberSlider.addEventListener('input', () => {
      this.isDraggingScrubber = true;
      if (this.player.audio.duration) {
        const targetTime = (this.scrubberSlider.value / 100) * this.player.audio.duration;
        this.currentTimeLabel.textContent = this.formatTime(targetTime);
        this.remainingTimeLabel.textContent = `-${this.formatTime(Math.max(0, this.player.audio.duration - targetTime))}`;
      }
    });

    this.scrubberSlider.addEventListener('change', () => {
      this.isDraggingScrubber = false;
      this.player.seekPercent(parseFloat(this.scrubberSlider.value));
    });

    // Touch swipe down on full sheet to dismiss
    let touchStartY = 0;
    this.fullPlayerSheet.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    this.fullPlayerSheet.addEventListener('touchend', (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      if (touchEndY - touchStartY > 90) {
        this.closeFullPlayer();
      }
    }, { passive: true });
  }

  bindPlayerEvents() {
    this.player.on('playStateChange', (isPlaying) => {
      this.updatePlayStateUI(isPlaying);
    });

    this.player.on('trackChange', (track) => {
      this.updateCurrentTrackUI(track);
    });

    this.player.on('timeUpdate', ({ currentTime, duration }) => {
      if (this.isDraggingScrubber) return;
      if (!duration || isNaN(duration)) {
        this.scrubberSlider.value = 0;
        this.currentTimeLabel.textContent = '0:00';
        this.remainingTimeLabel.textContent = '-0:00';
        return;
      }

      const percent = (currentTime / duration) * 100;
      this.scrubberSlider.value = percent;
      this.currentTimeLabel.textContent = this.formatTime(currentTime);
      this.remainingTimeLabel.textContent = `-${this.formatTime(Math.max(0, duration - currentTime))}`;
    });

    this.player.on('modeChange', ({ shuffle, loop }) => {
      this.updateModeUI(shuffle, loop);
    });
  }

  async loadTracks() {
    const rawTracks = await this.storage.getAllTracks();
    
    // Create Object URLs for artworks
    this.tracks = rawTracks.map(t => ({
      ...t,
      artworkUrl: t.artworkBlob ? URL.createObjectURL(t.artworkBlob) : null
    }));

    this.filteredTracks = [...this.tracks];
    this.renderTrackList();
    this.updateHeaderCounts();
  }

  async handleFileSelection(files) {
    if (!files || files.length === 0) return;

    this.showToast(`Importing ${files.length} audio file(s)...`);

    let importedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|m4a|wav|aac|flac|ogg)$/i)) {
        continue;
      }

      try {
        const metadata = await ID3Parser.parse(file);
        const trackId = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        const newTrack = {
          id: trackId,
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          audioBlob: file,
          artworkBlob: metadata.artworkBlob,
          size: file.size,
          dateAdded: Date.now()
        };

        await this.storage.saveTrack(newTrack);
        importedCount++;
      } catch (err) {
        console.error('Failed to import track:', file.name, err);
      }
    }

    this.fileInput.value = ''; // Reset input
    await this.loadTracks();
    await this.updateStorageUsageDisplay();
    this.showToast(`Imported ${importedCount} track(s) locally!`);
  }

  renderTrackList() {
    this.trackList.innerHTML = '';

    if (this.tracks.length === 0) {
      this.emptyLibrary.style.display = 'flex';
      this.quickActions.style.display = 'none';
      return;
    }

    this.emptyLibrary.style.display = 'none';
    this.quickActions.style.display = 'flex';

    this.filteredTracks.forEach((track, index) => {
      const item = document.createElement('div');
      item.className = 'track-item';
      if (this.player.currentTrack && this.player.currentTrack.id === track.id) {
        item.classList.add('playing');
      }

      // Artwork thumbnail
      const thumb = document.createElement('div');
      thumb.className = 'track-thumb';
      if (track.artworkUrl) {
        const img = document.createElement('img');
        img.src = track.artworkUrl;
        img.alt = track.title;
        img.loading = 'lazy';
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>`;
      }

      // Track Information
      const info = document.createElement('div');
      info.className = 'track-info';
      info.innerHTML = `
        <div class="track-title">${this.escapeHTML(track.title)}</div>
        <div class="track-subtitle">${this.escapeHTML(track.artist)} • ${this.formatFileSize(track.size)}</div>
      `;

      // Actions / Delete button
      const actions = document.createElement('div');
      actions.className = 'track-actions';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'track-menu-btn';
      deleteBtn.setAttribute('aria-label', 'Delete track');
      deleteBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;

      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Remove "${track.title}" from local library?`)) {
          await this.storage.deleteTrack(track.id);
          if (this.player.currentTrack && this.player.currentTrack.id === track.id) {
            this.player.stop();
            this.miniPlayer.classList.add('hidden');
          }
          await this.loadTracks();
          await this.updateStorageUsageDisplay();
          this.showToast('Track removed.');
        }
      });

      actions.appendChild(deleteBtn);

      item.appendChild(thumb);
      item.appendChild(info);
      item.appendChild(actions);

      item.addEventListener('click', () => {
        const originalIndex = this.tracks.findIndex(t => t.id === track.id);
        this.player.setPlaylist(this.tracks, originalIndex >= 0 ? originalIndex : 0, true);
        this.openFullPlayer();
      });

      this.trackList.appendChild(item);
    });
  }

  handleSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.filteredTracks = [...this.tracks];
    } else {
      this.filteredTracks = this.tracks.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.artist && t.artist.toLowerCase().includes(q)) ||
        (t.album && t.album.toLowerCase().includes(q))
      );
    }
    this.renderTrackList();
  }

  updatePlayStateUI(isPlaying) {
    const playSvg = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
    const pauseSvg = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;

    // Mini Play button
    this.miniPlayIcon.innerHTML = isPlaying ? pauseSvg : playSvg;

    // Full Sheet Play button
    this.sheetPlayIcon.innerHTML = isPlaying ? pauseSvg : playSvg;

    // Artwork animation
    if (isPlaying) {
      this.sheetArtwork.classList.remove('paused');
    } else {
      this.sheetArtwork.classList.add('paused');
    }
  }

  updateCurrentTrackUI(track) {
    if (!track) {
      this.miniPlayer.classList.add('hidden');
      return;
    }

    this.miniPlayer.classList.remove('hidden');

    // Update Mini Player
    this.miniTitle.textContent = track.title || 'Unknown Title';
    this.miniArtist.textContent = track.artist || 'Unknown Artist';

    if (track.artworkUrl) {
      this.miniThumb.innerHTML = `<img src="${track.artworkUrl}" alt="${track.title}">`;
    } else {
      this.miniThumb.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>`;
    }

    // Update Full Sheet Player
    this.sheetTrackTitle.textContent = track.title || 'Unknown Title';
    this.sheetTrackArtist.textContent = track.artist || 'Unknown Artist';

    const defaultArt = 'icons/icon-512.png';
    const artSrc = track.artworkUrl || defaultArt;
    this.sheetArtwork.src = artSrc;
    this.sheetBgBlur.style.backgroundImage = `url(${artSrc})`;

    // Re-render highlight in track list
    document.querySelectorAll('.track-item').forEach(item => item.classList.remove('playing'));
    const currentElem = Array.from(document.querySelectorAll('.track-item')).find(item => {
      const titleElem = item.querySelector('.track-title');
      return titleElem && titleElem.textContent === track.title;
    });
    if (currentElem) currentElem.classList.add('playing');
  }

  updateModeUI(shuffle, loop) {
    // Shuffle UI
    if (shuffle) {
      this.shuffleBtn.classList.add('mode-active');
    } else {
      this.shuffleBtn.classList.remove('mode-active');
    }

    // Loop UI
    if (loop === LoopMode.ALL) {
      this.loopBtn.classList.add('mode-active');
      this.loopIcon.innerHTML = `
        <polyline points="17 1 21 5 17 9"></polyline>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
        <polyline points="7 23 3 19 7 15"></polyline>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
      `;
    } else if (loop === LoopMode.ONE) {
      this.loopBtn.classList.add('mode-active');
      this.loopIcon.innerHTML = `
        <polyline points="17 1 21 5 17 9"></polyline>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
        <polyline points="7 23 3 19 7 15"></polyline>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        <text x="10.5" y="15" font-size="9" fill="currentColor" font-weight="bold">1</text>
      `;
    } else {
      this.loopBtn.classList.remove('mode-active');
      this.loopIcon.innerHTML = `
        <polyline points="17 1 21 5 17 9"></polyline>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
        <polyline points="7 23 3 19 7 15"></polyline>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
      `;
    }
  }

  openFullPlayer() {
    this.fullPlayerSheet.classList.add('open');
  }

  closeFullPlayer() {
    this.fullPlayerSheet.classList.remove('open');
  }

  updateHeaderCounts() {
    const count = this.tracks.length;
    this.trackCountLabel.textContent = `${count} ${count === 1 ? 'Song' : 'Songs'}`;
  }

  async updateStorageUsageDisplay() {
    const totalBytes = this.tracks.reduce((acc, t) => acc + (t.size || 0), 0);
    const estimate = await this.storage.getStorageUsage();

    if (totalBytes > 0) {
      this.storageStatus.textContent = `${this.tracks.length} Songs (${this.formatFileSize(totalBytes)}) • Ad-Free • Local Device Storage`;
    } else {
      this.storageStatus.textContent = `Ad-Free • 100% Offline • Local Storage`;
    }
  }

  showToast(msg) {
    this.toastMessage.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2800);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
