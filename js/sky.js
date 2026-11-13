/* The sphere.
   Stars sit on a globe ordered by importance: index 0 faces you dead centre,
   the rest wrap backwards. Drag to turn it, pinch to zoom, tap a star to open
   it, tap empty space for the read-out. Canvas 2D, no dependencies. */

const CAM = 2.75;            // camera distance, in sphere radii
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 2.1;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Index 0 sits exactly on the pole facing you; the rest spiral to the back.
    A plain Fibonacci sphere puts point 0 well off the pole, which left the
    day's focus hanging off-centre instead of anchoring the view. */
export function spherePoints(n) {
  const out = [{ x: 0, y: 0, z: 1 }];
  const FIRST = 0.66;                       // radians off the pole for point 1
  for (let i = 1; i < n; i++) {
    const t = n <= 2 ? 0 : (i - 1) / (n - 2);
    const phi = FIRST + t * (Math.PI - FIRST - 0.18);
    const th = i * GOLDEN;
    const r = Math.sin(phi);
    out.push({ x: r * Math.cos(th), y: r * Math.sin(th), z: Math.cos(phi) });
  }
  return out.slice(0, n);
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/* Mood colours: the region of space you're flying through. Never saturated —
   each is already most of the way to black. */
const MOOD_BAD = [86, 30, 34];
const MOOD_MID = [52, 44, 60];
const MOOD_GOOD = [26, 56, 88];

export function moodColor(m) {
  const t = clamp(m, 0, 1);
  return t < 0.5 ? mix(MOOD_BAD, MOOD_MID, t * 2) : mix(MOOD_MID, MOOD_GOOD, (t - 0.5) * 2);
}

export class Sky {
  constructor(canvas, { onStar, onSpace } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStar = onStar;
    this.onSpace = onSpace;

    this.stars = [];
    this.mood = 0.5;
    this.yaw = 0;
    this.pitch = 0;
    this.zoom = 1;
    this.vYaw = 0;
    this.vPitch = 0;
    this.t0 = performance.now();

    // Surface grain: the globe needs a skin, or the dozen real stars read as
    // a loose scatter instead of points on a sphere.
    this.grain = Array.from({ length: 190 }, () => {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      return { x: r * Math.cos(th), y: r * Math.sin(th), z: u,
               s: 0.4 + Math.random() * 0.9, a: 0.18 + Math.random() * 0.4 };
    });

    this.dust = Array.from({ length: 130 }, () => {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const d = 3.2 + Math.random() * 3.4;
      return { x: r * Math.cos(th) * d, y: r * Math.sin(th) * d, z: u * d,
               s: 0.35 + Math.random() * 0.75, a: 0.12 + Math.random() * 0.3 };
    });

    this._pointers = new Map();
    this._bindInput();
    this._resize();
    addEventListener('resize', () => this._resize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  setStars(stars) {
    this.stars = stars;
    this.links = [];
    // Join each star to its two nearest neighbours. Gives the globe a wire
    // without drawing a grid over it.
    const seen = new Set();
    stars.forEach((a, i) => {
      const near = stars.map((b, j) => ({ j, d: dist2(a.pos, b.pos) }))
        .filter((x) => x.j !== i).sort((x, y) => x.d - y.d).slice(0, 2);
      for (const n of near) {
        const key = i < n.j ? `${i}-${n.j}` : `${n.j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        this.links.push([i, n.j]);
      }
    });
  }
  setMood(m) { this.mood = clamp(m, 0, 1); }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2.5);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
  }

  /* ---------- geometry ---------- */

  _rot(p) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const x1 = p.x * cy + p.z * sy;
    const z1 = -p.x * sy + p.z * cy;
    const y2 = p.y * cp - z1 * sp;
    const z2 = p.y * sp + z1 * cp;
    return { x: x1, y: y2, z: z2 };
  }

  _project(p, R) {
    const r = this._rot(p);
    const s = CAM / (CAM - r.z);
    return {
      sx: this.w / 2 + r.x * R * s,
      sy: this.h / 2 + r.y * R * s,
      scale: s,
      t: (r.z + 1) / 2,          // 0 = far side, 1 = facing you
      z: r.z
    };
  }

  get radius() { return Math.min(this.w, this.h) * 0.355 * this.zoom; }

  /* ---------- input ---------- */

  _bindInput() {
    const cv = this.cv;
    cv.style.touchAction = 'none';

    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      this.vYaw = this.vPitch = 0;
      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        this._pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        this._zoom0 = this.zoom;
      }
    });

    cv.addEventListener('pointermove', (e) => {
      const prev = this._pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._down) this._down.moved += Math.abs(dx) + Math.abs(dy);

      if (this._pointers.size >= 2) {
        const [a, b] = [...this._pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        // dampened: a raw ratio made the globe leap between extremes
        if (this._pinch0 > 0) {
          const ratio = 1 + (d / this._pinch0 - 1) * 0.55;
          this.zoom = clamp(this._zoom0 * ratio, MIN_ZOOM, MAX_ZOOM);
        }
        return;
      }
      // Dragging down used to tilt the globe up — the axis was inverted.
      const k = 0.0026 / Math.max(0.85, this.zoom * 0.7);
      this.yaw += dx * k;
      this.pitch = clamp(this.pitch - dy * k, -1.05, 1.05);
      this.vYaw = dx * k * 0.5;
      this.vPitch = -dy * k * 0.5;
    });

    const end = (e) => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) this._pinch0 = 0;
      const d = this._down;
      this._down = null;
      if (!d || d.moved > 10 || performance.now() - d.t > 500) return;
      const hit = this.hitTest(d.x - this.cv.getBoundingClientRect().left,
                              d.y - this.cv.getBoundingClientRect().top);
      if (hit) { this.vYaw = this.vPitch = 0; this.onStar?.(hit); }
      else this.onSpace?.();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', (e) => { this._pointers.delete(e.pointerId); this._down = null; });

    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = clamp(this.zoom * (1 - e.deltaY * 0.0006), MIN_ZOOM, MAX_ZOOM);
    }, { passive: false });
  }

  hitTest(px, py) {
    const R = this.radius;
    const cand = this.stars.map((s, i) => ({ s, p: this._project(s.pos, R), i }))
      .sort((a, b) => b.p.z - a.p.z);          // front-most first
    for (const c of cand) {
      if (c.p.t < 0.18) continue;
      const r = Math.max(22, c.s.size * c.p.scale * 2.4);
      if (Math.hypot(px - c.p.sx, py - c.p.sy) <= r) return c.s;
    }
    return null;
  }

  /** Turn the globe so a given star faces front. */
  focusStar(id, ms = 650) {
    const s = this.stars.find((x) => x.id === id);
    if (!s) return;
    // Solve for the rotation that puts this point at (0,0,1): yaw cancels x,
    // then pitch cancels y against the remaining xz-radius.
    const { x, y, z } = s.pos;
    const targetYaw = Math.atan2(-x, z);
    const targetPitch = clamp(Math.atan2(y, Math.hypot(x, z)), -1.05, 1.05);
    this.vYaw = this.vPitch = 0;
    if (!(ms > 0)) {                       // snap; 0/0 would poison yaw with NaN
      this.yaw = targetYaw;
      this.pitch = targetPitch;
      return;
    }
    const y0 = this.yaw, p0 = this.pitch, t0 = performance.now();
    const dy = ((targetYaw - y0 + Math.PI) % (Math.PI * 2)) - Math.PI;
    const anim = () => {
      const k = clamp((performance.now() - t0) / ms, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      this.yaw = y0 + dy * e;
      this.pitch = lerp(p0, targetPitch, e);
      if (k < 1) requestAnimationFrame(anim);
    };
    anim();
  }

  /* ---------- paint ---------- */

  _loop(now) {
    const dt = Math.min(48, now - (this._last || now));
    this._last = now;

    if (!this._pointers.size) {
      this.yaw += this.vYaw;
      this.pitch = clamp(this.pitch + this.vPitch, -1.05, 1.05);
      this.vYaw *= 0.94;
      this.vPitch *= 0.94;
      if (Math.abs(this.vYaw) < 1e-5) this.vYaw = 0;
      if (Math.abs(this.vPitch) < 1e-5) this.vPitch = 0;
      this.yaw += 0.000035 * dt;          // a slow, barely-there drift
    }

    this._paint(now);
    requestAnimationFrame(this._loop);
  }

  _paint(now) {
    const { ctx, w, h } = this;
    const R = this.radius;
    const mc = moodColor(this.mood);

    ctx.fillStyle = '#04050A';
    ctx.fillRect(0, 0, w, h);

    // the coloured region of space — wide, soft, mostly black
    let g = ctx.createRadialGradient(w * 0.5, h * 0.46, 0, w * 0.5, h * 0.46, Math.max(w, h) * 0.92);
    g.addColorStop(0, rgba(mc, 0.62));
    g.addColorStop(0.42, rgba(mc, 0.26));
    g.addColorStop(1, 'rgba(4,5,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    g = ctx.createRadialGradient(w * 0.78, h * 0.12, 0, w * 0.78, h * 0.12, Math.max(w, h) * 0.5);
    g.addColorStop(0, rgba(mix(mc, [255, 255, 255], 0.12), 0.13));
    g.addColorStop(1, 'rgba(4,5,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // distant dust
    for (const d of this.dust) {
      const r = this._rot(d);
      if (r.z > CAM * 0.9) continue;
      const s = CAM / (CAM - r.z * 0.25);
      const sx = w / 2 + r.x * R * 0.34 * s;
      const sy = h / 2 + r.y * R * 0.34 * s;
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
      ctx.fillStyle = `rgba(190,205,230,${d.a * 0.5})`;
      ctx.beginPath();
      ctx.arc(sx, sy, d.s, 0, 7);
      ctx.fill();
    }

    // faint volume behind the globe so it reads as a sphere, not a scatter
    g = ctx.createRadialGradient(w / 2, h / 2, R * 0.1, w / 2, h / 2, R * 1.25);
    g.addColorStop(0, rgba(mix(mc, [255, 255, 255], 0.16), 0.2));
    g.addColorStop(0.68, rgba(mc, 0.1));
    g.addColorStop(1, 'rgba(4,5,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, R * 1.25, 0, 7);
    ctx.fill();

    // the globe's surface
    for (const g2 of this.grain) {
      const p = this._project(g2, R);
      if (p.t < 0.04) continue;
      const vis = Math.pow(p.t, 1.5) * g2.a;
      ctx.fillStyle = `rgba(198,214,238,${vis})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, g2.s * p.scale * (0.5 + 0.5 * p.t), 0, 7);
      ctx.fill();
    }

    // silhouette: a whisper of a rim so the sphere has an edge
    ctx.strokeStyle = rgba(mix(mc, [255, 255, 255], 0.35), 0.055);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, R, 0, 7);
    ctx.stroke();

    const proj = this.stars.map((s) => ({ s, p: this._project(s.pos, R) }));

    // constellation lines — faint, and only where both ends face you
    for (const [i, j] of this.links || []) {
      const a = proj[i], b2 = proj[j];
      if (!a || !b2) continue;
      const t = Math.min(a.p.t, b2.p.t);
      if (t < 0.3) continue;
      ctx.strokeStyle = `rgba(186,204,232,${0.1 * Math.pow((t - 0.3) / 0.7, 1.2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.p.sx, a.p.sy);
      ctx.lineTo(b2.p.sx, b2.p.sy);
      ctx.stroke();
    }

    const drawn = [...proj].sort((a, b) => a.p.z - b.p.z);

    for (const { s, p } of drawn) this._star(s, p, now);
    this._labels(drawn);
  }

  _star(s, p, now) {
    const { ctx } = this;
    const t = p.t;
    if (t < 0.02) return;
    // Stronger falloff than before: what's in front should clearly win.
    const vis = s.primary ? Math.pow(t, 0.5) : Math.pow(t, 1.5);
    const size = s.size * p.scale * (0.55 + 0.45 * t);
    const col = s.color;
    const done = s.done === true;
    const pending = s.done === false;

    const breathe = s.primary ? 1 + Math.sin(now / 1400) * 0.045 : 1;
    const rad = size * breathe;

    // glow
    const reach = rad * (s.primary ? 6.5 : done ? 5.5 : 4.2);
    const gl = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, reach);
    gl.addColorStop(0, rgba(col, (s.primary ? 0.6 : 0.42) * vis));
    gl.addColorStop(0.4, rgba(col, (s.primary ? 0.18 : 0.12) * vis));
    gl.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, reach, 0, 7);
    ctx.fill();

    // core
    const core = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rad);
    const white = mix(col, [255, 255, 255], s.primary ? 0.9 : done ? 0.8 : 0.5);
    core.addColorStop(0, rgba(white, (s.primary ? 1 : done ? 0.98 : 0.8) * vis));
    core.addColorStop(s.primary ? 0.42 : 0.55, rgba(col, (s.primary ? 1 : 0.8) * vis));
    core.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, rad, 0, 7);
    ctx.fill();

    // spikes mark something due or overdue inside this star
    if (s.urgent && t > 0.22) {
      const n = 8;
      const inner = rad * 1.9;
      const outer = rad * (3.5 + Math.sin(now / 520) * 0.3);
      ctx.strokeStyle = rgba(mix(col, [255, 255, 255], 0.3), 0.6 * vis);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a2 = (i / n) * Math.PI * 2 + now / 7000;
        ctx.moveTo(p.sx + Math.cos(a2) * inner, p.sy + Math.sin(a2) * inner);
        ctx.lineTo(p.sx + Math.cos(a2) * outer, p.sy + Math.sin(a2) * outer);
      }
      ctx.stroke();
    }

    // a thin ring marks something still open
    if (pending && !s.urgent && t > 0.3) {
      ctx.strokeStyle = rgba(col, 0.3 * vis);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rad * 2.6, 0, 7);
      ctx.stroke();
    }
  }

  _labels(drawn) {
    const { ctx, w } = this;
    const placed = [];
    const order = [...drawn].sort((a, b) => (a.s.rank ?? 99) - (b.s.rank ?? 99));

    ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    for (const { s, p } of order) {
      if (p.t < 0.42 || !s.label) continue;
      const a = Math.min(1, (p.t - 0.42) / 0.26);

      if (s.primary) {
        const drop = Math.max(26, s.size * p.scale * 3.1);
        ctx.strokeStyle = `rgba(190,205,230,${0.16 * a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy + drop - 11);
        ctx.lineTo(p.sx, p.sy + drop + 1);
        ctx.stroke();
        ctx.font = `400 ${s.label.length > 26 ? 14.5 : 16}px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        // Keep the label on screen when the globe is turned and the focus star
        // sits near an edge — it used to run off the side.
        const tw = ctx.measureText(s.label).width;
        const lx = clamp(p.sx, tw / 2 + 14, w - tw / 2 - 14);
        ctx.fillStyle = `rgba(234,240,250,${0.95 * a})`;
        ctx.fillText(s.label, lx, p.sy + drop + 15);
        ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
        placed.push({ x: lx - tw / 2 - 8, y: p.sy + drop + 4, w: tw + 16, h: 24 });
        continue;
      }
      const right = p.sx <= w / 2;
      const gap = Math.max(16, s.size * p.scale * 2.1);
      const lead = 17;
      const x0 = p.sx + (right ? gap : -gap);
      const x1 = x0 + (right ? lead : -lead);
      const tw = ctx.measureText(s.label).width;
      const tx = right ? x1 + 6 : x1 - 6 - tw;
      const rect = { x: tx - 4, y: p.sy - 9, w: tw + 8, h: 18 };
      if (rect.x < 6 || rect.x + rect.w > w - 6) continue;
      if (placed.some((q) => !(rect.x + rect.w < q.x || rect.x > q.x + q.w ||
                               rect.y + rect.h < q.y || rect.y > q.y + q.h))) continue;
      placed.push(rect);

      ctx.strokeStyle = `rgba(190,205,230,${0.2 * a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, p.sy);
      ctx.lineTo(x1, p.sy);
      ctx.stroke();

      ctx.fillStyle = s.done === true
        ? `rgba(206,218,236,${0.62 * a})`
        : `rgba(226,234,246,${0.9 * a})`;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(s.label, right ? x1 + 6 : x1 - 6, p.sy);
    }
  }
}
