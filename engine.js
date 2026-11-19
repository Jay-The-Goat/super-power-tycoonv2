export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.labels = [];
    this.cam = { x: 0, y: 12, z: 0, yaw: 0, pitch: 0.35, fov: 520 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.w = this.canvas.width;
    this.h = this.canvas.height;
    this.cam.fov = Math.min(this.w, this.h) * 0.85;
  }

  addBox(w, h, d, color, x, y, z, alpha = 1) {
    const obj = { w, h, d, color, x, y, z, alpha, rx: 0, ry: 0, visible: true };
    this.parts.push(obj);
    return obj;
  }

  removeBox(obj) {
    const idx = this.parts.indexOf(obj);
    if (idx !== -1) this.parts.splice(idx, 1);
  }

  addLabel(text, x, y, z, bg = 'rgba(0,0,0,0.82)') {
    const lbl = { text, x, y, z, bg, visible: true };
    this.labels.push(lbl);
    return lbl;
  }

  removeLabel(lbl) {
    const idx = this.labels.indexOf(lbl);
    if (idx !== -1) this.labels.splice(idx, 1);
  }

  project(px, py, pz) {
    const dx = px - this.cam.x;
    const dy = py - this.cam.y;
    const dz = pz - this.cam.z;

    const cosY = Math.cos(this.cam.yaw);
    const sinY = Math.sin(this.cam.yaw);
    const x1 = dx * cosY - dz * sinY;
    const z1 = dx * sinY + dz * cosY;

    const cosP = Math.cos(this.cam.pitch);
    const sinP = Math.sin(this.cam.pitch);
    const y2 = dy * cosP - z1 * sinP;
    const z2 = dy * sinP + z1 * cosP;

    if (z2 <= 0.4) return null;
    const scale = this.cam.fov / z2;
    return {
      sx: this.w * 0.5 + x1 * scale,
      sy: this.h * 0.5 - y2 * scale,
      depth: z2
    };
  }

  shadeColor(hex, factor) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, Math.floor(((num >> 16) & 255) * factor)));
    const g = Math.min(255, Math.max(0, Math.floor(((num >> 8) & 255) * factor)));
    const b = Math.min(255, Math.max(0, Math.floor((num & 255) * factor)));
    return `rgb(${r},${g},${b})`;
  }

  render() {
    const ctx = this.ctx;
    // Sky & Horizon
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, '#5dade2');
    grad.addColorStop(0.55, '#aed6f1');
    grad.addColorStop(0.55, '#4b974b');
    grad.addColorStop(1, '#3b7a3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    const faces = [];
    const faceDefs = [
      { idx:, shade: 0.85 }, // Front
      { idx:, shade: 0.72 }, // Back
      { idx:, shade: 0.78 }, // Left
      { idx:, shade: 0.92 }, // Right
      { idx:, shade: 1.08 }, // Top
      { idx:, shade: 0.60 }  // Bottom
    ];

    for (const box of this.parts) {
      if (!box.visible) continue;
      const hw = box.w * 0.5, hh = box.h * 0.5, hd = box.d * 0.5;
      const localVerts = [
        [-hw, -hh,  hd], [ hw, -hh,  hd], [ hw,  hh,  hd], [-hw,  hh,  hd],
        [-hw, -hh, -hd], [ hw, -hh, -hd], [ hw,  hh, -hd], [-hw,  hh, -hd]
      ];

      const cy = Math.cos(box.ry || 0), sy = Math.sin(box.ry || 0);
      const cx = Math.cos(box.rx || 0), sx = Math.sin(box.rx || 0);

      const projVerts = [];
      let behind = false;
      for (const [vx, vy, vz] of localVerts) {
        // Rotate X (limb swing)
        const y1 = vy * cx - vz * sx;
        const z1 = vy * sx + vz * cx;
        // Rotate Y (character facing)
        const x2 = vx * cy + z1 * sy;
        const z2 = -vx * sy + z1 * cy;

        const p = this.project(box.x + x2, box.y + y1, box.z + z2);
        if (!p) { behind = true; break; }
        projVerts.push(p);
      }
      if (behind) continue;

      for (const f of faceDefs) {
        const p0 = projVerts[f.idx[0]];
        const p1 = projVerts[f.idx[1]];
        const p2 = projVerts[f.idx[2]];
        const p3 = projVerts[f.idx[3]];

        // Backface culling
        const cross = (p1.sx - p0.sx) * (p2.sy - p0.sy) - (p1.sy - p0.sy) * (p2.sx - p0.sx);
        if (cross >= 0) continue;

        const avgDepth = (p0.depth + p1.depth + p2.depth + p3.depth) * 0.25;
        faces.push({
          pts: [p0, p1, p2, p3],
          depth: avgDepth,
          color: this.shadeColor(box.color, f.shade),
          alpha: box.alpha
        });
      }
    }

    // Painter's algorithm sort (far to near)
    faces.sort((a, b) => b.depth - a.depth);

    for (const f of faces) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(f.pts[0].sx, f.pts[0].sy);
      ctx.lineTo(f.pts[1].sx, f.pts[1].sy);
      ctx.lineTo(f.pts[2].sx, f.pts[2].sy);
      ctx.lineTo(f.pts[3].sx, f.pts[3].sy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw floating 3D labels
    const sortedLabels = [];
    for (const lbl of this.labels) {
      if (!lbl.visible) continue;
      const p = this.project(lbl.x, lbl.y, lbl.z);
      if (p && p.depth < 140) sortedLabels.push({ lbl, p });
    }
    sortedLabels.sort((a, b) => b.p.depth - a.p.depth);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const { lbl, p } of sortedLabels) {
      const fontSize = Math.max(10, Math.min(18, Math.floor(320 / p.depth)));
      ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
      const textW = ctx.measureText(lbl.text).width + 14;
      const boxH = fontSize + 10;
      ctx.fillStyle = lbl.bg;
      ctx.fillRect(p.sx - textW / 2, p.sy - boxH / 2, textW, boxH);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(lbl.text, p.sx, p.sy);
    }
  }
}

export class R6Rig {
  constructor(engine, x, y, z, shirtColor = '#0d69ac', skinColor = '#f5cd30', pantsColor = '#a4bd47') {
    this.engine = engine;
    this.x = x;
    this.y = y;
    this.z = z;
    this.ry = 0;
    this.swing = 0;

    this.head = engine.addBox(1.2, 1.2, 1.2, skinColor, x, y + 4.6, z);
    this.torso = engine.addBox(2.0, 2.0, 1.0, shirtColor, x, y + 3.0, z);
    this.leftArm = engine.addBox(1.0, 2.0, 1.0, skinColor, x, y + 3.0, z);
    this.rightArm = engine.addBox(1.0, 2.0, 1.0, skinColor, x, y + 3.0, z);
    this.leftLeg = engine.addBox(1.0, 2.0, 1.0, pantsColor, x, y + 1.0, z);
    this.rightLeg = engine.addBox(1.0, 2.0, 1.0, pantsColor, x, y + 1.0, z);
  }

  sync() {
    const cy = Math.cos(this.ry), sy = Math.sin(this.ry);
    const placePart = (part, ox, oy, oz, pitch = 0) => {
      // Pivot offset for swinging arms/legs
      const dy = pitch !== 0 ? -Math.cos(pitch) * 0.9 + 0.9 : 0;
      const dz = pitch !== 0 ? Math.sin(pitch) * 0.9 : 0;
      const lx = ox;
      const lz = oz + dz;

      part.x = this.x + lx * cy + lz * sy;
      part.y = this.y + oy + dy;
      part.z = this.z - lx * sy + lz * cy;
      part.ry = this.ry;
      part.rx = pitch;
    };

    placePart(this.head, 0, 4.6, 0, 0);
    placePart(this.torso, 0, 3.0, 0, 0);
    placePart(this.leftArm, -1.5, 3.0, 0, -this.swing);
    placePart(this.rightArm, 1.5, 3.0, 0, this.swing);
    placePart(this.leftLeg, -0.5, 1.0, 0, this.swing);
    placePart(this.rightLeg, 0.5, 1.0, 0, -this.swing);
  }
}
