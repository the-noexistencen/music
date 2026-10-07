/**
 * Main Application Coordinator
 * Minimalist, bare-bones design with no track icons and Spotify-style lock screen controls.
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
    this.currentTab = 'songs';
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
    this.miniTitle = document.getElementById('miniTitle');
    this.miniArtist = document.getElementById('miniArtist');
    this.miniPlayBtn = document.getElementById('miniPlayBtn');
    this.miniPlayText = document.getElementById('miniPlayText');
    this.miniNextBtn = document.getElementById('miniNextBtn');
    this.miniProgressFill = document.getElementById('miniProgressFill');

    // Full Player Sheet
    this.fullPlayerSheet = document.getElementById('fullPlayerSheet');
    this.sheetDismissBtn = document.getElementById('sheetDismissBtn');
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
    this.sheetPlayText = document.getElementById('sheetPlayText');
    this.nextBtn = document.getElementById('nextBtn');
    this.loopBtn = document.getElementById('loopBtn');

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

    // Drag and drop
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
      if (confirm(`Delete playlist "${this.activePlaylist.name}"?`)) {
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
    this.sheetPlayBtn.addEventListener('click', () => this.player.togglePlay());
    this.prevBtn.addEventListener('click', () => this.player.previous());
    this.nextBtn.addEventListener('click', () => this.player.next());
    this.shuffleBtn.addEventListener('click', () => this.player.toggleShuffle());
    this.loopBtn.addEventListener('click', () => this.player.cycleLoop());

    if (this.sheetTrackMenuBtn) {
      this.sheetTrackMenuBtn.addEventListener('click', () => {
        if (this.player.currentTrack) {
          this.openTrackActionSheet(this.player.currentTrack, !!this.activePlaylist);
        }
      });
    }

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

    // Swipe down to dismiss sheet
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
      if (this.miniProgressFill && duration > 0) {
        const progressPct = (currentTime / duration) * 100;
        this.miniProgressFill.style.width = `${progressPct}%`;
      }

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

      const title = document.createElement('div');
      title.className = 'playlist-card-title';
      title.textContent = pl.name;

      const count = document.createElement('div');
      count.className = 'playlist-card-count';
      count.textContent = `${pl.trackIds.length} ${pl.trackIds.length === 1 ? 'song' : 'songs'}`;

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
    this.playlistHeroSubtitle.textContent = `${plTracks.length} ${plTracks.length === 1 ? 'song' : 'songs'}`;

    this.playlistTrackList.innerHTML = '';

    if (plTracks.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-library';
      emptyMsg.innerHTML = `<p>Playlist is empty. Add songs from the Songs tab.</p>`;
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

  // Pure text track row - NO track icon/thumbnail
  createTrackElement(track, onPlay, isInsidePlaylist = false) {
    const item = document.createElement('div');
    item.className = 'track-item';
    if (this.player.currentTrack && this.player.currentTrack.id === track.id) {
      item.classList.add('playing');
    }

    const info = document.createElement('div');
    info.className = 'track-info';
    info.innerHTML = `
      <div class="track-title">${this.escapeHTML(track.title)}</div>
      <div class="track-subtitle">${this.escapeHTML(track.artist)} • ${this.formatFileSize(track.size)}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'track-actions';
    const menuBtn = document.createElement('button');
    menuBtn.className = 'track-menu-btn';
    menuBtn.setAttribute('aria-label', 'Options');
    menuBtn.textContent = '•••';

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openTrackActionSheet(track, isInsidePlaylist);
    });

    actions.appendChild(menuBtn);
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
    this.showToast(`Created "${name}"`);
    this.openPlaylist(newPl);
  }

  openTrackActionSheet(track, isInsidePlaylist) {
    this.actionSheetHeader.textContent = track.title || 'Song Options';
    this.actionSheetList.innerHTML = '';

    const addBtn = document.createElement('button');
    addBtn.className = 'action-sheet-item';
    addBtn.innerHTML = `<span>Add to Playlist...</span><span>›</span>`;
    addBtn.addEventListener('click', () => {
      this.openAddToPlaylistSubmenu(track);
    });
    this.actionSheetList.appendChild(addBtn);

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

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-sheet-item danger';
    deleteBtn.innerHTML = `<span>Delete from Device</span>`;
    deleteBtn.addEventListener('click', async () => {
      this.closeActionSheet();
      if (confirm(`Delete "${track.title}" from your device?`)) {
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
      emptyNote.style.padding = '12px 16px';
      emptyNote.style.color = 'var(--text-secondary)';
      emptyNote.style.fontSize = '13px';
      emptyNote.textContent = 'No playlists yet.';
      this.actionSheetList.appendChild(emptyNote);
      return;
    }

    this.playlists.forEach(pl => {
      const item = document.createElement('button');
      item.className = 'action-sheet-item';
      const alreadyIn = pl.trackIds.includes(track.id);
      item.innerHTML = `
        <span>${this.escapeHTML(pl.name)} (${pl.trackIds.length})</span>
        <span style="font-size: 12px; color: ${alreadyIn ? 'var(--accent)' : 'var(--text-muted)'};">
          ${alreadyIn ? 'Added' : '+ Add'}
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

    this.showToast(`Importing ${files.length} song(s)...`);

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
    this.showToast(`Imported ${importedCount} song(s).`);
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
    if (this.miniPlayText) {
      this.miniPlayText.textContent = isPlaying ? '❚❚' : '▶';
    }
    if (this.sheetPlayText) {
      this.sheetPlayText.textContent = isPlaying ? '❚❚' : '▶';
    }

    if (this.sheetArtwork) {
      if (isPlaying) {
        this.sheetArtwork.classList.remove('paused');
      } else {
        this.sheetArtwork.classList.add('paused');
      }
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

    this.sheetTrackTitle.textContent = track.title || 'Unknown Title';
    this.sheetTrackArtist.textContent = track.artist || 'Unknown Artist';

    // Default track icon is the app icon!
    const defaultAppIcon = 'icons/icon-512.png';
    const artSrc = track.artworkUrl || defaultAppIcon;
    this.sheetArtwork.src = artSrc;

    document.querySelectorAll('.track-item').forEach(item => item.classList.remove('playing'));
    const currentElem = Array.from(document.querySelectorAll('.track-item')).find(item => {
      const titleElem = item.querySelector('.track-title');
      return titleElem && titleElem.textContent === track.title;
    });
    if (currentElem) currentElem.classList.add('playing');
  }

  updateModeUI(shuffle, loop) {
    if (this.shuffleBtn) {
      this.shuffleBtn.classList.toggle('active', shuffle);
    }

    if (this.loopBtn) {
      this.loopBtn.classList.toggle('active', loop !== LoopMode.OFF);
      this.loopBtn.textContent = (loop === LoopMode.ONE) ? 'Loop 1' : 'Loop';
    }
  }

  openFullPlayer() {
    this.fullPlayerSheet.classList.add('open');
  }

  closeFullPlayer() {
    this.fullPlayerSheet.classList.remove('open');
  }

  updateHeaderCounts() {
    if (this.currentTab === 'songs') {
      const count = this.tracks.length;
      this.trackCountLabel.textContent = `${count} ${count === 1 ? 'song' : 'songs'}`;
    } else {
      if (this.activePlaylist) {
        const count = this.activePlaylist.trackIds.length;
        this.trackCountLabel.textContent = `${count} ${count === 1 ? 'song' : 'songs'}`;
      } else {
        const count = this.playlists.length;
        this.trackCountLabel.textContent = `${count} ${count === 1 ? 'playlist' : 'playlists'}`;
      }
    }
  }

  async updateStorageUsageDisplay() {
    const totalBytes = this.tracks.reduce((acc, t) => acc + (t.size || 0), 0);
    if (totalBytes > 0) {
      this.storageStatus.textContent = `${this.tracks.length} Songs (${this.formatFileSize(totalBytes)}) • Local Storage`;
    } else {
      this.storageStatus.textContent = `100% Offline • Local Storage`;
    }
  }

  showToast(msg) {
    this.toastMessage.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2200);
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
