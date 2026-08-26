// Must be imported (as a plain side-effect import, before pdfjs-dist) rather
// than inlined into extract-pdf-text.js - ES module imports are always
// hoisted above a module's own body, so setting globalThis.DOMMatrix in the
// same file as the pdfjs import would run too late for pdfjs's own
// "if (!globalThis.DOMMatrix)" check to see it. A separate module imported
// first guarantees this runs before pdfjs-dist's module body does.
//
// See extract-pdf-text.js for why this exists: pdfjs-dist's legacy Node
// build instantiates a module-level DOMMatrix at import time (for rendering/
// path code paths this project never calls - getTextContent() doesn't need
// it) and self-polyfills via the native @napi-rs/canvas package if present,
// otherwise throws immediately on any Node runtime without a global
// DOMMatrix already (Vercel's included). This pure-JS stand-in avoids
// depending on a native binary in a serverless function entirely.
if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      const m = Array.isArray(init) && init.length >= 6 ? init : [1, 0, 0, 1, 0, 0]
      ;[this.a, this.b, this.c, this.d, this.e, this.f] = m
    }
    multiplySelf(other) {
      const { a, b, c, d, e, f } = this
      this.a = a * other.a + c * other.b; this.b = b * other.a + d * other.b
      this.c = a * other.c + c * other.d; this.d = b * other.c + d * other.d
      this.e = a * other.e + c * other.f + e; this.f = b * other.e + d * other.f + f
      return this
    }
    preMultiplySelf(other) { const result = new globalThis.DOMMatrix([other.a, other.b, other.c, other.d, other.e, other.f]).multiplySelf(this); Object.assign(this, result); return this }
    translate(tx, ty) { return this.multiplySelf({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty }) }
    scale(sx, sy = sx) { return this.multiplySelf({ a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }) }
    invertSelf() {
      const { a, b, c, d, e, f } = this
      const det = a * d - b * c || 1
      this.a = d / det; this.b = -b / det; this.c = -c / det; this.d = a / det
      this.e = (c * f - d * e) / det; this.f = (b * e - a * f) / det
      return this
    }
    addPath() { return this }
  }
}
