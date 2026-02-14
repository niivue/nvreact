import "./index.css";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  NvScene,
  NvViewer,
  NvSceneProvider,
  defaultLayouts,
  defaultSliceLayouts,
  useScene,
  useSceneEvent,
} from "@niivue/nvreact";

const MNI_VOLUME = {
  url: "https://niivue.github.io/niivue-demo-images/mni152.nii.gz",
  name: "mni152",
};

type DemoMode = "scene" | "viewer";

export function App() {
  const { scene, snapshot } = useScene();
  const [layoutName, setLayoutName] = useState<string>("2x2");
  const [sliceLayoutEnabled, setSliceLayoutEnabled] = useState(false);
  const [selectedViewerIndex, setSelectedViewerIndex] = useState(0);
  const [sliceLayoutName, setSliceLayoutName] =
    useState<string>("axial-hero");
  const [demoMode, setDemoMode] = useState<DemoMode>("scene");
  const [locationStrings, setLocationStrings] = useState<Record<number, string>>({});

  // Log events via useSceneEvent
  useSceneEvent(scene, "viewerCreated", (_nv, index) => {
    console.log(`[event] viewerCreated: index=${index}`);
  });

  useSceneEvent(scene, "viewerRemoved", (index) => {
    console.log(`[event] viewerRemoved: index=${index}`);
    setLocationStrings((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  });

  useSceneEvent(scene, "imageLoaded", (viewerIndex, volume) => {
    console.log(
      `[event] imageLoaded: viewer=${viewerIndex}, name=${volume.name}`,
    );
  });

  useSceneEvent(scene, "locationChange", (viewerIndex, data) => {
    const loc = data as { string?: string };
    if (loc.string) {
      setLocationStrings((prev) => ({ ...prev, [viewerIndex]: loc.string! }));
    }
  });

  // Load volumes for any viewer that doesn't have one yet.
  // This is done via useEffect on viewerCount rather than the viewerCreated
  // event, because React runs child effects (NvScene) before parent effects,
  // so the event listener may not be registered when the first viewer is created.
  const loadedViewerIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (let i = 0; i < snapshot.viewerCount; i++) {
      const viewer = scene.viewers[i];
      if (viewer && !loadedViewerIds.current.has(viewer.id)) {
        loadedViewerIds.current.add(viewer.id);
        scene.loadVolume(i, MNI_VOLUME).catch(console.error);
      }
    }
  }, [scene, snapshot.viewerCount]);

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
        ? (defaultSliceLayouts[sliceLayoutName]?.layout ?? null)
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

  const handleDemoModeToggle = useCallback(() => {
    setDemoMode((m) => (m === "scene" ? "viewer" : "scene"));
  }, []);

  return (
    <NvSceneProvider scene={scene}>
      <div className="app">
        <header className="app-toolbar">
          <div className="app-title">
            <h1>{demoMode === "scene" ? "NvScene" : "NvViewer"}</h1>
            <span>
              {demoMode === "scene"
                ? `${snapshot.viewerCount} instances`
                : "standalone"}
              {snapshot.isLoading ? " (loading...)" : ""}
            </span>
          </div>
          <div className="app-actions">
            <button type="button" onClick={handleDemoModeToggle}>
              {demoMode === "scene"
                ? "Switch to NvViewer"
                : "Switch to NvScene"}
            </button>
            {demoMode === "scene" && (
              <>
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
              </>
            )}
          </div>
        </header>
        {demoMode === "scene" && (
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
        )}
        {demoMode === "scene" ? (
          <>
            <NvScene
              scene={scene}
              className="niivue-container"
              initialLayout={layoutName}
            />
            {snapshot.viewerCount > 0 && (
              <footer className="location-footer">
                {Array.from({ length: snapshot.viewerCount }, (_, i) => (
                  <div key={i} className="location-row">
                    <span className="location-label">Viewer {i + 1}</span>
                    <span className="location-value">
                      {locationStrings[i] ?? "—"}
                    </span>
                  </div>
                ))}
              </footer>
            )}
          </>
        ) : (
          <NvViewer
            volumes={[MNI_VOLUME]}
            className="niivue-container"
            onLocationChange={(data) =>
              console.log("[NvViewer] location:", data)
            }
            onImageLoaded={(vol) =>
              console.log("[NvViewer] loaded:", vol.name)
            }
            onError={(err) => console.error("[NvViewer] error:", err)}
          />
        )}
      </div>
    </NvSceneProvider>
  );
}

export default App;
