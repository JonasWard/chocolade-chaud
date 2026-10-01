# chocolade chaud!

An online configurator for chocolate bars with a 3D printable pattern. Pick the size of the bar, stack a few implicit surfaces (gyroid, Schwarz P/D, Neovius, ...) into a pattern, and export the result as STL or OBJ for printing a mould.

Live at [jonasward.github.io/chocolade-chaud](https://JonasWard.github.io/chocolade-chaud).

## Features

- **Single bar or grid**: one bar of any size, or a grid of bars cycling through a list of colours.
- **Patterns**: chain distance methods (gyroid, Schwarz P/D, Neovius, sphere, box, torus, cylinder) on logarithmic sliders, where each method's output sets the scale of the one above it, and move the pattern's centre.
- **Live preview**: meshes are generated in a web worker, so the UI stays responsive at up to 8 divisions per mm.
- **Export**: binary STL or OBJ, tilted on its side for printing and with an internal support structure. A single bar downloads as one file, a grid as one zip.

## How it works

Each bar is a grid of vertices on the top surface. The pattern's distance function moves every vertex along a direction that fans out with the inset, the bottom surface is offset from it and, where it helps the print, raised into ribs that support the top. Top, bottom and the side walls are stitched into one closed, outward-facing triangle mesh.

That closed mesh is what gets exported. The preview draws the same bar split up in parts, so each part has its own normals: the pattern is baked on the GPU into a _top surface_ (two float textures holding the location and the normal of every top vertex) whenever the settings change. The vertices of the preview have no location of their own, they only refer to a vertex of that top surface: the top takes its location and normal from it, the side walls take their top edge from it and share one normal per wall (they are planes, tilted by the inset), and the bottom is offset from it. Drawing a bar is then only a texture lookup per vertex. Without float render targets the preview falls back to the exported mesh.

A single bar can carry text (prototype). The text is drawn on a canvas covering the top of the bar and turned into a signed distance field with an exact distance transform. That field is merged into the height of the pattern, by the same formula in the bake shader and in the exported mesh: the pattern fades out on the text and the text is raised (or sunk) with a bevelled edge. The detail of the text is limited by the divisions per mm of the bar.

## Development

This is a [bun](https://bun.sh) project built with [Vite](https://vite.dev).

```sh
bun install        # install dependencies
bun dev            # dev server at http://localhost:5173/chocolade-chaud/
bun run test       # unit tests (vitest)
bun run typecheck  # tsc
bun run lint       # eslint
bun run build      # production build into build/
bun run preview    # serve the production build locally
```

## CI and deployment

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request:

1. **check**: install with the frozen lockfile, typecheck, lint, test and build.
2. **deploy**: only for pushes to `main`, and only when check passed. It publishes the build check produced to the `gh-pages` branch, which GitHub Pages serves at the URL above.

So merging into `main` is all it takes to release. To redeploy `main` without a new commit, run the workflow from the Actions tab (_Run workflow_). As a manual fallback, `bun run deploy` builds locally and pushes `build/` to `gh-pages` with your own git credentials.

## Pinned dependencies

- `three` stays on `~0.182`: react-three-fiber 9 still uses `THREE.Clock`, which logs a deprecation warning from three r183 on.
- `react` / `react-dom` stay on `~19.3`: react-three-fiber 9.8 supports `react >=19 <19.4`.

## Code map

- `src/geometry` is the engine-free geometry core: distance methods (`sdMethods.ts`), mesh generation on typed arrays (`createMesh.ts`), grid layouts (`grid.ts`) and the binary STL / OBJ serializers (`exportGeometry.ts`). It must not import the render engine, a test guards this.
- `src/geometry/meshWorker.ts` and `src/hooks/useGridMeshes.ts` generate the meshes in a web worker, so editing settings never blocks the UI. The scene and the exports share the generated meshes.
- `src/three` renders the meshes with three.js via react-three-fiber (drei for camera fitting and orbit controls).
- `src/export` downloads the exported files, several bars are zipped into one download.
- `src/Components` holds the settings drawer and export buttons.
