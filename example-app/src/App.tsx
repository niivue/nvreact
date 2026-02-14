import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import {
  NvScene,
  NvSceneController,
  defaultLayouts,
  defaultSliceLayouts,
} from "nv-react";
import "./index.css";

export function App() {
  const scene = useMemo(() => new NvSceneController(defaultLayouts), []);
  const snapshot = useSyncExternalStore(
    scene.subscribe,
    scene.getSnapshot,
    scene.getSnapshot,
  );
  const [layoutName, setLayoutName] = useState<string>("2x2");
  const [sliceLayoutEnabled, setSliceLayoutEnabled] = useState(false);
  const [selectedViewerIndex, setSelectedViewerIndex] = useState(0);
  const [sliceLayoutName, setSliceLayoutName] =
    useState<string>("axial-hero");

  useEffect(() => {
    if (selectedViewerIndex >= snapshot.viewerCount) {
      setSelectedViewerIndex(Math.max(0, snapshot.viewerCount - 1));
    }
  }, [selectedViewerIndex, snapshot.viewerCount]);

  const handleAdd = useCallback(() => {
    if (scene.canAddViewer()) {
      scene.addViewer();
    }
  }, [scene]);

  const handleRemove = useCallback(() => {
    if (snapshot.viewerCount > 0) {
      scene.removeViewer(snapshot.viewerCount - 1);
    }
  }, [scene, snapshot.viewerCount]);

  const handleLayoutChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextLayout = event.target.value;
      setLayoutName(nextLayout);
      scene.setLayout(nextLayout);
    },
    [scene],
  );

  const handleBroadcastToggle = useCallback(() => {
    scene.setBroadcasting(!snapshot.isBroadcasting);
  }, [scene, snapshot.isBroadcasting]);

  const handleSliceLayoutToggle = useCallback(() => {
    const nextEnabled = !sliceLayoutEnabled;
    setSliceLayoutEnabled(nextEnabled);
    const layout = defaultSliceLayouts[sliceLayoutName]?.layout ?? null;
    scene.setViewerSliceLayout(
      selectedViewerIndex,
      nextEnabled ? layout : null,
    );
  }, [scene, selectedViewerIndex, sliceLayoutEnabled, sliceLayoutName]);

  const handleViewerChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextIndex = Number(event.target.value);
      setSelectedViewerIndex(nextIndex);
      const layout = sliceLayoutEnabled
        ? defaultSliceLayouts[sliceLayoutName]?.layout ?? null
        : null;
      scene.setViewerSliceLayout(nextIndex, layout);
    },
    [scene, sliceLayoutEnabled, sliceLayoutName],
  );

  const handleSliceLayoutChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextLayout = event.target.value;
      setSliceLayoutName(nextLayout);
      if (!sliceLayoutEnabled) return;
      const layout = defaultSliceLayouts[nextLayout]?.layout ?? null;
      scene.setViewerSliceLayout(selectedViewerIndex, layout);
    },
    [scene, selectedViewerIndex, sliceLayoutEnabled],
  );

  return (
    <div className="app">
      <header className="app-toolbar">
        <div className="app-title">
          <h1>nv-react example</h1>
          <span>{snapshot.viewerCount} instances</span>
        </div>
        <div className="app-actions">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!scene.canAddViewer()}
          >
            Add instance
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={snapshot.viewerCount === 0}
          >
            Remove instance
          </button>
        </div>
      </header>
      <section className="app-controls">
        <label className="control-group">
          <span className="control-label">Layout</span>
          <select value={layoutName} onChange={handleLayoutChange}>
            {Object.entries(defaultLayouts).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </label>
        <label className="control-group">
          <span className="control-label">Viewer</span>
          <select
            value={selectedViewerIndex}
            onChange={handleViewerChange}
            disabled={snapshot.viewerCount === 0}
          >
            {Array.from({ length: snapshot.viewerCount }, (_, index) => (
              <option key={index} value={index}>
                {index + 1}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleBroadcastToggle}>
          {snapshot.isBroadcasting ? "Disable sync" : "Enable sync"}
        </button>
        <button type="button" onClick={handleSliceLayoutToggle}>
          {sliceLayoutEnabled ? "Standard slices" : "Custom slices"}
        </button>
        <label className="control-group">
          <span className="control-label">Slice layout</span>
          <select
            value={sliceLayoutName}
            onChange={handleSliceLayoutChange}
            disabled={!sliceLayoutEnabled}
          >
            {Object.entries(defaultSliceLayouts).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <NvScene
        scene={scene}
        className="niivue-container"
        initialLayout={layoutName}
      />
    </div>
  );
}

export default App;
