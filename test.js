"use strict";

const assert = require("assert");
const {
  Vec3,
  Mat4,
  CanvasBuffer,
  GambettaRaytracer,
  GambettaRasterizer
} = require("./main.js");

function approxEqual(a, b, eps = 1e-6) {
  assert(Math.abs(a - b) <= eps, `Expected ${a} to be within ${eps} of ${b}`);
}

function testVec3() {
  const a = new Vec3(1, 2, 3);
  const b = new Vec3(4, -5, 6);

  const sum = a.add(b);
  assert.deepStrictEqual([sum.x, sum.y, sum.z], [5, -3, 9]);

  const diff = b.sub(a);
  assert.deepStrictEqual([diff.x, diff.y, diff.z], [3, -7, 3]);

  assert.strictEqual(a.dot(b), 12);

  const cross = new Vec3(1, 0, 0).cross(new Vec3(0, 1, 0));
  assert.deepStrictEqual([cross.x, cross.y, cross.z], [0, 0, 1]);

  const unit = new Vec3(3, 4, 0).normalize();
  approxEqual(unit.x, 0.6);
  approxEqual(unit.y, 0.8);
  approxEqual(unit.length(), 1.0);

  const zero = new Vec3(0, 0, 0).normalize();
  assert.deepStrictEqual([zero.x, zero.y, zero.z], [0, 0, 0]);
}

function testMat4() {
  const id = Mat4.identity().multiplyVec4(2, -3, 5, 1);
  assert.deepStrictEqual([id.x, id.y, id.z, id.w], [2, -3, 5, 1]);

  const t = Mat4.translation(3, -2, 7).multiplyVec4(1, 4, -1, 1);
  assert.deepStrictEqual([t.x, t.y, t.z], [4, 2, 6]);

  const s = Mat4.scaling(2.5).multiplyVec4(2, -4, 6, 1);
  assert.deepStrictEqual([s.x, s.y, s.z], [5, -10, 15]);

  const rz = Mat4.rotationZ(90).multiplyVec4(1, 0, 0, 1);
  approxEqual(rz.x, 0);
  approxEqual(rz.y, 1);
  approxEqual(rz.z, 0);

  const v = new Vec3(1.5, -2.2, 3.1);
  for (const m of [Mat4.rotationX(37), Mat4.rotationY(-53), Mat4.rotationZ(124)]) {
    const r = m.multiplyVec4(v.x, v.y, v.z, 1);
    approxEqual(Math.hypot(r.x, r.y, r.z), v.length(), 1e-9);
  }
}

function testFrustumClipping() {
  const rasterizer = new GambettaRasterizer();
  const nearPlane = rasterizer.planes[0]; // z >= 1
  const color = [255, 100, 50];

  // Case 0: all 3 vertices behind near plane -> 0 triangles
  const verts0 = [new Vec3(0, 0, 0.2), new Vec3(1, 0, 0.5), new Vec3(0, 1, 0.8)];
  assert.strictEqual(
    rasterizer.clipTriangleAgainstPlane({ v: [0, 1, 2], color }, nearPlane, verts0).length,
    0
  );

  // Case 1: 1 vertex inside, 2 outside -> 1 clipped triangle with intersection on z=1
  const verts1 = [new Vec3(0, 0, 2), new Vec3(1, 0, 0), new Vec3(0, 1, 0)];
  const res1 = rasterizer.clipTriangleAgainstPlane({ v: [0, 1, 2], color }, nearPlane, verts1);
  assert.strictEqual(res1.length, 1);
  approxEqual(verts1[res1[0].v[1]].z, 1.0);
  approxEqual(verts1[res1[0].v[2]].z, 1.0);

  // Case 2: 2 vertices inside, 1 outside -> 2 triangles
  const verts2 = [new Vec3(0, 0, 2), new Vec3(1, 0, 2), new Vec3(0, 1, 0)];
  const res2 = rasterizer.clipTriangleAgainstPlane({ v: [0, 1, 2], color }, nearPlane, verts2);
  assert.strictEqual(res2.length, 2);

  // Case 3: all 3 vertices inside -> 1 unchanged triangle
  const verts3 = [new Vec3(0, 0, 2), new Vec3(1, 0, 3), new Vec3(0, 1, 4)];
  const res3 = rasterizer.clipTriangleAgainstPlane({ v: [0, 1, 2], color }, nearPlane, verts3);
  assert.strictEqual(res3.length, 1);
  assert.deepStrictEqual(res3[0].v, [0, 1, 2]);
}

function testRaytracer() {
  const canvas = new CanvasBuffer(40, 24);
  const tracer = new GambettaRaytracer();
  tracer.render(canvas, new Vec3(0, 0, 0), 3);

  // Center hits red matte sphere at (0, -1, 3) with dominant red channel
  const centerIdx = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4;
  assert(canvas.pixels[centerIdx] > 80, "Center sphere pixel should be lit");
  assert(canvas.pixels[centerIdx] > canvas.pixels[centerIdx + 1], "Center sphere should be red-dominant");

  // Top-left corner hits background (15, 20, 30)
  assert.strictEqual(canvas.pixels[0], tracer.backgroundColor[0]);
  assert.strictEqual(canvas.pixels[1], tracer.backgroundColor[1]);
  assert.strictEqual(canvas.pixels[2], tracer.backgroundColor[2]);
}

testVec3();
testMat4();
testFrustumClipping();
testRaytracer();
console.log("All 3d-raytracer-and-rasterizer-js tests passed.");
