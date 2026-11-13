/* Minimal reader for libretro-database .rdb files: "RARCHDB\0", an 8-byte metadata offset, then one
 * MessagePack map per ROM until a nil. Returns plain objects (binary fields such as crc come back as hex). */
export function readRdb(buf) {
  if (buf.toString("latin1", 0, 7) !== "RARCHDB") throw new Error("not an rdb file");
  let p = 16;
  const out = [];
  const str = (n) => { const s = buf.toString("utf8", p, p + n); p += n; return s; };
  const bin = (n) => { const s = buf.toString("hex", p, p + n); p += n; return s; };
  function val() {
    const b = buf[p++];
    if (b <= 0x7f) return b;
    if (b >= 0x80 && b <= 0x8f) return map(b & 0x0f);
    if (b >= 0x90 && b <= 0x9f) return arr(b & 0x0f);
    if (b >= 0xa0 && b <= 0xbf) return str(b & 0x1f);
    if (b >= 0xe0) return b - 256;
    switch (b) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: { const n = buf[p]; p += 1; return bin(n); }
      case 0xc5: { const n = buf.readUInt16BE(p); p += 2; return bin(n); }
      case 0xc6: { const n = buf.readUInt32BE(p); p += 4; return bin(n); }
      case 0xcc: return buf[p++];
      case 0xcd: { const v = buf.readUInt16BE(p); p += 2; return v; }
      case 0xce: { const v = buf.readUInt32BE(p); p += 4; return v; }
      case 0xcf: { const v = Number(buf.readBigUInt64BE(p)); p += 8; return v; }
      case 0xd0: { const v = buf.readInt8(p); p += 1; return v; }
      case 0xd1: { const v = buf.readInt16BE(p); p += 2; return v; }
      case 0xd2: { const v = buf.readInt32BE(p); p += 4; return v; }
      case 0xd3: { const v = Number(buf.readBigInt64BE(p)); p += 8; return v; }
      case 0xd9: { const n = buf[p]; p += 1; return str(n); }
      case 0xda: { const n = buf.readUInt16BE(p); p += 2; return str(n); }
      case 0xdb: { const n = buf.readUInt32BE(p); p += 4; return str(n); }
      case 0xdc: { const n = buf.readUInt16BE(p); p += 2; return arr(n); }
      case 0xdd: { const n = buf.readUInt32BE(p); p += 4; return arr(n); }
      case 0xde: { const n = buf.readUInt16BE(p); p += 2; return map(n); }
      case 0xdf: { const n = buf.readUInt32BE(p); p += 4; return map(n); }
      default: throw new Error("msgpack type 0x" + b.toString(16) + " at " + (p - 1));
    }
  }
  function map(n) { const o = {}; for (let i = 0; i < n; i++) { const k = val(); o[k] = val(); } return o; }
  function arr(n) { const a = []; for (let i = 0; i < n; i++) a.push(val()); return a; }
  while (p < buf.length) {
    if (buf[p] === 0xc0) break;
    const v = val();
    if (v && typeof v === "object") out.push(v);
  }
  return out;
}
