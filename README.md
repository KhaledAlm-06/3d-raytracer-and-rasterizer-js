# Computer Graphics from scratch

- **Category:** 3D Renderer
- **Language:** JavaScript (Node.js + Browser Canvas)
- **Original Tutorial:** [Computer Graphics from scratch](https://www.gabrielgambetta.com/computer-graphics-from-scratch/00-introduction.html)

## Overview
A faithful implementation of both halves of Gabriel Gambetta's *Computer Graphics from Scratch* in zero-dependency JavaScript:
1. **Part I — Raytracer:** Ambient, point, and directional lights, Phong specular reflections, shadow rays, and recursive reflection rays.
2. **Part II — Rasterizer:** 4x4 homogeneous transforms, 5-plane Sutherland-Hodgman frustum clipping, backface culling, linear edge interpolation, and `1/z` perspective-correct depth buffering.

## How to Run
- **Node.js (headless verification + dual ASCII previews):**
  ```bash
  node main.js
  ```
- **Browser:** Open `index.html` to view the raytraced scene alongside the rotating rasterized 3D cubes.
