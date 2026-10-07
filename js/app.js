/**
 * Main Application Coordinator
 * Binds UI components to AudioPlayer, Storage, ID3Parser, and Custom Playlists.
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
    this.playlists = [];
    this.activePlaylist = null;
    this.currentTab = 'songs'; // 'songs' | 'playlists'
    this.isDraggingScrubber = false;

    this.cacheDOMElements();
    this.init();
  }

  cacheDOMElements() {
    // Tabs & Views
    this.tabSongs = document.getElementById('tabSongs');
    this.tabPlaylists = document.getElementById('tabPlaylists');
    this.songsView = document.getElementById('songsView');
    this.playlistsView = document.getElementById('playlistsView');
    this.playlistDetailView = document.getElementById('playlistDetailView');

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

    // Playlists UI
    this.newPlaylistBtn = document.getElementById('newPlaylistBtn');
    this.emptyPlaylists = document.getElementById('emptyPlaylists');
    this.playlistGrid = document.getElementById('playlistGrid');
    this.playlistBackBtn = document.getElementById('playlistBackBtn');
    this.playlistHeroArtwork = document.getElementById('playlistHeroArtwork');
    this.playlistHeroTitle = document.getElementById('playlistHeroTitle');
    this.playlistHeroSubtitle = document.getElementById('playlistHeroSubtitle');
    this.deletePlaylistBtn = document.getElementById('deletePlaylistBtn');
    this.playPlaylistBtn = document.getElementById('playPlaylistBtn');
    this.shufflePlaylistBtn = document.getElementById('shufflePlaylistBtn');
    this.playlistTrackList = document.getElementById('playlistTrackList');

    // Modals & Action Sheet
    this.createPlaylistModal = document.getElementById('createPlaylistModal');
    this.playlistNameInput = document.getElementById('playlistNameInput');
    this.cancelPlaylistBtn = document.getElementById('cancelPlaylistBtn');
    this.confirmPlaylistBtn = document.getElementById('confirmPlaylistBtn');

    this.actionSheetOverlay = document.getElementById('actionSheetOverlay');
    this.actionSheetHeader = document.getElementById('actionSheetHeader');
    this.actionSheetList = document.getElementById('actionSheetList');
    this.actionSheetCancelBtn = document.getElementById('actionSheetCancelBtn');

    // Mini Player
    this.miniPlayer = document.getElementById('miniPlayer');
    this.miniThumb = document.getElementById('miniThumb');
    this.miniTitle = document.getElementById('miniTitle');
    this.miniArtist = document.getElementById('miniArtist');
    this.miniPlayBtn = document.getElementById('miniPlayBtn');
    this.miniPlayIcon = document.getElementById('miniPlayIcon');
    this.miniNextBtn = document.getElementById('miniNextBtn');
    this.miniProgressFill = document.getElementById('miniProgressFill');

    // Full Player Sheet
    this.fullPlayerSheet = document.getElementById('fullPlayerSheet');
    this.sheetDismissBtn = document.getElementById('sheetDismissBtn');
    this.sheetContextName = document.getElementById('sheetContextName');
    this.sheetHeaderActionBtn = document.getElementById('sheetHeaderActionBtn');
    this.sheetArtwork = document.getElementById('sheetArtwork');
    this.sheetTrackTitle = document.getElementById('sheetTrackTitle');
    this.sheetTrackArtist = document.getElementById('sheetTrackArtist');
    this.sheetTrackMenuBtn = document.getElementById('sheetTrackMenuBtn');
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
      await this.storage.requestPersistence();
      await this.loadTracks();
      await this.loadPlaylists();
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
          (reg) => {
            console.log('ServiceWorker registered:', reg.scope);
            reg.update();
          },
          (err) => console.warn('ServiceWorker registration failed:', err)
        );
      });
    }
  }

  bindEvents() {
    // Tabs Navigation
    this.tabSongs.addEventListener('click', () => this.switchTab('songs'));
    this.tabPlaylists.addEventListener('click', () => this.switchTab('playlists'));

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

    // Quick actions (Songs)
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

    // Playlist Actions
    this.newPlaylistBtn.addEventListener('click', () => this.openCreatePlaylistModal());
    this.cancelPlaylistBtn.addEventListener('click', () => this.closeCreatePlaylistModal());
    this.confirmPlaylistBtn.addEventListener('click', () => this.handleCreatePlaylist());
    this.playlistNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleCreatePlaylist();
    });

    this.playlistBackBtn.addEventListener('click', () => {
      this.activePlaylist = null;
      this.playlistDetailView.style.display = 'none';
      this.playlistsView.style.display = 'flex';
      this.updateHeaderCounts();
    });

    this.deletePlaylistBtn.addEventListener('click', async () => {
      if (!this.activePlaylist) return;
      if (confirm(`Delete playlist "${this.activePlaylist.name}"? (Songs will remain in your library)`)) {
        await this.storage.deletePlaylist(this.activePlaylist.id);
        this.activePlaylist = null;
        this.playlistDetailView.style.display = 'none';
        this.playlistsView.style.display = 'flex';
        await this.loadPlaylists();
        this.showToast('Playlist deleted.');
      }
    });

    this.playPlaylistBtn.addEventListener('click', () => {
      if (!this.activePlaylist) return;
      const plTracks = this.getPlaylistTracks(this.activePlaylist);
      if (plTracks.length > 0) {
        if (this.player.isShuffle) this.player.toggleShuffle();
        this.player.setPlaylist(plTracks, 0, true);
      }
    });

    this.shufflePlaylistBtn.addEventListener('click', () => {
      if (!this.activePlaylist) return;
      const plTracks = this.getPlaylistTracks(this.activePlaylist);
      if (plTracks.length > 0) {
        if (!this.player.isShuffle) this.player.toggleShuffle();
        this.player.setPlaylist(plTracks, 0, true);
      }
    });

    // Action Sheet Overlay
    this.actionSheetCancelBtn.addEventListener('click', () => this.closeActionSheet());
    this.actionSheetOverlay.addEventListener('click', (e) => {
      if (e.target === this.actionSheetOverlay) this.closeActionSheet();
    });

    // Mini Player
    this.miniPlayer.addEventListener('click', (e) => {
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
    if (this.sheetHandle) this.sheetHandle.addEventListener('click', () => this.closeFullPlayer());

    const openCurrentOptions = () => {
      if (this.player.currentTrack) {
        this.openTrackActionSheet(this.player.currentTrack, !!this.activePlaylist);
      }
    };
    if (this.sheetTrackMenuBtn) this.sheetTrackMenuBtn.addEventListener('click', openCurrentOptions);
    if (this.sheetHeaderActionBtn) this.sheetHeaderActionBtn.addEventListener('click', openCurrentOptions);

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
      if (this.miniProgressFill) {
        this.miniProgressFill.style.width = `${percent}%`;
      }
      this.currentTimeLabel.textContent = this.formatTime(currentTime);
      this.remainingTimeLabel.textContent = `-${this.formatTime(Math.max(0, duration - currentTime))}`;
    });

    this.player.on('modeChange', ({ shuffle, loop }) => {
      this.updateModeUI(shuffle, loop);
    });
  }

  switchTab(tab) {
    this.currentTab = tab;
    if (tab === 'songs') {
      this.tabSongs.classList.add('active');
      this.tabPlaylists.classList.remove('active');
      this.songsView.style.display = 'block';
      this.playlistsView.style.display = 'none';
      this.playlistDetailView.style.display = 'none';
    } else {
      this.tabPlaylists.classList.add('active');
      this.tabSongs.classList.remove('active');
      this.songsView.style.display = 'none';
      if (this.activePlaylist) {
        this.playlistsView.style.display = 'none';
        this.playlistDetailView.style.display = 'flex';
      } else {
        this.playlistsView.style.display = 'flex';
        this.playlistDetailView.style.display = 'none';
      }
    }
    this.updateHeaderCounts();
  }

  async loadTracks() {
    const rawTracks = await this.storage.getAllTracks();
    this.tracks = rawTracks.map(t => ({
      ...t,
      artworkUrl: t.artworkBlob ? URL.createObjectURL(t.artworkBlob) : null
    }));

    this.filteredTracks = [...this.tracks];
    this.renderTrackList();
    this.updateHeaderCounts();
  }

  async loadPlaylists() {
    this.playlists = await this.storage.getAllPlaylists();
    this.renderPlaylistsGrid();
    if (this.activePlaylist) {
      const updated = this.playlists.find(p => p.id === this.activePlaylist.id);
      if (updated) {
        this.activePlaylist = updated;
        this.renderPlaylistDetail();
      }
    }
    this.updateHeaderCounts();
  }

  getPlaylistTracks(playlist) {
    if (!playlist || !playlist.trackIds) return [];
    return playlist.trackIds
      .map(id => this.tracks.find(t => t.id === id))
      .filter(Boolean);
  }

  renderPlaylistsGrid() {
    this.playlistGrid.innerHTML = '';

    if (this.playlists.length === 0) {
      this.emptyPlaylists.style.display = 'flex';
      return;
    }

    this.emptyPlaylists.style.display = 'none';

    this.playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'playlist-card';

      const plTracks = this.getPlaylistTracks(pl);
      const firstWithArt = plTracks.find(t => t.artworkUrl);

      const artContainer = document.createElement('div');
      artContainer.className = 'playlist-card-artwork';
      if (firstWithArt) {
        artContainer.innerHTML = `<img src="${firstWithArt.artworkUrl}" alt="${pl.name}" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        artContainer.innerHTML = `
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>`;
      }

      const title = document.createElement('div');
      title.className = 'playlist-card-title';
      title.textContent = pl.name;

      const count = document.createElement('div');
      count.className = 'playlist-card-count';
      count.textContent = `${pl.trackIds.length} ${pl.trackIds.length === 1 ? 'Song' : 'Songs'}`;

      card.appendChild(artContainer);
      card.appendChild(title);
      card.appendChild(count);

      card.addEventListener('click', () => {
        this.openPlaylist(pl);
      });

      this.playlistGrid.appendChild(card);
    });
  }

  openPlaylist(playlist) {
    this.activePlaylist = playlist;
    this.playlistsView.style.display = 'none';
    this.playlistDetailView.style.display = 'flex';
    this.renderPlaylistDetail();
    this.updateHeaderCounts();
  }

  renderPlaylistDetail() {
    if (!this.activePlaylist) return;
    const plTracks = this.getPlaylistTracks(this.activePlaylist);

    this.playlistHeroTitle.textContent = this.activePlaylist.name;
    this.playlistHeroSubtitle.textContent = `${plTracks.length} ${plTracks.length === 1 ? 'Song' : 'Songs'}`;

    const firstWithArt = plTracks.find(t => t.artworkUrl);
    if (firstWithArt) {
      this.playlistHeroArtwork.innerHTML = `<img src="${firstWithArt.artworkUrl}" alt="${this.activePlaylist.name}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      this.playlistHeroArtwork.innerHTML = `
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>`;
    }

    this.playlistTrackList.innerHTML = '';

    if (plTracks.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-library';
      emptyMsg.style.padding = '30px 16px';
      emptyMsg.innerHTML = `
        <div class="empty-icon">🎵</div>
        <h3>Playlist is Empty</h3>
        <p>Go to the Songs tab and tap the options button (•••) on any song to add it here.</p>
      `;
      this.playlistTrackList.appendChild(emptyMsg);
      return;
    }

    plTracks.forEach((track, index) => {
      const item = this.createTrackElement(track, () => {
        this.player.setPlaylist(plTracks, index, true);
        this.openFullPlayer();
      }, true);
      this.playlistTrackList.appendChild(item);
    });
  }

  createTrackElement(track, onPlay, isInsidePlaylist = false) {
    const item = document.createElement('div');
    item.className = 'track-item';
    if (this.player.currentTrack && this.player.currentTrack.id === track.id) {
      item.classList.add('playing');
    }

    // Thumbnail
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

    // Info
    const info = document.createElement('div');
    info.className = 'track-info';
    info.innerHTML = `
      <div class="track-title">${this.escapeHTML(track.title)}</div>
      <div class="track-subtitle">${this.escapeHTML(track.artist)} • ${this.formatFileSize(track.size)}</div>
    `;

    // Action button (3-dot menu)
    const actions = document.createElement('div');
    actions.className = 'track-actions';
    const menuBtn = document.createElement('button');
    menuBtn.className = 'track-menu-btn';
    menuBtn.setAttribute('aria-label', 'Options');
    menuBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="2"></circle>
        <circle cx="12" cy="12" r="2"></circle>
        <circle cx="12" cy="19" r="2"></circle>
      </svg>
    `;

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openTrackActionSheet(track, isInsidePlaylist);
    });

    actions.appendChild(menuBtn);

    item.appendChild(thumb);
    item.appendChild(info);
    item.appendChild(actions);

    item.addEventListener('click', onPlay);
    return item;
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

    this.filteredTracks.forEach((track) => {
      const item = this.createTrackElement(track, () => {
        const originalIndex = this.tracks.findIndex(t => t.id === track.id);
        this.player.setPlaylist(this.tracks, originalIndex >= 0 ? originalIndex : 0, true);
        this.openFullPlayer();
      }, false);
      this.trackList.appendChild(item);
    });
  }

  // --- Modal & Action Sheet Methods ---
  openCreatePlaylistModal() {
    this.playlistNameInput.value = '';
    this.createPlaylistModal.classList.add('open');
    setTimeout(() => this.playlistNameInput.focus(), 150);
  }

  closeCreatePlaylistModal() {
    this.createPlaylistModal.classList.remove('open');
  }

  async handleCreatePlaylist() {
    const name = this.playlistNameInput.value.trim();
    if (!name) return;

    const newPl = await this.storage.createPlaylist(name);
    this.closeCreatePlaylistModal();
    await this.loadPlaylists();
    this.showToast(`Created playlist "${name}"`);
    this.openPlaylist(newPl);
  }

  openTrackActionSheet(track, isInsidePlaylist) {
    this.actionSheetHeader.textContent = track.title || 'Song Options';
    this.actionSheetList.innerHTML = '';

    // Option: Add to Playlist
    const addBtn = document.createElement('button');
    addBtn.className = 'action-sheet-item';
    addBtn.innerHTML = `<span>➕ Add to Playlist...</span><span>›</span>`;
    addBtn.addEventListener('click', () => {
      this.openAddToPlaylistSubmenu(track);
    });
    this.actionSheetList.appendChild(addBtn);

    // Option: Remove from this playlist (if viewing inside a playlist)
    if (isInsidePlaylist && this.activePlaylist) {
      const removePlBtn = document.createElement('button');
      removePlBtn.className = 'action-sheet-item danger';
      removePlBtn.innerHTML = `<span>Remove from Playlist</span>`;
      removePlBtn.addEventListener('click', async () => {
        await this.storage.removeTrackFromPlaylist(this.activePlaylist.id, track.id);
        await this.loadPlaylists();
        this.closeActionSheet();
        this.showToast(`Removed from "${this.activePlaylist.name}"`);
      });
      this.actionSheetList.appendChild(removePlBtn);
    }

    // Option: Delete from Library completely
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-sheet-item danger';
    deleteBtn.innerHTML = `<span>Delete from Library</span>`;
    deleteBtn.addEventListener('click', async () => {
      this.closeActionSheet();
      if (confirm(`Completely delete "${track.title}" from your device?`)) {
        await this.storage.deleteTrack(track.id);
        if (this.player.currentTrack && this.player.currentTrack.id === track.id) {
          this.player.stop();
          this.miniPlayer.classList.add('hidden');
        }
        await this.loadTracks();
        await this.loadPlaylists();
        await this.updateStorageUsageDisplay();
        this.showToast('Song deleted.');
      }
    });
    this.actionSheetList.appendChild(deleteBtn);

    this.actionSheetOverlay.classList.add('open');
  }

  openAddToPlaylistSubmenu(track) {
    this.actionSheetHeader.textContent = `Add "${track.title}" to:`;
    this.actionSheetList.innerHTML = '';

    // Button to create a brand new playlist on the fly
    const newBtn = document.createElement('button');
    newBtn.className = 'action-sheet-item';
    newBtn.style.color = 'var(--accent)';
    newBtn.innerHTML = `<span>+ New Playlist</span>`;
    newBtn.addEventListener('click', () => {
      this.closeActionSheet();
      this.openCreatePlaylistModal();
    });
    this.actionSheetList.appendChild(newBtn);

    if (this.playlists.length === 0) {
      const emptyNote = document.createElement('div');
      emptyNote.style.padding = '14px 18px';
      emptyNote.style.color = 'var(--text-secondary)';
      emptyNote.style.fontSize = '14px';
      emptyNote.textContent = 'No playlists yet. Tap "+ New Playlist" above.';
      this.actionSheetList.appendChild(emptyNote);
      return;
    }

    this.playlists.forEach(pl => {
      const item = document.createElement('button');
      item.className = 'action-sheet-item';
      const alreadyIn = pl.trackIds.includes(track.id);
      item.innerHTML = `
        <span>${this.escapeHTML(pl.name)} (${pl.trackIds.length})</span>
        <span style="font-size: 13px; color: ${alreadyIn ? 'var(--accent)' : 'var(--text-muted)'};">
          ${alreadyIn ? '✓ Added' : '+ Add'}
        </span>
      `;

      item.addEventListener('click', async () => {
        if (!alreadyIn) {
          await this.storage.addTrackToPlaylist(pl.id, track.id);
          await this.loadPlaylists();
          this.closeActionSheet();
          this.showToast(`Added to "${pl.name}"`);
        } else {
          this.showToast(`Already in "${pl.name}"`);
        }
      });

      this.actionSheetList.appendChild(item);
    });
  }

  closeActionSheet() {
    this.actionSheetOverlay.classList.remove('open');
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

    this.fileInput.value = '';
    await this.loadTracks();
    await this.loadPlaylists();
    await this.updateStorageUsageDisplay();
    this.showToast(`Imported ${importedCount} track(s) locally!`);
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

    this.miniPlayIcon.innerHTML = isPlaying ? pauseSvg : playSvg;
    this.sheetPlayIcon.innerHTML = isPlaying ? pauseSvg : playSvg;

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

    this.sheetTrackTitle.textContent = track.title || 'Unknown Title';
    this.sheetTrackArtist.textContent = track.artist || 'Unknown Artist';

    const defaultArt = 'icons/icon-512.png';
    const artSrc = track.artworkUrl || defaultArt;
    this.sheetArtwork.src = artSrc;
    if (this.sheetContextName) {
      this.sheetContextName.textContent = this.activePlaylist ? this.activePlaylist.name : 'Your Library';
    }

    document.querySelectorAll('.track-item').forEach(item => item.classList.remove('playing'));
    const currentElem = Array.from(document.querySelectorAll('.track-item')).find(item => {
      const titleElem = item.querySelector('.track-title');
      return titleElem && titleElem.textContent === track.title;
    });
    if (currentElem) currentElem.classList.add('playing');
  }

  updateModeUI(shuffle, loop) {
    if (shuffle) {
      this.shuffleBtn.classList.add('mode-active');
    } else {
      this.shuffleBtn.classList.remove('mode-active');
    }

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
    const songCount = this.tracks.length;
    if (this.trackCountLabel) {
      this.trackCountLabel.textContent = `${songCount} ${songCount === 1 ? 'song' : 'songs'}`;
    }
    if (this.activePlaylist && this.playlistTrackCountLabel) {
      const plCount = this.activePlaylist.trackIds.length;
      this.playlistTrackCountLabel.textContent = `${plCount} ${plCount === 1 ? 'song' : 'songs'}`;
    }
  }

  async updateStorageUsageDisplay() {
    const totalBytes = this.tracks.reduce((acc, t) => acc + (t.size || 0), 0);
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

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
