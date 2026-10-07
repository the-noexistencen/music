/**
 * Client-side ID3 Tag Parser (Supports ID3v2.3, ID3v2.4, and ID3v1 fallback)
 * Extracts Title, Artist, Album, and embedded APIC Album Art without external dependencies.
 */

export class ID3Parser {
  /**
   * Parse an audio file (File or Blob) and extract metadata.
   * @param {File|Blob} file 
   * @returns {Promise<{title: string, artist: string, album: string, artworkUrl: string|null, artworkBlob: Blob|null}>}
   */
  static async parse(file) {
    const defaultMeta = this.fallbackFromFilename(file.name || 'Unknown Track');

    try {
      // First try ID3v2 from the beginning of the file (first 512KB is usually enough for tags and artwork)
      const headerSlice = file.slice(0, Math.min(file.size, 1024 * 512));
      const buffer = await headerSlice.arrayBuffer();
      const v2Meta = this.parseID3v2(buffer);

      if (v2Meta && (v2Meta.title || v2Meta.artist || v2Meta.artworkBlob)) {
        return {
          title: v2Meta.title || defaultMeta.title,
          artist: v2Meta.artist || defaultMeta.artist,
          album: v2Meta.album || 'Unknown Album',
          artworkUrl: v2Meta.artworkBlob ? URL.createObjectURL(v2Meta.artworkBlob) : null,
          artworkBlob: v2Meta.artworkBlob || null
        };
      }

      // If ID3v2 had no title/artist, check ID3v1 at end of file (last 128 bytes)
      if (file.size > 128) {
        const v1Slice = file.slice(file.size - 128);
        const v1Buffer = await v1Slice.arrayBuffer();
        const v1Meta = this.parseID3v1(v1Buffer);
        if (v1Meta) {
          return {
            title: v1Meta.title || defaultMeta.title,
            artist: v1Meta.artist || defaultMeta.artist,
            album: v1Meta.album || 'Unknown Album',
            artworkUrl: null,
            artworkBlob: null
          };
        }
      }
    } catch (err) {
      console.warn('ID3 parsing encountered an error, falling back to filename:', err);
    }

    return {
      title: defaultMeta.title,
      artist: defaultMeta.artist,
      album: 'Unknown Album',
      artworkUrl: null,
      artworkBlob: null
    };
  }

  static parseID3v2(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 10) return null;

    // Check "ID3" identifier
    if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
      return null;
    }

    const majorVersion = view.getUint8(3); // 3 for ID3v2.3, 4 for ID3v2.4
    if (majorVersion !== 3 && majorVersion !== 4 && majorVersion !== 2) {
      return null;
    }

    // Tag size is stored as 4 synchsafe integers (7 bits per byte)
    const tagSize = ((view.getUint8(6) & 0x7f) << 21) |
                    ((view.getUint8(7) & 0x7f) << 14) |
                    ((view.getUint8(8) & 0x7f) << 7) |
                    (view.getUint8(9) & 0x7f);

    const limit = Math.min(buffer.byteLength, tagSize + 10);
    let offset = 10;
    const result = { title: '', artist: '', album: '', artworkBlob: null };

    while (offset + 10 < limit) {
      // Check for padding (zeros)
      if (view.getUint8(offset) === 0) break;

      let frameId = '';
      for (let i = 0; i < 4; i++) {
        frameId += String.fromCharCode(view.getUint8(offset + i));
      }

      let frameSize = 0;
      if (majorVersion === 4) {
        // ID3v2.4 uses synchsafe integers for frame size
        frameSize = ((view.getUint8(offset + 4) & 0x7f) << 21) |
                    ((view.getUint8(offset + 5) & 0x7f) << 14) |
                    ((view.getUint8(offset + 6) & 0x7f) << 7) |
                    (view.getUint8(offset + 7) & 0x7f);
      } else {
        // ID3v2.3 uses regular 32-bit big-endian
        frameSize = view.getUint32(offset + 4, false);
      }

      if (frameSize <= 0 || offset + 10 + frameSize > buffer.byteLength) {
        break;
      }

      const frameDataOffset = offset + 10;

      if (frameId === 'TIT2') {
        result.title = this.decodeTextFrame(buffer, frameDataOffset, frameSize);
      } else if (frameId === 'TPE1') {
        result.artist = this.decodeTextFrame(buffer, frameDataOffset, frameSize);
      } else if (frameId === 'TALB') {
        result.album = this.decodeTextFrame(buffer, frameDataOffset, frameSize);
      } else if (frameId === 'APIC') {
        result.artworkBlob = this.decodeApicFrame(buffer, frameDataOffset, frameSize);
      }

      offset += 10 + frameSize;
    }

    return result;
  }

  static decodeTextFrame(buffer, offset, size) {
    if (size <= 1) return '';
    const view = new DataView(buffer, offset, size);
    const encoding = view.getUint8(0);
    const bytes = new Uint8Array(buffer, offset + 1, size - 1);

    return this.decodeStringWithEncoding(bytes, encoding).trim();
  }

  static decodeApicFrame(buffer, offset, size) {
    try {
      const view = new DataView(buffer, offset, size);
      const encoding = view.getUint8(0);
      let pos = 1;

      // Read MIME type (null terminated ISO-8859-1)
      let mimeType = '';
      while (pos < size && view.getUint8(pos) !== 0) {
        mimeType += String.fromCharCode(view.getUint8(pos));
        pos++;
      }
      pos++; // Skip null terminator
      if (!mimeType) mimeType = 'image/jpeg';

      // Picture type (1 byte)
      pos++;

      // Skip description (null terminated according to encoding)
      if (encoding === 0 || encoding === 3) {
        // Single byte null
        while (pos < size && view.getUint8(pos) !== 0) pos++;
        pos++;
      } else {
        // UTF-16 double byte null
        while (pos + 1 < size && !(view.getUint8(pos) === 0 && view.getUint8(pos + 1) === 0)) pos += 2;
        pos += 2;
      }

      if (pos >= size) return null;

      const imgBytes = new Uint8Array(buffer, offset + pos, size - pos);
      return new Blob([imgBytes], { type: mimeType });
    } catch {
      return null;
    }
  }

  static decodeStringWithEncoding(bytes, encoding) {
    try {
      if (encoding === 0) { // ISO-8859-1
        let str = '';
        for (let i = 0; i < bytes.length; i++) {
          if (bytes[i] === 0) break;
          str += String.fromCharCode(bytes[i]);
        }
        return str;
      } else if (encoding === 1 || encoding === 2) { // UTF-16 with BOM or without
        const decoder = new TextDecoder('utf-16');
        return decoder.decode(bytes).replace(/\0/g, '');
      } else if (encoding === 3) { // UTF-8
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes).replace(/\0/g, '');
      }
    } catch {
      // fallback
    }
    return '';
  }

  static parseID3v1(buffer) {
    if (buffer.byteLength < 128) return null;
    const bytes = new Uint8Array(buffer);
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
    if (header !== 'TAG') return null;

    const readString = (start, length) => {
      let str = '';
      for (let i = start; i < start + length; i++) {
        if (bytes[i] === 0) break;
        str += String.fromCharCode(bytes[i]);
      }
      return str.trim();
    };

    return {
      title: readString(3, 30),
      artist: readString(33, 30),
      album: readString(63, 30)
    };
  }

  static fallbackFromFilename(filename) {
    const clean = filename.replace(/\.(mp3|m4a|wav|aac|ogg|flac)$/i, '');
    const parts = clean.split(' - ');
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim()
      };
    }
    return {
      artist: 'Unknown Artist',
      title: clean.trim()
    };
  }
}
