import {
  DRAG_MODE,
  Niivue,
  SLICE_TYPE,
  type NVConfigOptions,
  type NVImage,
  SHOW_RENDER,
} from "@niivue/niivue";
import type { LayoutConfig } from "./layouts";
import { defaultLayouts } from "./layouts";
import type { NvSceneEventMap, ViewerState, ImageFromUrlOptions } from "./types";

export { SLICE_TYPE };

export type NiivueCallback = (nv: Niivue, index: number) => void;

export interface ViewerSlot {
  id: string;
  niivue: Niivue;
  canvasElement: HTMLCanvasElement;
  containerDiv: HTMLDivElement;
}

export interface NvSceneControllerSnapshot {
  currentLayout: string;
  viewerCount: number;
  slots: number;
  isBroadcasting: boolean;
  isLoading: boolean;
  viewerStates: ViewerState[];
}

export interface BroadcastOptions {
  "2d": boolean;
  "3d": boolean;
}

export interface SliceLayoutTile {
  sliceType: number;
  position: [number, number, number, number]; // [left, top, width, height]
}

export interface SliceLayoutConfig {
  label: string;
  layout: SliceLayoutTile[];
}

/**
 * Default slice layout: Axial as hero (80% height), coronal and sagittal below (20% height each, side by side)
 */
export const defaultSliceLayout: SliceLayoutTile[] = [
  { sliceType: SLICE_TYPE.AXIAL, position: [0, 0, 1.0, 0.8] },
  { sliceType: SLICE_TYPE.CORONAL, position: [0, 0.8, 0.5, 0.2] },
  { sliceType: SLICE_TYPE.SAGITTAL, position: [0.5, 0.8, 0.5, 0.2] },
];

/**
 * Split view: sagittal left, coronal/axial stacked on the right.
 */
export const splitSliceLayout: SliceLayoutTile[] = [
  { sliceType: SLICE_TYPE.SAGITTAL, position: [0, 0, 0.5, 1.0] },
  { sliceType: SLICE_TYPE.CORONAL, position: [0.5, 0, 0.5, 0.5] },
  { sliceType: SLICE_TYPE.AXIAL, position: [0.5, 0.5, 0.5, 0.5] },
];

/**
 * Tri-fan: three equal horizontal panels.
 */
export const triSliceLayout: SliceLayoutTile[] = [
  { sliceType: SLICE_TYPE.AXIAL, position: [0, 0, 0.333, 1.0] },
  { sliceType: SLICE_TYPE.CORONAL, position: [0.333, 0, 0.333, 1.0] },
  { sliceType: SLICE_TYPE.SAGITTAL, position: [0.666, 0, 0.334, 1.0] },
];

/**
 * Stacked: three equal vertical stacks.
 */
export const stackedSliceLayout: SliceLayoutTile[] = [
  { sliceType: SLICE_TYPE.AXIAL, position: [0, 0, 1.0, 0.333] },
  { sliceType: SLICE_TYPE.CORONAL, position: [0, 0.333, 1.0, 0.333] },
  { sliceType: SLICE_TYPE.SAGITTAL, position: [0, 0.666, 1.0, 0.334] },
];

/**
 * Quad: axial/coronal/sagittal with a render tile.
 */
export const quadSliceLayout: SliceLayoutTile[] = [
  { sliceType: SLICE_TYPE.AXIAL, position: [0, 0, 0.5, 0.5] },
  { sliceType: SLICE_TYPE.CORONAL, position: [0.5, 0, 0.5, 0.5] },
  { sliceType: SLICE_TYPE.SAGITTAL, position: [0, 0.5, 0.5, 0.5] },
  { sliceType: SLICE_TYPE.RENDER, position: [0.5, 0.5, 0.5, 0.5] },
];

/**
 * Hero render with three small orthogonal slices below.
 */
export const heroRenderSliceLayout: SliceLayoutTile[] = [
  { sliceType: SLICE_TYPE.RENDER, position: [0, 0, 1.0, 0.7] },
  { sliceType: SLICE_TYPE.AXIAL, position: [0, 0.7, 0.333, 0.3] },
  { sliceType: SLICE_TYPE.CORONAL, position: [0.333, 0.7, 0.333, 0.3] },
  { sliceType: SLICE_TYPE.SAGITTAL, position: [0.666, 0.7, 0.334, 0.3] },
];

export const defaultSliceLayouts: Record<string, SliceLayoutConfig> = {
  "axial-hero": {
    label: "Axial Hero",
    layout: defaultSliceLayout,
  },
  "sag-left": {
    label: "Sag Left Split",
    layout: splitSliceLayout,
  },
  "tri-h": {
    label: "Tri Horizontal",
    layout: triSliceLayout,
  },
  "tri-v": {
    label: "Tri Stacked",
    layout: stackedSliceLayout,
  },
  "quad-render": {
    label: "Quad Render",
    layout: quadSliceLayout,
  },
  "render-hero": {
    label: "Render Hero",
    layout: heroRenderSliceLayout,
  },
};

type Listener = () => void;

export const defaultViewerOptions: Partial<NVConfigOptions> = {
  crosshairGap: 5,
};

export const defaultMouseConfig = {
  leftButton: {
    primary: DRAG_MODE.crosshair,
  },
  rightButton: DRAG_MODE.pan,
  centerButton: DRAG_MODE.slicer3D,
};

/**
 * An NvSceneController is a declarative representation of what we want to render with Niivue.
 *
 * A scene can contain multiple Niivue instances. Each Niivue instance has its own
 * canvas element for the WebGL2 context. All canvas elements are wrapped in container
 * divs that are children of the main scene container element.
 *
 * Canvas elements are added/removed on-demand based on the scene definition.
 *
 * The scene layout controls the position of each canvas via layout functions that
 * return absolute positioning styles. The scene container is responsive and maintains
 * the requested layout proportionally.
 */
export class NvSceneController {
  containerElement: HTMLElement | null = null;
  viewers: ViewerSlot[] = [];
  currentLayout: string = "1x1";
  slots: number;
  layouts: Record<string, LayoutConfig>;
  onViewerCreated?: NiivueCallback;

  private listeners = new Set<Listener>();
  private snapshotCache: NvSceneControllerSnapshot | null = null;
  private nextId = 0;
  private viewersById = new Map<string, ViewerSlot>();
  private broadcasting = false;
  private broadcastOptions: BroadcastOptions = { "2d": true, "3d": true };
  private viewerSliceLayouts = new Map<string, SliceLayoutTile[] | null>();
  private viewerDefaults: Partial<NVConfigOptions>;

  // Event system
  private eventListeners = new Map<string, Set<Function>>();

  // Loading/error state
  private loadingCounts = new Map<string, number>();
  private viewerErrors = new Map<string, unknown[]>();

  constructor(
    layouts: Record<string, LayoutConfig> = defaultLayouts,
    viewerDefaults: Partial<NVConfigOptions> = {},
  ) {
    this.layouts = layouts;
    this.slots = this.layouts[this.currentLayout]?.slots ?? 1;
    this.viewerDefaults = viewerDefaults;
  }

  // --- Event system ---

  on<E extends keyof NvSceneEventMap>(
    event: E,
    cb: NvSceneEventMap[E],
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(cb);
    return () => this.off(event, cb);
  }

  off<E extends keyof NvSceneEventMap>(
    event: E,
    cb: NvSceneEventMap[E],
  ): void {
    this.eventListeners.get(event)?.delete(cb);
  }

  private emit<E extends keyof NvSceneEventMap>(
    event: E,
    ...args: Parameters<NvSceneEventMap[E]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;
    for (const cb of listeners) {
      (cb as (...a: unknown[]) => void)(...args);
    }
  }

  // --- Subscribe / snapshot ---

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): NvSceneControllerSnapshot => {
    if (!this.snapshotCache) {
      const viewerStates: ViewerState[] = this.viewers.map((v) => ({
        id: v.id,
        loading: this.loadingCounts.get(v.id) ?? 0,
        errors: this.viewerErrors.get(v.id) ?? [],
      }));
      this.snapshotCache = {
        currentLayout: this.currentLayout,
        viewerCount: this.viewers.length,
        slots: this.slots,
        isBroadcasting: this.broadcasting,
        isLoading: viewerStates.some((s) => s.loading > 0),
        viewerStates,
      };
    }
    return this.snapshotCache;
  };

  private notify(): void {
    this.snapshotCache = null;
    this.listeners.forEach((listener) => listener());
  }

  // --- Container & layout ---

  setContainerElement(element: HTMLElement | null): void {
    this.containerElement = element;
    if (element) {
      this.updateLayout();
    }
  }

  setLayout(layoutName: string): void {
    const layoutConfig = this.layouts[layoutName];
    if (!layoutConfig) return;

    this.currentLayout = layoutName;
    this.slots = layoutConfig.slots;

    // Remove excess viewers if new layout has fewer slots
    while (this.viewers.length > this.slots) {
      this.removeViewer(this.viewers.length - 1, false);
    }

    // Ensure at least one viewer exists when a container is present
    if (this.viewers.length === 0 && this.containerElement) {
      this.addViewer();
    }

    this.updateLayout();
    this.notify();
  }

  updateLayout(): void {
    if (!this.containerElement) return;

    const layoutConfig = this.layouts[this.currentLayout];
    if (!layoutConfig) return;

    this.viewers.forEach((viewer, index) => {
      const position = layoutConfig.layoutFunction(
        this.containerElement!,
        index,
        this.viewers.length,
      );
      Object.assign(viewer.containerDiv.style, {
        position: "absolute",
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
      });
    });
  }

  canAddViewer(): boolean {
    return this.viewers.length < this.slots;
  }

  getNiivue(index: number): Niivue | undefined {
    return this.viewers[index]?.niivue;
  }

  getAllNiivue(): Niivue[] {
    return this.viewers.map((viewer) => viewer.niivue);
  }

  forEachNiivue(callback: NiivueCallback): void {
    this.viewers.forEach((viewer, i) => callback(viewer.niivue, i));
  }

  setBroadcasting(enabled: boolean, options?: Partial<BroadcastOptions>): void {
    this.broadcasting = enabled;
    if (options) {
      this.broadcastOptions = { ...this.broadcastOptions, ...options };
    }

    if (enabled) {
      this.viewers.forEach((viewer) => {
        const others = this.viewers
          .filter((v) => v.id !== viewer.id)
          .map((v) => v.niivue);
        viewer.niivue.broadcastTo(others, this.broadcastOptions);
      });
    } else {
      this.viewers.forEach((viewer) => {
        viewer.niivue.broadcastTo([], this.broadcastOptions);
      });
    }

    this.notify();
  }

  isBroadcasting(): boolean {
    return this.broadcasting;
  }

  setViewerSliceLayout(index: number, layout: SliceLayoutTile[] | null): void {
    const viewer = this.viewers[index];
    if (!viewer) return;
    this.viewerSliceLayouts.set(viewer.id, layout);
    this.applySliceLayout(viewer.niivue, layout);
    this.notify();
  }

  getViewerSliceLayout(index: number): SliceLayoutTile[] | null {
    const viewer = this.viewers[index];
    if (!viewer) return null;
    return this.viewerSliceLayouts.get(viewer.id) ?? null;
  }

  private applySliceLayout(nv: Niivue, layout: SliceLayoutTile[] | null): void {
    if (layout) {
      nv.setCustomLayout(layout);
    } else {
      nv.clearCustomLayout();
      nv.setSliceType(SLICE_TYPE.AXIAL);
      nv.opts.multiplanarShowRender = SHOW_RENDER.NEVER;
    }
  }

  getNiivueById(id: string): Niivue | undefined {
    return this.viewersById.get(id)?.niivue;
  }

  getViewerById(id: string): ViewerSlot | undefined {
    return this.viewersById.get(id);
  }

  // --- Volume management ---

  async loadVolume(
    index: number,
    opts: ImageFromUrlOptions,
  ): Promise<NVImage> {
    const viewer = this.viewers[index];
    if (!viewer) throw new Error(`No viewer at index ${index}`);

    this.incrementLoading(viewer.id);
    try {
      const image = await viewer.niivue.addVolumeFromUrl(opts);
      this.emit("volumeAdded", index, opts, image);
      return image;
    } catch (err) {
      this.addError(viewer.id, err);
      this.emit("error", index, err);
      throw err;
    } finally {
      this.decrementLoading(viewer.id);
    }
  }

  async loadVolumes(
    index: number,
    opts: ImageFromUrlOptions[],
  ): Promise<NVImage[]> {
    const results: NVImage[] = [];
    for (const o of opts) {
      results.push(await this.loadVolume(index, o));
    }
    return results;
  }

  removeVolume(index: number, url: string): void {
    const viewer = this.viewers[index];
    if (!viewer) return;
    const nv = viewer.niivue;
    const vol = nv.volumes.find(
      (v: NVImage) => v.url === url || v.name === url,
    );
    if (vol) {
      nv.removeVolume(vol);
      this.emit("volumeRemoved", index, url);
      this.notify();
    }
  }

  private incrementLoading(id: string): void {
    this.loadingCounts.set(id, (this.loadingCounts.get(id) ?? 0) + 1);
    this.notify();
  }

  private decrementLoading(id: string): void {
    const count = (this.loadingCounts.get(id) ?? 1) - 1;
    this.loadingCounts.set(id, Math.max(0, count));
    this.notify();
  }

  private addError(id: string, error: unknown): void {
    const errors = this.viewerErrors.get(id) ?? [];
    errors.push(error);
    this.viewerErrors.set(id, errors);
  }

  // --- Viewer lifecycle ---

  addViewer(options?: Partial<NVConfigOptions>): ViewerSlot {
    if (!this.containerElement) {
      throw new Error("Container element not set");
    }

    if (!this.canAddViewer()) {
      throw new Error(`Cannot add viewer: slot limit of ${this.slots} reached`);
    }

    const containerDiv = document.createElement("div");
    containerDiv.className = "niivue-canvas-container";

    const canvas = document.createElement("canvas");
    canvas.className = "niivue-canvas";
    containerDiv.appendChild(canvas);

    this.containerElement.appendChild(containerDiv);

    const mergedOptions: Partial<NVConfigOptions> = {
      ...defaultViewerOptions,
      ...this.viewerDefaults,
      ...options,
    };

    const niivue = new Niivue(mergedOptions);
    niivue.setMouseEventConfig(defaultMouseConfig);
    niivue.attachToCanvas(canvas);

    const id = `nv-${this.nextId++}`;
    this.viewerSliceLayouts.set(id, null);
    this.loadingCounts.set(id, 0);
    this.viewerErrors.set(id, []);

    const viewer: ViewerSlot = {
      id,
      niivue,
      canvasElement: canvas,
      containerDiv,
    };

    this.viewers.push(viewer);
    this.viewersById.set(id, viewer);
    this.updateLayout();

    // Apply the current slice layout (default axial).
    this.applySliceLayout(niivue, null);

    // Wire Niivue callbacks to event system
    const index = this.viewers.length - 1;
    niivue.onLocationChange = (data: unknown) => {
      this.emit("locationChange", index, data);
    };
    niivue.onImageLoaded = (vol: NVImage) => {
      this.emit("imageLoaded", index, vol);
    };

    // Update broadcasting to include new viewer
    if (this.broadcasting) {
      this.setBroadcasting(true);
    }

    // Call the onViewerCreated callback if provided
    this.onViewerCreated?.(niivue, index);
    this.emit("viewerCreated", niivue, index);

    this.notify();

    return viewer;
  }

  removeViewer(index: number, shouldNotify = true): void {
    if (index < 0 || index >= this.viewers.length) return;

    const viewer = this.viewers[index];
    if (!viewer) return;

    // Remove from ID map
    this.viewersById.delete(viewer.id);
    this.viewerSliceLayouts.delete(viewer.id);
    this.loadingCounts.delete(viewer.id);
    this.viewerErrors.delete(viewer.id);

    // Properly dispose of WebGL context to free up resources
    this.disposeViewer(viewer);

    viewer.containerDiv.remove();
    this.viewers.splice(index, 1);
    this.updateLayout();

    // Update broadcasting for remaining viewers
    if (this.broadcasting && this.viewers.length > 0) {
      this.setBroadcasting(true);
    }

    this.emit("viewerRemoved", index);

    if (shouldNotify) {
      this.notify();
    }
  }

  private disposeViewer(viewer: ViewerSlot): void {
    const nv = viewer.niivue;
    let gl: WebGL2RenderingContext | null = nv._gl;
    if (gl) {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) {
        ext.loseContext();
      }
      gl = null;
    }
    viewer.canvasElement.width = 0;
    viewer.canvasElement.height = 0;
  }

  clearViewers(): void {
    this.broadcasting = false;
    this.viewers.forEach((viewer) => {
      this.disposeViewer(viewer);
      viewer.containerDiv.remove();
    });
    this.viewers = [];
    this.viewersById.clear();
    this.loadingCounts.clear();
    this.viewerErrors.clear();
    this.notify();
  }

  reset(): void {
    this.clearViewers();
    this.currentLayout = "1x1";
    this.slots = this.layouts[this.currentLayout]?.slots ?? 1;
    this.notify();
  }
}
