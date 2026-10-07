# Offline iPhone MP3 Player (Ad-Free PWA)

A private, ad-free music player built specifically for iOS. It runs 100% locally on your iPhone as a standalone Progressive Web App (PWA) with no App Store download or Apple Developer account required.

---

## ✨ Features

- **🚫 100% Ad-Free & Tracker-Free**: Pure client-side code with zero third-party telemetry, ads, or subscriptions.
- **📱 Native Standalone iOS Feel**: Launches full-screen from your iPhone Home Screen without Safari address bars or browser UI.
- **💾 Local Storage (IndexedDB)**: Audio files and album artwork are saved directly into your iPhone's persistent local database.
- **🔒 Lock Screen & Background Playback**: Integrates with iOS **Media Session API** to provide Lock Screen album art, play/pause/skip buttons, and Control Center scrubber.
- **🔀 Playback Modes**: True Fisher-Yates **Shuffle**, **Loop All**, **Loop One**, and Play All.
- **🎨 Apple Music Aesthetic**: Deep obsidian theme with frosted glass navigation, album art blur, and smooth spring animations.
- **🏷️ Client-Side ID3 Tag Reader**: Automatically extracts song title, artist, album, and embedded album cover artwork from your MP3 files.
- **✈️ Works Completely Offline**: Cached with a Service Worker so it opens and plays even in Airplane Mode.

---

## 🚀 How to Install on Your iPhone

Because iOS requires HTTPS for Service Workers and Home Screen PWA installation, you can host this static project for free in 60 seconds on any HTTPS host (e.g. **GitHub Pages**, **Cloudflare Pages**, or **Vercel**).

### Option A: GitHub Pages (Recommended - 60 seconds)
1. Push this folder to a GitHub repository:
   ```bash
   git add .
   git commit -m "Initial commit of Offline MP3 Player"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In your GitHub repo, go to **Settings > Pages**.
3. Under **Build and deployment**, select **Deploy from a branch** -> `main` / `root` -> **Save**.
4. GitHub will give you an HTTPS URL (e.g., `https://<your-username>.github.io/<your-repo-name>/`).

### Option B: Cloudflare Pages / Vercel
- Drag and drop this folder directly into the Cloudflare Pages or Vercel dashboard for an instant HTTPS URL.

### Option C: Run Locally on Your Mac
To test immediately on your Mac:
```bash
python3 -m http.server 8080
```
Then visit `http://localhost:8080` in Safari or Chrome.

---

## 📲 Adding to Your iPhone Home Screen

1. Open your hosted HTTPS URL in **Safari** on your iPhone.
2. Tap the **Share button** (the square with an arrow pointing up at the bottom of Safari).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top right corner.
5. An icon titled **"Music"** will appear on your Home Screen.
6. Tap it to launch the app in **full-screen standalone mode** (completely independent of Safari).

---

## 🎧 How to Use

1. **Add MP3s**: Tap the **"Add MP3s"** button at the top. The native iOS file picker will open:
   - Select files from **On My iPhone**, **iCloud Drive**, or your **Downloads** folder.
   - You can select multiple files at once.
2. **Play & Shuffle**:
   - Tap any song in your library to start playing.
   - Tap **"Shuffle All"** or toggle the Shuffle button in the Now Playing sheet to randomize the queue.
   - Tap the Loop button to cycle between **Off**, **Loop All**, and **Loop One** (with a "1" badge).
3. **Lock Screen Controls**:
   - Lock your iPhone or swipe up to go to your Home Screen.
   - Audio continues seamlessly, and the iOS Lock Screen will display album art, track details, and playback controls.
