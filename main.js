"use strict";

/**
 * Computer Graphics from Scratch (Gabriel Gambetta)
 * Implements BOTH rendering architectures from the book:
 *   Part I  - Raytracer (ambient/point/directional lights, specular, shadows, recursive reflection)
 *   Part II - Rasterizer (Mat4 transforms, perspective projection, 5-plane Sutherland-Hodgman
 *             frustum clipping, backface culling, linear attribute interpolation, 1/z depth buffer)
 */

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  scale(k) { return new Vec3(this.x * k, this.y * k, this.z * k); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  length() { return Math.sqrt(this.dot(this)); }
  normalize() {
    const l = this.length();
    return l > 0 ? this.scale(1 / l) : new Vec3(0, 0, 0);
  }
}

class Mat4 {
  constructor(data) {
    this.m = data ? Float64Array.from(data) : new Float64Array(16);
  }
  static identity() {
    return new Mat4([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }
  static translation(x, y, z) {
    return new Mat4([1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1]);
  }
  static scaling(s) {
    return new Mat4([s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1]);
  }
  static rotationY(deg) {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Mat4([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
  }
  static rotationX(deg) {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Mat4([1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]);
  }
  multiply(other) {
    const out = new Float64Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += this.m[r * 4 + k] * other.m[k * 4 + c];
        out[r * 4 + c] = sum;
      }
    }
    return new Mat4(out);
  }
  multiplyVec4(x, y, z, w = 1) {
    const m = this.m;
    return {
      x: m[0]*x + m[1]*y + m[2]*z + m[3]*w,
      y: m[4]*x + m[5]*y + m[6]*z + m[7]*w,
      z: m[8]*x + m[9]*y + m[10]*z + m[11]*w,
      w: m[12]*x + m[13]*y + m[14]*z + m[15]*w
    };
  }
}

class CanvasBuffer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8ClampedArray(width * height * 4);
    this.depthBuffer = new Float64Array(width * height);
    this.clear([255, 255, 255]);
  }

  clear(rgb = [14, 18, 26]) {
    for (let i = 0; i < this.pixels.length; i += 4) {
      this.pixels[i] = rgb[0];
      this.pixels[i + 1] = rgb[1];
      this.pixels[i + 2] = rgb[2];
      this.pixels[i + 3] = 255;
    }
    this.depthBuffer.fill(0); // stores 1/z (larger = closer)
  }

  putPixel(cx, cy, rgb) {
    const sx = Math.round(this.width / 2 + cx);
    const sy = Math.round(this.height / 2 - cy - 1);
    if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) return;
    const off = (sy * this.width + sx) * 4;
    this.pixels[off] = Math.max(0, Math.min(255, rgb[0] | 0));
    this.pixels[off + 1] = Math.max(0, Math.min(255, rgb[1] | 0));
    this.pixels[off + 2] = Math.max(0, Math.min(255, rgb[2] | 0));
    this.pixels[off + 3] = 255;
  }

  putPixelWithDepth(sx, sy, invZ, rgb) {
    const ix = sx | 0;
    const iy = sy | 0;
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    const idx = iy * this.width + ix;
    if (invZ > this.depthBuffer[idx]) {
      this.depthBuffer[idx] = invZ;
      const off = idx * 4;
      this.pixels[off] = Math.max(0, Math.min(255, rgb[0] | 0));
      this.pixels[off + 1] = Math.max(0, Math.min(255, rgb[1] | 0));
      this.pixels[off + 2] = Math.max(0, Math.min(255, rgb[2] | 0));
      this.pixels[off + 3] = 255;
    }
  }

  toAscii(cols = 60, rows = 26) {
    const ramp = " .:-=+*#%@";
    const lines = [];
    for (let r = 0; r < rows; r++) {
      const y = Math.floor((r / rows) * this.height);
      let line = "";
      for (let c = 0; c < cols; c++) {
        const x = Math.floor((c / cols) * this.width);
        const o = (y * this.width + x) * 4;
        const lum = (0.299 * this.pixels[o] + 0.587 * this.pixels[o + 1] + 0.114 * this.pixels[o + 2]) / 255;
        line += ramp[Math.min(ramp.length - 1, Math.floor(lum * ramp.length))];
      }
      lines.push(line);
    }
    return lines.join("\n");
  }
}

/* ========================= PART I: RAYTRACER ========================= */

class GambettaRaytracer {
  constructor() {
    this.viewportSize = 1.0;
    this.projectionPlaneZ = 1.0;
    this.backgroundColor = [15, 20, 30];
    this.spheres = [
      { center: new Vec3(0, -1, 3), radius: 1, color: [255, 45, 45], specular: 500, reflective: 0.2 },
      { center: new Vec3(2, 0, 4), radius: 1, color: [45, 110, 255], specular: 500, reflective: 0.35 },
      { center: new Vec3(-2, 0, 4), radius: 1, color: [45, 220, 95], specular: 10, reflective: 0.4 },
      { center: new Vec3(0, -5001, 0), radius: 5000, color: [230, 205, 65], specular: 1000, reflective: 0.45 }
    ];
    this.lights = [
      { type: "ambient", intensity: 0.2 },
      { type: "point", intensity: 0.6, position: new Vec3(2, 1, 0) },
      { type: "directional", intensity: 0.2, direction: new Vec3(1, 4, 4) }
    ];
  }

  canvasToViewport(cx, cy, width, height) {
    const aspect = width / height;
    return new Vec3(
      (cx * this.viewportSize * aspect) / width,
      (cy * this.viewportSize) / height,
      this.projectionPlaneZ
    );
  }

  intersectRaySphere(origin, direction, sphere) {
    const oc = origin.sub(sphere.center);
    const a = direction.dot(direction);
    const b = 2 * oc.dot(direction);
    const c = oc.dot(oc) - sphere.radius * sphere.radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return [Infinity, Infinity];
    const sq = Math.sqrt(disc);
    return [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
  }

  closestIntersection(origin, direction, tMin, tMax) {
    let closestT = Infinity;
    let closestSphere = null;
    for (const s of this.spheres) {
      const [t1, t2] = this.intersectRaySphere(origin, direction, s);
      if (t1 >= tMin && t1 <= tMax && t1 < closestT) { closestT = t1; closestSphere = s; }
      if (t2 >= tMin && t2 <= tMax && t2 < closestT) { closestT = t2; closestSphere = s; }
    }
    return { sphere: closestSphere, t: closestT };
  }

  reflectRay(ray, normal) {
    return normal.scale(2 * normal.dot(ray)).sub(ray);
  }

  computeLighting(point, normal, viewVec, specular) {
    let intensity = 0.0;
    for (const light of this.lights) {
      if (light.type === "ambient") {
        intensity += light.intensity;
        continue;
      }
      let L;
      let tMax;
      if (light.type === "point") {
        L = light.position.sub(point);
        tMax = 1.0;
      } else {
        L = light.direction;
        tMax = Infinity;
      }

      // Shadow check
      const blocker = this.closestIntersection(point, L, 0.001, tMax);
      if (blocker.sphere !== null) continue;

      // Diffuse
      const ndotl = normal.dot(L);
      if (ndotl > 0) {
        intensity += (light.intensity * ndotl) / (normal.length() * L.length());
      }

      // Specular
      if (specular !== -1) {
        const R = this.reflectRay(L, normal);
        const rdotv = R.dot(viewVec);
        if (rdotv > 0) {
          intensity += light.intensity * Math.pow(rdotv / (R.length() * viewVec.length()), specular);
        }
      }
    }
    return intensity;
  }

  traceRay(origin, direction, tMin, tMax, recursionDepth) {
    const { sphere, t } = this.closestIntersection(origin, direction, tMin, tMax);
    if (!sphere) return this.backgroundColor;

    const point = origin.add(direction.scale(t));
    const normal = point.sub(sphere.center).normalize();
    const view = direction.scale(-1);
    const lighting = this.computeLighting(point, normal, view, sphere.specular);
    const localColor = sphere.color.map((c) => Math.min(255, c * lighting));

    const r = sphere.reflective;
    if (recursionDepth <= 0 || r <= 0) return localColor;

    const reflectedDir = this.reflectRay(view, normal);
    const reflectedColor = this.traceRay(point, reflectedDir, 0.001, Infinity, recursionDepth - 1);
    return [
      localColor[0] * (1 - r) + reflectedColor[0] * r,
      localColor[1] * (1 - r) + reflectedColor[1] * r,
      localColor[2] * (1 - r) + reflectedColor[2] * r
    ];
  }

  render(canvas, cameraPos = new Vec3(0, 0, 0), recursionDepth = 3) {
    const hw = Math.floor(canvas.width / 2);
    const hh = Math.floor(canvas.height / 2);
    for (let x = -hw; x < hw; x++) {
      for (let y = -hh; y < hh; y++) {
        const dir = this.canvasToViewport(x, y, canvas.width, canvas.height);
        const color = this.traceRay(cameraPos, dir, 1, Infinity, recursionDepth);
        canvas.putPixel(x, y, color);
      }
    }
  }
}

/* ========================= PART II: RASTERIZER ========================= */

function interpolate(i0, d0, i1, d1) {
  if (i0 === i1) return [d0];
  const values = [];
  const a = (d1 - d0) / (i1 - i0);
  let d = d0;
  for (let i = i0; i <= i1; i++) {
    values.push(d);
    d += a;
  }
  return values;
}

class GambettaRasterizer {
  constructor() {
    this.viewportSize = 1.0;
    this.projectionPlaneZ = 1.0;
    this.planes = [
      { normal: new Vec3(0, 0, 1), d: -1 }, // near z = 1
      { normal: new Vec3(1 / Math.SQRT2, 0, 1 / Math.SQRT2), d: 0 }, // left
      { normal: new Vec3(-1 / Math.SQRT2, 0, 1 / Math.SQRT2), d: 0 }, // right
      { normal: new Vec3(0, -1 / Math.SQRT2, 1 / Math.SQRT2), d: 0 }, // top
      { normal: new Vec3(0, 1 / Math.SQRT2, 1 / Math.SQRT2), d: 0 } // bottom
    ];
  }

  static createCubeModel() {
    const vertices = [
      new Vec3(1, 1, 1), new Vec3(-1, 1, 1), new Vec3(-1, -1, 1), new Vec3(1, -1, 1),
      new Vec3(1, 1, -1), new Vec3(-1, 1, -1), new Vec3(-1, -1, -1), new Vec3(1, -1, -1)
    ];
    const RED = [235, 65, 65], GREEN = [65, 220, 110], BLUE = [65, 130, 245];
    const YELLOW = [240, 210, 55], PURPLE = [195, 80, 235], CYAN = [55, 220, 230];
    const triangles = [
      { v: [0, 1, 2], color: RED }, { v: [0, 2, 3], color: RED },
      { v: [4, 0, 3], color: GREEN }, { v: [4, 3, 7], color: GREEN },
      { v: [5, 4, 7], color: BLUE }, { v: [5, 7, 6], color: BLUE },
      { v: [1, 5, 6], color: YELLOW }, { v: [1, 6, 2], color: YELLOW },
      { v: [4, 5, 1], color: PURPLE }, { v: [4, 1, 0], color: PURPLE },
      { v: [2, 6, 7], color: CYAN }, { v: [2, 7, 3], color: CYAN }
    ];
    return { vertices, triangles, boundsRadius: Math.sqrt(3) };
  }

  projectVertex(v, canvas) {
    const sx = (v.x * this.projectionPlaneZ / v.z) * (canvas.width / this.viewportSize);
    const sy = (v.y * this.projectionPlaneZ / v.z) * (canvas.height / this.viewportSize);
    return {
      x: Math.round(canvas.width / 2 + sx),
      y: Math.round(canvas.height / 2 - sy),
      invZ: 1.0 / v.z,
      h: v.h ?? 1.0
    };
  }

  clipTriangleAgainstPlane(triangle, plane, vertices) {
    const signedDist = (v) => plane.normal.dot(v) + plane.d;
    const v0 = vertices[triangle.v[0]];
    const v1 = vertices[triangle.v[1]];
    const v2 = vertices[triangle.v[2]];
    const d0 = signedDist(v0), d1 = signedDist(v1), d2 = signedDist(v2);

    const inside = [];
    const outside = [];
    if (d0 >= 0) inside.push(0); else outside.push(0);
    if (d1 >= 0) inside.push(1); else outside.push(1);
    if (d2 >= 0) inside.push(2); else outside.push(2);

    if (inside.length === 0) return [];
    if (inside.length === 3) return [triangle];

    const intersect = (a, b) => {
      const da = signedDist(a);
      const db = signedDist(b);
      const t = da / (da - db);
      const p = a.add(b.sub(a).scale(t));
      p.h = (a.h ?? 1.0) + ((b.h ?? 1.0) - (a.h ?? 1.0)) * t;
      const idx = vertices.length;
      vertices.push(p);
      return idx;
    };

    if (inside.length === 1) {
      const i0 = triangle.v[inside[0]];
      const o0 = triangle.v[outside[0]];
      const o1 = triangle.v[outside[1]];
      return [{ v: [i0, intersect(vertices[i0], vertices[o0]), intersect(vertices[i0], vertices[o1])], color: triangle.color }];
    }
    const i0 = triangle.v[inside[0]];
    const i1 = triangle.v[inside[1]];
    const o0 = triangle.v[outside[0]];
    const newA = intersect(vertices[i0], vertices[o0]);
    const newB = intersect(vertices[i1], vertices[o0]);
    return [
      { v: [i0, i1, newA], color: triangle.color },
      { v: [i1, newB, newA], color: triangle.color }
    ];
  }

  drawFilledTriangle(p0, p1, p2, color, canvas) {
    if (p1.y < p0.y) [p0, p1] = [p1, p0];
    if (p2.y < p0.y) [p0, p2] = [p2, p0];
    if (p2.y < p1.y) [p1, p2] = [p2, p1];

    const x01 = interpolate(p0.y, p0.x, p1.y, p1.x);
    const h01 = interpolate(p0.y, p0.h, p1.y, p1.h);
    const z01 = interpolate(p0.y, p0.invZ, p1.y, p1.invZ);

    const x12 = interpolate(p1.y, p1.x, p2.y, p2.x);
    const h12 = interpolate(p1.y, p1.h, p2.y, p2.h);
    const z12 = interpolate(p1.y, p1.invZ, p2.y, p2.invZ);

    const x02 = interpolate(p0.y, p0.x, p2.y, p2.x);
    const h02 = interpolate(p0.y, p0.h, p2.y, p2.h);
    const z02 = interpolate(p0.y, p0.invZ, p2.y, p2.invZ);

    x01.pop(); h01.pop(); z01.pop();
    const x012 = x01.concat(x12);
    const h012 = h01.concat(h12);
    const z012 = z01.concat(z12);

    const m = Math.floor(x02.length / 2);
    let xLeft, xRight, hLeft, hRight, zLeft, zRight;
    if (x02[m] < x012[m]) {
      xLeft = x02; xRight = x012;
      hLeft = h02; hRight = h012;
      zLeft = z02; zRight = z012;
    } else {
      xLeft = x012; xRight = x02;
      hLeft = h012; hRight = h02;
      zLeft = z012; zRight = z02;
    }

    for (let y = p0.y; y <= p2.y; y++) {
      const idx = y - p0.y;
      if (idx < 0 || idx >= xLeft.length) continue;
      const xl = Math.round(xLeft[idx]);
      const xr = Math.round(xRight[idx]);
      if (xr < xl) continue;
      const hSegment = interpolate(xl, hLeft[idx], xr, hRight[idx]);
      const zSegment = interpolate(xl, zLeft[idx], xr, zRight[idx]);
      for (let x = xl; x <= xr; x++) {
        const s = x - xl;
        const shade = Math.max(0.25, Math.min(1.0, hSegment[s]));
        canvas.putPixelWithDepth(x, y, zSegment[s], [
          color[0] * shade,
          color[1] * shade,
          color[2] * shade
        ]);
      }
    }
  }

  renderInstance(model, transformMat, canvas) {
    const transformedVerts = model.vertices.map((v, i) => {
      const p = transformMat.multiplyVec4(v.x, v.y, v.z, 1);
      const vec = new Vec3(p.x, p.y, p.z);
      vec.h = 0.65 + 0.35 * ((i % 4) / 3);
      return vec;
    });

    let triangles = model.triangles.slice();
    for (const plane of this.planes) {
      const next = [];
      for (const tri of triangles) {
        next.push(...this.clipTriangleAgainstPlane(tri, plane, transformedVerts));
      }
      triangles = next;
    }

    let renderedCount = 0;
    for (const tri of triangles) {
      const v0 = transformedVerts[tri.v[0]];
      const v1 = transformedVerts[tri.v[1]];
      const v2 = transformedVerts[tri.v[2]];
      const normal = v1.sub(v0).cross(v2.sub(v0));
      // Backface culling: keep triangles facing toward camera (at origin)
      if (normal.dot(v0.scale(-1)) <= 0) continue;

      const p0 = this.projectVertex(v0, canvas);
      const p1 = this.projectVertex(v1, canvas);
      const p2 = this.projectVertex(v2, canvas);
      this.drawFilledTriangle(p0, p1, p2, tri.color, canvas);
      renderedCount++;
    }
    return renderedCount;
  }
}

function runSelfTests() {
  const assert = require("assert");

  // Part I: Raytracer
  const rayCanvas = new CanvasBuffer(64, 28);
  const raytracer = new GambettaRaytracer();
  raytracer.render(rayCanvas, new Vec3(0, 0, 0), 3);

  const centerOffset = ((14 * 64) + 32) * 4;
  assert(rayCanvas.pixels[centerOffset] > 80, "Center red sphere should be lit by scene lights");

  // Part II: Rasterizer + Clipping
  const rastCanvas = new CanvasBuffer(64, 28);
  rastCanvas.clear([12, 16, 24]);
  const rasterizer = new GambettaRasterizer();
  const cube = GambettaRasterizer.createCubeModel();
  const m1 = Mat4.translation(-1.3, 0, 6.5).multiply(Mat4.rotationY(32)).multiply(Mat4.rotationX(20));
  const m2 = Mat4.translation(1.4, 0, 7.2).multiply(Mat4.rotationY(-40)).multiply(Mat4.rotationX(-15));
  const trisDrawn = rasterizer.renderInstance(cube, m1, rastCanvas) + rasterizer.renderInstance(cube, m2, rastCanvas);
  assert(trisDrawn >= 4, "Backface-culled cubes should draw visible front faces");

  // Verify near-plane clipping drops a triangle completely behind z=1
  const behindVerts = [new Vec3(0, 0, -2), new Vec3(1, 0, -2), new Vec3(0, 1, -2)];
  const clippedOut = rasterizer.clipTriangleAgainstPlane({ v: [0, 1, 2], color: [255, 0, 0] }, rasterizer.planes[0], behindVerts);
  assert.strictEqual(clippedOut.length, 0, "Triangle behind near plane must be clipped away");

  console.log("=== Computer Graphics From Scratch (Raytracer + Rasterizer) Passed ===");
  console.log("\nPart I - Gambetta Raytracer (64x28):\n" + rayCanvas.toAscii(64, 22));
  console.log("\nPart II - Gambetta Rasterizer (2 Shaded Cubes, 64x28):\n" + rastCanvas.toAscii(64, 22));
}

if (typeof window !== "undefined") {
  window.CGFromScratch = { Vec3, Mat4, CanvasBuffer, GambettaRaytracer, GambettaRasterizer };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { Vec3, Mat4, CanvasBuffer, GambettaRaytracer, GambettaRasterizer };
}
if (typeof document === "undefined" && require.main === module) {
  runSelfTests();
}
