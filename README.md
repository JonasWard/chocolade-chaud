# chocolade chaud!

An online configurator for chocolate bars with a 3D printable pattern. Pick the size of the bar, stack a few implicit surfaces (gyroid, Schwarz P/D, Neovius, ...) into a pattern, and export the result as STL or OBJ for printing a mould.

Live at [jonasward.github.io/chocolade-chaud](https://JonasWard.github.io/chocolade-chaud).

## Development

This is a [bun](https://bun.sh) project built with [Vite](https://vite.dev).

```sh
bun install        # install dependencies
bun dev            # dev server at http://localhost:5173/chocolade-chaud/
bun run test       # unit tests (vitest)
bun run typecheck  # tsc
bun run lint       # eslint
bun run build      # production build into build/
bun run deploy     # build and publish build/ to the gh-pages branch
```

CI runs typecheck, lint, tests and build on every push and pull request.

## Code map

- `src/geometry` is the engine-free geometry core: distance methods (`sdMethods.ts`), mesh generation on typed arrays (`createMesh.ts`), grid layouts (`grid.ts`) and the STL/OBJ exporters. It must not import the render engine, a test guards this.
- `src/geometry/meshWorker.ts` and `src/hooks/useGridMeshes.ts` generate the meshes in a web worker, so editing settings never blocks the UI. The scene and the exports share the generated meshes.
- `src/three` renders the meshes with three.js via react-three-fiber (drei for camera fitting and orbit controls).
- `src/Components` holds the settings drawer and export buttons.
