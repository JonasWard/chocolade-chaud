# chocolade chaud!

An online configurator for chocolate bars with a 3D printable pattern. Pick the tablet and its chocolate, stack a few implicit surfaces (gyroid, Schwarz P/D, Neovius, ...) into a pattern, and export the result as STL or OBJ for printing a mould.

Live at [jonasward.github.io/chocolade-chaud](https://JonasWard.github.io/chocolade-chaud).

## Features

- **Tablets**: _1 tablet_ in one of four sizes, measured at the base and derived from the whole tablet of 6 × 2 units, 150 × 70 mm (a unit is 25 × 35 mm): 1×2 (25 × 70 mm), 2×1 (50 × 35 mm), 4×1 (100 × 35 mm) and 6×2. A _combined_ tablet fills the 6 × 2 with smaller tablets (1×2, 2×1, 4×1), picked from the thumbnails of all 30 ways to fill it, with a 1 mm gap between the bases of the pieces. The top of a tablet is smaller than its base by the inset on every side. Expert mode adds a _custom size_ of any width and length.
- **Chocolates**: eight of them, from dark 85% to matcha, each with its own colour and shine. The pieces of a combined tablet share one, or (unchecking _Same chocolate for every piece_) each piece picked in the drawing of the layout gets its own.
- **Patterns**: a tree of distance functions, its output is how far the top moves, in mm. The leaves are methods (gyroid, Schwarz P/D, Neovius, sphere, box, torus, cylinder), SVG shapes, text and constants. The groups combine them: union, difference and intersection (optionally smooth), add and subtract, and chains, where every child's output sets the scale of the child above it. A sine is a modifier: it turns the distance of what it holds into ripples, amplitude × sin(2π · distance / period), so a sine around a text echoes its outline. Every node has a scale (on a logarithmic slider) and a gain, and the pattern can be moved and rotated. A tap on the icon of a node picks another kind for it. With a node's ⋯ menu it moves into another group (at the end, in a chain that is the innermost place) or out of its group, and a group can be unwrapped into its children.
- **SVG shapes**: upload any SVG, its filled and stroked parts become a distance field in mm that can be placed, scaled, tiled and combined like any other node.
- **Placing SVG shapes and text**: one of nine places on the bars (top, middle or bottom by left, centre or right) and a padding: against an edge the shape stays the padding away from it, measured to what is drawn, centred the padding moves it. It follows when the bars are resized. Dragging a point of the curve of a text against an edge centres it where it is, so it doesn't jump.
- **Phone and desktop**: the bar next to collapsible panels, on a phone above them in a sheet as tall as its content, up to 60% of the screen. The settings can be hidden (⇥ in the toolbar, the handle of the sheet on a phone), on a phone they also make room while a curve is edited. The tree is an outline on desktop. On a phone every level down to the opened group is a column of one-line cards (the key attributes of a node, its settings fold open), in a strip you swipe through, the parent peeking at the side. Both show the pattern as a formula on top.
- **Text**: a text node is the signed distance in mm to the outline of its letters, combined like any other node. Every text node has its own font, picked from a searchable list: an installed one (Chrome and Edge can list all of them, elsewhere common fonts are detected) or any Google Fonts family, which loads on every device that opens the link. Text runs on a straight line or along a base curve: a smooth curve through its points, a polyline or a cubic spline with handles as in an SVG path.
- **Limits of SVG shapes and text**: the distance stops at a limit inside and one outside (0 is none), so an inside limit gives flat letters at that depth. With _Custom bevel_ each limit is reached over the width of its bevel instead of with the distance itself (0 is a step). A scale only changes the size of an SVG shape or a text: its distances, limits and bevels stay in mm on the bars. Their outline is traced from a large drawing (every letter on its own) into fine polylines, and their fields hold the exact distance to it: finest around the shape, with coarser levels reaching 64 times as far, sampled bicubically and drawn finer when a scale enlarges them. The tracing runs in a worker.
- **Editing curves in the scene**: _Edit curve_ (or _Edit in 3D_ in the inspector) moves the camera smoothly to an orthographic view from above, where you can pan and zoom but not orbit, and shows the curve. Drag a point to move it, drag the small dot between two points to add one, select a point and press Delete to remove it. _View_ (or Esc) moves the camera back to where it was. A text inside a chain (but its last child) is warped by the chain: its curve is drawn where the letters are, and a dragged point lands under the pointer.
- **Saved in the link**: the whole state is packed with [densing](https://www.npmjs.com/package/densing) into the `?s=` parameter of the url and into local storage, so a link reproduces the bar. A link of an older version is read with the schema of its version and brought up to date. A bar of a link from before the tablets (or one bar of its grid) opens as a custom bar with its top where it was, its colour as the chocolate that looks most like it and its amplitude in the gain of the pattern; a sine curve of such a link becomes a sine that modifies nothing yet. SVG sources don't fit in a link: an SVG is referred to by the hash of its source, and the sources are kept in local storage, so a link with an uploaded SVG shows it as missing elsewhere until it is uploaded there too.
- **Undo and redo**: buttons over the bar, or Ctrl/⌘+Z and Ctrl/⌘+Shift+Z. Quick successive edits, like dragging a slider, are one step.
- **Live preview**: meshes are generated in a web worker, so the UI stays responsive at up to 32 divisions per mm. A side of a bar has at most 8192 divisions and all bars together at most 8.4 million vertices, beyond that the density is lowered to fit. A GPU that can't hold a bar that large in a texture shows the mesh of the worker instead.
- **Export**: binary STL or OBJ, tilted on its side for printing and with an internal support structure. A single bar downloads as one file, the pieces of a combined tablet as one zip.

- **Simple and expert**: simple mode shows what most patterns need: a pattern to start from instead of the formula, the text, its font, size, place, limits and whether it is straight or curved (a curve is smooth, without handles). Expert adds every setting: scale and gain of every node, bevels, the padding along x and z apart, the angle of a straight text, the kind of a curve and its points as numbers, the centre of the pattern, a custom size of the bar, the divisions per mm and the wireframe. A node with expert settings that are not their default says so in simple mode. The faint ⚙ at the top left of the scene switches to expert mode and stays highlighted while it is on. The mode is kept in this browser, not in the link.

## How it works

Each bar is a grid of vertices on the top surface. The pattern's distance function moves every vertex along a direction that fans out with the inset, the bottom surface is offset from it and, where it helps the print, raised into ribs that support the top. Top, bottom and the side walls are stitched into one closed, outward-facing triangle mesh.

That closed mesh is what gets exported. The preview draws the same bar split up in parts, so each part has its own normals: the pattern is baked on the GPU into a _top surface_ (two float textures holding the location and the normal of every top vertex) whenever the settings change. The vertices of the preview have no location of their own, they only refer to a vertex of that top surface: the top takes its location and normal from it, the side walls take their top edge from it and share one normal per wall (they are planes, tilted by the inset), and the bottom is offset from it. Drawing a bar is then only a texture lookup per vertex. Without float render targets the preview falls back to the exported mesh.

SVG shapes and text are drawn on a canvas and turned into signed distance fields with an exact distance transform. The fields are sampled by the same formula in the bake shader (as textures) and in the exported mesh. The detail they show is limited by the divisions per mm of the bar.

## Development

This is a [bun](https://bun.sh) project built with [Vite](https://vite.dev).

```sh
bun install        # install dependencies
bun dev            # dev server at http://localhost:5173/chocolade-chaud/
bun run test       # unit and component tests (vitest, components in jsdom)
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

- `src/geometry` is the engine-free geometry core: distance methods (`sdMethods.ts`), the pattern tree with its evaluation, edits and formula (`sdf/`), SVG and text distance fields (`svg/`, `text/`, `field.ts`), base curves (`curve.ts`), mesh generation on typed arrays (`createMesh.ts`), the bars and their layout (`grid.ts`), the tablet sizes and the layouts of a combined tablet (`tablets.ts`), the chocolates (`chocolates.ts`) and the binary STL / OBJ serializers (`exportGeometry.ts`). It must not import the render engine, a test guards this.
- `src/geometry/meshWorker.ts` and `src/hooks/useGridMeshes.ts` generate the meshes in a web worker, so editing settings never blocks the UI. The scene and the exports share the generated meshes.
- `src/three` renders the meshes with three.js via react-three-fiber (drei for camera fitting and orbit controls). `CurveEditor.tsx` draws and edits the base curve of a text node, `ViewController.tsx` switches between the orbiting view and the orthographic edit view. `shaders/sdfCodegen.ts` generates the GLSL of the pattern tree: its structure is compiled into the shader and its numbers are uniforms, so only structural edits compile a new shader.
- `src/export` downloads the exported files, several bars are zipped into one download.
- `src/state` packs the state for the url and local storage (`schema.ts`, `persist.ts`) and holds the undo / redo stack (`history.ts`). The schema of the current version is the one definition of the ranges of the numbers: the panels look their fields up in it with `numberField('height')`, `numberField('root.size')` (densing's `getFieldByPath`), only the label and step of a field are in the panel. Older versions are frozen as they were written; a test pins a fingerprint of every version, so a changed range needs a new version.
- `src/Components` holds the panels in plain HTML, styled by `src/ui.css`: the form primitives in `ui.tsx` (fields that take their numbers from the settings, `Choices` for every group of buttons), simple and expert mode in `mode.tsx` (`<Expert>` and `<Simple>`, and `<ExpertNotice>`, which lists the changed settings simple mode hides), the folding panels in `panels.tsx`, and the toolbar and settings sheet in `Toolbar.tsx`. The pattern editors are in `pattern/`: every kind of node in one registry (`kinds.tsx`) with its own inspector (`inspectors.tsx`), and the state of the editing in `patternEditor.ts`.
