# nv-react

Lightweight React bindings for Niivue with a multi-instance NvSceneController and canvas slice-layout presets.

## Install

```bash
npm install nv-react @niivue/niivue react react-dom
```

## Usage

```tsx
import { useMemo } from "react";
import { NvScene, NvSceneController, defaultLayouts } from "nv-react";

export function App() {
  const scene = useMemo(() => new NvSceneController(defaultLayouts), []);
  return <NvScene scene={scene} style={{ height: 600 }} />;
}
```

## More examples

### Add/remove viewers

```tsx
scene.addViewer();
scene.removeViewer(0);
```

### Switch layouts

```tsx
// Layout keys are rows x columns (1x2 = 1 row, 2 columns).
scene.setLayout("2x2");
```

### Per-viewer slice layouts

```tsx
import { defaultSliceLayouts } from "nv-react";

scene.setViewerSliceLayout(0, defaultSliceLayouts["sag-left"].layout);
```

### Broadcast interactions

```tsx
scene.setBroadcasting(true);
```

## Slice layouts

```tsx
import { defaultSliceLayouts } from "nv-react";

scene.setViewerSliceLayout(0, defaultSliceLayouts["render-hero"].layout);
```

## API (short)

- `NvScene`: React container that binds a `NvSceneController` to a DOM element.
- `NvSceneController`: manages multiple Niivue instances and container layout.
- `NvSceneController#setLayout(name)`: set the multi-viewer layout.
- `NvSceneController#addViewer()` / `NvSceneController#removeViewer(index)`: manage viewer instances.
- `NvSceneController#setViewerSliceLayout(index, layout)`: set a per-viewer slice layout.
- `NvSceneController#setBroadcasting(enabled)`: sync interactions across viewers.
- `defaultLayouts`: preset viewer layouts.
- `defaultSliceLayouts`: preset per-viewer slice layouts.

## Build (local)

```bash
bun run build:package
```

## Publish

```bash
npm whoami
bun run build:package
npm pack --dry-run
npm publish --access public
```
