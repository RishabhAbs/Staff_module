// Pure-JS TOTP (RFC 6238) — no crypto.subtle, works on HTTP/localhost
// SHA-1 and HMAC implemented from scratch.

// ── Base32 ────────────────────────────────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let bits = 0, val = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i]; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input) {
  const str = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const bytes = []; let bits = 0, val = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = B32.indexOf(str[i]);
    if (idx === -1) continue;
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(bytes);
}

export function generateSecret() {
  const bytes = new Uint8Array(20);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 20; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return base32Encode(bytes);
}

// ── Pure-JS SHA-1 ─────────────────────────────────────────────────────────────
function sha1(msgBytes) {
  // Pre-processing: padding
  const len = msgBytes.length;
  const bitLen = len * 8;
  // Append 0x80, then zeros, then 64-bit big-endian length
  const padLen = ((len + 9) % 64 === 0) ? 64 : 64 - ((len + 9) % 64) + (len + 9 >= 64 ? 0 : 0);
  // simpler: total length must be ≡ 56 mod 64
  let totalLen = len + 1;
  while (totalLen % 64 !== 56) totalLen++;
  totalLen += 8; // for the 64-bit length field

  const msg = new Uint8Array(totalLen);
  msg.set(msgBytes);
  msg[len] = 0x80;
  // Write bit length as 64-bit big-endian (only lower 32 bits matter for our sizes)
  const dv = new DataView(msg.buffer);
  dv.setUint32(totalLen - 4, bitLen >>> 0, false);
  dv.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);

  // Initial hash values
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;

  const rot = (n, s) => ((n << s) | (n >>> (32 - s))) >>> 0;

  for (let i = 0; i < msg.length; i += 64) {
    const w = new Uint32Array(80);
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
    for (let j = 16; j < 80; j++) w[j] = rot(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);

    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      let f, k;
      if (j < 20)      { f = (b & c) | (~b & d);              k = 0x5A827999; }
      else if (j < 40) { f = b ^ c ^ d;                       k = 0x6ED9EBA1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d);    k = 0x8F1BBCDC; }
      else             { f = b ^ c ^ d;                       k = 0xCA62C1D6; }
      const temp = (rot(a, 5) + f + e + k + w[j]) >>> 0;
      e = d; d = c; c = rot(b, 30); b = a; a = temp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }

  const result = new Uint8Array(20);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, false); rv.setUint32(4, h1, false);
  rv.setUint32(8, h2, false); rv.setUint32(12, h3, false); rv.setUint32(16, h4, false);
  return result;
}

// ── Pure-JS HMAC-SHA1 ─────────────────────────────────────────────────────────
function hmacSha1(keyBytes, msgBytes) {
  let key = keyBytes;
  if (key.length > 64) key = sha1(key);
  const k = new Uint8Array(64);
  k.set(key);
  const ipad = new Uint8Array(64 + msgBytes.length);
  const opad = new Uint8Array(64 + 20);
  for (let i = 0; i < 64; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
  ipad.set(msgBytes, 64);
  const inner = sha1(ipad);
  opad.set(inner, 64);
  return sha1(opad);
}

// ── HOTP ──────────────────────────────────────────────────────────────────────
function hotp(secretBase32, counter) {
  const key = base32Decode(secretBase32);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const hash = hmacSha1(key, msg);
  const offset = hash[19] & 0x0f;
  const code = (
    ((hash[offset]     & 0x7f) * 0x1000000) +
    ((hash[offset + 1] & 0xff) * 0x10000)   +
    ((hash[offset + 2] & 0xff) * 0x100)     +
     (hash[offset + 3] & 0xff)
  ) % 1_000_000;
  return String(code).padStart(6, '0');
}

// ── TOTP ──────────────────────────────────────────────────────────────────────
const PERIOD = 30;

export function generateTOTP(secretBase32, time = Date.now()) {
  return hotp(secretBase32, Math.floor(time / 1000 / PERIOD));
}

// Verify with ±1 window (accepts one step drift)
export function verifyTOTP(secretBase32, inputCode, time = Date.now()) {
  const code = (inputCode || '').trim();
  const counter = Math.floor(time / 1000 / PERIOD);
  for (const delta of [-1, 0, 1]) {
    if (hotp(secretBase32, counter + delta) === code) return true;
  }
  return false;
}

// ── otpauth URI + QR URL ──────────────────────────────────────────────────────
export function buildOtpAuthUri(secret, accountName, issuer = 'ABS Technologies') {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function buildQrUrl(otpAuthUri, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(otpAuthUri)}&ecc=M`;
}
