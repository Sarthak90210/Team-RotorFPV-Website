# RotorFPV GLB Optimizer

A small **standalone** tool (not part of the website) that takes a 3D drone model
and produces a web-ready, compressed file you can upload in the admin → **Drones**
tab. It runs the same optimization the site's own models go through.

## What it does

1. **Cleans & simplifies** the mesh (dedup, weld, simplify, prune) — while
   **keeping every part separate** (it does *not* fuse parts together), so each
   named part stays individually clickable in the 3D viewer.
2. **Draco-compresses** the geometry — typically shrinks the file 40–70% with no
   visible quality loss.

## One-time setup

1. Install [Node.js](https://nodejs.org) (LTS) if you don't have it.
2. Open a terminal in this `glb-optimizer/` folder and run:
   ```
   npm install
   ```

## Every time you want to optimize a model

1. Export your drone from CAD (e.g. FreeCAD → `File → Export → glTF`). **Give the
   parts meaningful names** (e.g. `Front Left Motor`, `PIXHAWK 5X-6X`) so the
   admin component list is readable.
2. Put the exported file into the **`input/`** folder.
   - A single `.glb` works.
   - A `.gltf` works too — just drop its companion `.bin` (and any textures) in
     `input/` alongside it.
3. Run:
   ```
   npm run optimize
   ```
4. Grab the result from the **`output/`** folder (named `<yourfile>-optimized.glb`).
5. In the website admin → **Drones** tab, upload that file as the drone's 3D model.

## Notes

- Input must already be a **GLB / glTF**. If you only have a CAD file (STEP, etc.),
  convert it to glTF first (FreeCAD does this: `File → Export → glTF`).
- You can drop **multiple** files into `input/` at once — each is optimized
  separately.
- The tool never modifies your original files in `input/`; results go to `output/`.
- If a part list in the admin shows generic names (`Solid001`…), that came from the
  export — rename parts in your CAD tool and re-export for a cleaner list.
