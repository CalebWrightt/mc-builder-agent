# Voxel Architect

Voxel Architect is a single-page React + Three.js blueprint viewer for Minecraft-style builds.

## What this build includes
- Mobile-friendly game glassmorphism UI.
- Theme carousel (Fantasy, Sci-Fi, Empty Plot).
- 3D viewer with `@react-three/fiber` + `@react-three/drei`:
  - Orbit controls
  - Infinite grid
  - Contact shadows
  - Stage + environment lighting
  - Bottom-left gizmo helper
- Layer slider to peel by Y level.
- Current-layer material panel with counts.
- "New Blueprint" modal for JSON import and strict schema validation.

## Blueprint JSON schema
```json
{
  "meta": { "dimensions": { "x": 10, "y": 10, "z": 10 } },
  "palette": { "1": "cobblestone", "2": "planks_oak" },
  "structure": [
    { "y": 0, "blocks": [ { "x": 0, "z": 0, "id": "1" } ] }
  ]
}
```

## Texture resources
This app can pull block textures from a public Minecraft-assets mirror hosted on GitHub (`PrismarineJS/minecraft-assets`).

## Deploy so any device can access it
You do **not** need users to install anything. Deploy this repo as a static site:

### Option A: Vercel (recommended)
1. Push this repository to GitHub.
2. In Vercel, click **Add New Project** and import this repo.
3. Framework preset: **Vite** (auto-detected).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy.

### Option B: Netlify
1. Connect this repo in Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Deploy.

After deploy, you get a URL that works on desktop/mobile/tablet browsers.
