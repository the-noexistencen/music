/**
 * Audio Player Engine with iOS Background Playback & MediaSession API support.
 * Manages playback, playlist queue, shuffle, loop, and lock screen controls.
 */

export const LoopMode = {
  OFF: 'off',
  ALL: 'all',
  ONE: 'one'
};

export class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    // Original list of tracks
    this.playlist = [];
    // Active playback queue (different from playlist when shuffled)
    this.queue = [];
    this.currentIndex = -1;
    this.currentTrack = null;

    // Modes
    this.isShuffle = false;
    this.loopMode = LoopMode.OFF;

    // Cached Object URLs to prevent leaks
    this.activeAudioUrl = null;

    // Callbacks for UI updates
    this.listeners = {
      trackChange: [],
      playStateChange: [],
      timeUpdate: [],
      queueChange: [],
      modeChange: []
    };

    this.setupAudioListeners();
    this.setupMediaSession();
  }

  setupAudioListeners() {
    this.audio.addEventListener('play', () => {
      this.emit('playStateChange', true);
      this.updateMediaSessionPlaybackState('playing');
    });

    this.audio.addEventListener('pause', () => {
      this.emit('playStateChange', false);
      this.updateMediaSessionPlaybackState('paused');
    });

    this.audio.addEventListener('timeupdate', () => {
      this.emit('timeUpdate', {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration || 0
      });
      this.updateMediaSessionPosition();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.updateMediaSessionPosition();
      this.updateMediaSessionMetadata();
    });

    this.audio.addEventListener('durationchange', () => {
      this.updateMediaSessionPosition();
    });

    this.audio.addEventListener('ended', () => {
      this.handleTrackEnded();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e, this.audio.error);
    });
  }

  setupMediaSession() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession) return;

    const setAction = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {
        console.warn(`MediaSession action "${action}" not supported:`, e);
      }
    };

    setAction('play', () => this.play());
    setAction('pause', () => this.pause());
    setAction('previoustrack', () => this.previous());
    setAction('nexttrack', () => this.next());
    setAction('seekto', (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        this.seek(details.seekTime);
      }
    });

    // IMPORTANT FOR IOS: Setting seekbackward/seekforward makes iOS display 10s skip buttons.
    // Setting them to null forces iOS to display Next Track and Previous Track buttons instead!
    setAction('seekbackward', null);
    setAction('seekforward', null);
  }

  updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession || !this.currentTrack) return;

    // Use full absolute URL with fresh app-cover path to bypass stale iOS Lock Screen / Dynamic Island image cache
    const defaultAppIcon512 = new URL('icons/app-cover-512.png?v=11', window.location.href).href;
    const defaultAppIcon192 = new URL('icons/app-cover-192.png?v=11', window.location.href).href;
    const artSrc = this.currentTrack.artworkUrl || defaultAppIcon512;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.currentTrack.title || 'Unknown Title',
      artist: this.currentTrack.artist || 'Unknown Artist',
      album: this.currentTrack.album || 'Unknown Album',
      artwork: [
        { src: artSrc, sizes: '512x512', type: 'image/png' },
        { src: defaultAppIcon192, sizes: '192x192', type: 'image/png' },
        { src: defaultAppIcon512, sizes: '512x512', type: 'image/png' }
      ]
    });
  }

  updateMediaSessionPlaybackState(state) {
    if ('mediaSession' in navigator && navigator.mediaSession) {
      navigator.mediaSession.playbackState = state;
    }
  }

  updateMediaSessionPosition() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession || !this.audio.duration || isNaN(this.audio.duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: this.audio.duration,
        playbackRate: this.audio.playbackRate || 1.0,
        position: Math.max(0, Math.min(this.audio.currentTime, this.audio.duration))
      });
    } catch {
      // Ignore if duration not yet ready
    }
  }

  setPlaylist(tracks, startIndex = 0, autoPlay = true) {
    this.playlist = [...tracks];
    if (this.isShuffle) {
      this.rebuildShuffleQueue(startIndex);
    } else {
      this.queue = [...this.playlist];
      this.currentIndex = startIndex >= 0 && startIndex < this.queue.length ? startIndex : 0;
    }

    this.emit('queueChange', { queue: this.queue, currentIndex: this.currentIndex });

    if (this.queue.length > 0) {
      this.loadTrack(this.currentIndex, autoPlay);
    } else {
      this.stop();
    }
  }

  async loadTrack(index, playImmediately = true) {
    if (index < 0 || index >= this.queue.length) return;

    this.currentIndex = index;
    const track = this.queue[this.currentIndex];
    this.currentTrack = track;

    // Release old object URL if needed
    if (this.activeAudioUrl) {
      URL.revokeObjectURL(this.activeAudioUrl);
      this.activeAudioUrl = null;
    }

    // Convert audio Blob to Object URL
    if (track.audioBlob) {
      this.activeAudioUrl = URL.createObjectURL(track.audioBlob);
      this.audio.src = this.activeAudioUrl;
    } else if (track.url) {
      this.audio.src = track.url;
    }

    this.audio.loop = (this.loopMode === LoopMode.ONE);
    this.setupMediaSession();
    this.updateMediaSessionMetadata();
    this.emit('trackChange', track);

    if (playImmediately) {
      try {
        await this.audio.play();
      } catch (err) {
        console.warn('Playback initiation was blocked or failed:', err);
      }
    }
  }

  async play() {
    if (!this.currentTrack && this.queue.length > 0) {
      await this.loadTrack(0, true);
      return;
    }
    if (this.audio.src) {
      try {
        await this.audio.play();
      } catch (err) {
        console.warn('Play error:', err);
      }
    }
  }

  pause() {
    this.audio.pause();
  }

  togglePlay() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  next() {
    if (this.queue.length === 0) return;

    if (this.loopMode === LoopMode.ONE) {
      this.seek(0);
      this.play();
      return;
    }

    let nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.queue.length) {
      if (this.loopMode === LoopMode.ALL) {
        nextIndex = 0;
      } else {
        // End of queue reached, do not wrap
        this.pause();
        this.seek(0);
        return;
      }
    }

    this.loadTrack(nextIndex, true);
  }

  previous() {
    if (this.queue.length === 0) return;

    // Spotify behavior: If more than 2.5 seconds in, restart to beginning of current track
    if (this.audio.currentTime > 2.5) {
      this.seek(0);
      this.play();
      return;
    }

    let prevIndex = this.currentIndex - 1;
    if (prevIndex < 0) {
      if (this.loopMode === LoopMode.ALL) {
        prevIndex = this.queue.length - 1;
      } else {
        prevIndex = 0;
      }
    }

    this.loadTrack(prevIndex, true);
  }

  seek(seconds) {
    if (isNaN(seconds) || seconds < 0) return;
    const target = Math.min(seconds, this.audio.duration || seconds);
    this.audio.currentTime = target;
    this.updateMediaSessionPosition();
  }

  seekPercent(percent) {
    if (!this.audio.duration) return;
    const time = (Math.max(0, Math.min(100, percent)) / 100) * this.audio.duration;
    this.seek(time);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    const currentTrackId = this.currentTrack ? this.currentTrack.id : null;

    if (this.isShuffle) {
      this.rebuildShuffleQueue();
    } else {
      // Revert queue back to original playlist order
      this.queue = [...this.playlist];
      if (currentTrackId) {
        this.currentIndex = this.queue.findIndex(t => t.id === currentTrackId);
      }
    }

    this.emit('modeChange', { shuffle: this.isShuffle, loop: this.loopMode });
    this.emit('queueChange', { queue: this.queue, currentIndex: this.currentIndex });
  }

  cycleLoop() {
    if (this.loopMode === LoopMode.OFF) {
      this.loopMode = LoopMode.ALL;
    } else if (this.loopMode === LoopMode.ALL) {
      this.loopMode = LoopMode.ONE;
    } else {
      this.loopMode = LoopMode.OFF;
    }

    this.audio.loop = (this.loopMode === LoopMode.ONE);
    this.emit('modeChange', { shuffle: this.isShuffle, loop: this.loopMode });
  }

  rebuildShuffleQueue(preferredStartIndex = -1) {
    if (this.playlist.length === 0) {
      this.queue = [];
      this.currentIndex = -1;
      return;
    }

    let startTrack = null;
    if (preferredStartIndex >= 0 && preferredStartIndex < this.playlist.length) {
      startTrack = this.playlist[preferredStartIndex];
    } else if (this.currentTrack) {
      startTrack = this.currentTrack;
    }

    // Clone playlist without startTrack
    const remaining = this.playlist.filter(t => !startTrack || t.id !== startTrack.id);

    // Fisher-Yates shuffle
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    if (startTrack) {
      this.queue = [startTrack, ...remaining];
      this.currentIndex = 0;
    } else {
      this.queue = remaining;
      this.currentIndex = 0;
    }
  }

  handleTrackEnded() {
    if (this.loopMode === LoopMode.ONE) {
      this.seek(0);
      this.play();
    } else {
      this.next();
    }
  }

  stop() {
    this.pause();
    this.audio.src = '';
    this.currentIndex = -1;
    this.currentTrack = null;
    this.emit('trackChange', null);
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
}
