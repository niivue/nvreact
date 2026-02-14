import {
  DRAG_MODE,
  Niivue,
  SLICE_TYPE,
  type NVConfigOptions,
  SHOW_RENDER,
} from "@niivue/niivue";
import type { LayoutConfig } from "./layouts";
import { defaultLayouts } from "./layouts";

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

  constructor(layouts: Record<string, LayoutConfig> = defaultLayouts) {
    this.layouts = layouts;
    this.slots = this.layouts[this.currentLayout]?.slots ?? 1;
  }

  /**
   * Subscribe to scene changes. Returns an unsubscribe function.
   * Compatible with React's useSyncExternalStore.
   */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * Get a snapshot of the current scene state.
   * Compatible with React's useSyncExternalStore.
   */
  getSnapshot = (): NvSceneControllerSnapshot => {
    if (!this.snapshotCache) {
      this.snapshotCache = {
        currentLayout: this.currentLayout,
        viewerCount: this.viewers.length,
        slots: this.slots,
        isBroadcasting: this.broadcasting,
      };
    }
    return this.snapshotCache;
  };

  private notify(): void {
    this.snapshotCache = null;
    this.listeners.forEach((listener) => listener());
  }

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

  /**
   * Get a Niivue instance by index.
   */
  getNiivue(index: number): Niivue | undefined {
    return this.viewers[index]?.niivue;
  }

  /**
   * Get all Niivue instances as an array.
   */
  getAllNiivue(): Niivue[] {
    return this.viewers.map((viewer) => viewer.niivue);
  }

  /**
   * Execute a callback on each Niivue instance.
   */
  forEachNiivue(callback: NiivueCallback): void {
    this.viewers.forEach((viewer, i) => callback(viewer.niivue, i));
  }

  /**
   * Enable or disable bidirectional broadcasting between all viewers.
   * When enabled, interactions (pan, zoom, slice changes) sync across all viewers.
   */
  setBroadcasting(enabled: boolean, options?: Partial<BroadcastOptions>): void {
    this.broadcasting = enabled;
    if (options) {
      this.broadcastOptions = { ...this.broadcastOptions, ...options };
    }

    if (enabled) {
      // Set up bidirectional broadcasting between all viewers
      this.viewers.forEach((viewer) => {
        const others = this.viewers
          .filter((v) => v.id !== viewer.id)
          .map((v) => v.niivue);
        viewer.niivue.broadcastTo(others, this.broadcastOptions);
      });
    } else {
      // Disable broadcasting by clearing broadcast targets
      this.viewers.forEach((viewer) => {
        viewer.niivue.broadcastTo([], this.broadcastOptions);
      });
    }

    this.notify();
  }

  /**
   * Check if broadcasting is currently enabled.
   */
  isBroadcasting(): boolean {
    return this.broadcasting;
  }

  /**
   * Set a custom slice layout for a specific viewer.
   * Pass null to clear the custom layout and return to axial.
   */
  setViewerSliceLayout(index: number, layout: SliceLayoutTile[] | null): void {
    const viewer = this.viewers[index];
    if (!viewer) return;
    this.viewerSliceLayouts.set(viewer.id, layout);
    this.applySliceLayout(viewer.niivue, layout);
    this.notify();
  }

  /**
   * Get the current slice layout for a specific viewer.
   */
  getViewerSliceLayout(index: number): SliceLayoutTile[] | null {
    const viewer = this.viewers[index];
    if (!viewer) return null;
    return this.viewerSliceLayouts.get(viewer.id) ?? null;
  }

  /**
   * Apply the current slice layout to a Niivue instance.
   */
  private applySliceLayout(nv: Niivue, layout: SliceLayoutTile[] | null): void {
    if (layout) {
      nv.setCustomLayout(layout);
    } else {
      nv.clearCustomLayout();
      nv.setSliceType(SLICE_TYPE.AXIAL);
      nv.opts.multiplanarShowRender = SHOW_RENDER.NEVER;
    }
  }

  /**
   * Get a Niivue instance by its unique ID.
   */
  getNiivueById(id: string): Niivue | undefined {
    return this.viewersById.get(id)?.niivue;
  }

  /**
   * Get a ViewerSlot by its unique ID.
   */
  getViewerById(id: string): ViewerSlot | undefined {
    return this.viewersById.get(id);
  }

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
    const defaultOptions = {
      crosshairGap: 5,
    };
    const niivue = new Niivue({
      ...options,
      ...defaultOptions,
      loadingText: "virdx",
    });
    niivue.setMouseEventConfig({
      leftButton: {
        primary: DRAG_MODE.crosshair,
      },
      rightButton: DRAG_MODE.pan,
      centerButton: DRAG_MODE.slicer3D,
    });
    niivue.attachToCanvas(canvas);
    void niivue.addVolumeFromUrl({
      url: "https://niivue.github.io/niivue-demo-images/mni152.nii.gz",
      name: "mni152",
    });

    const id = `nv-${this.nextId++}`;
    this.viewerSliceLayouts.set(id, null);

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

    // Update broadcasting to include new viewer
    if (this.broadcasting) {
      this.setBroadcasting(true);
    }

    // Call the onViewerCreated callback if provided
    const index = this.viewers.length - 1;
    this.onViewerCreated?.(niivue, index);

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

    // Properly dispose of WebGL context to free up resources
    this.disposeViewer(viewer);

    viewer.containerDiv.remove();
    this.viewers.splice(index, 1);
    this.updateLayout();

    // Update broadcasting for remaining viewers
    if (this.broadcasting && this.viewers.length > 0) {
      this.setBroadcasting(true);
    }

    if (shouldNotify) {
      this.notify();
    }
  }

  private disposeViewer(viewer: ViewerSlot): void {
    const nv = viewer.niivue;
    // Get the WebGL context directly from Niivue before disposal
    let gl: WebGL2RenderingContext | null = nv._gl;
    // Explicitly lose the WebGL context to free it up
    if (gl) {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) {
        ext.loseContext();
      }
      gl = null;
    }

    // Clear canvas dimensions to help release memory
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
    this.notify();
  }

  reset(): void {
    this.clearViewers();
    this.currentLayout = "1x1";
    this.slots = this.layouts[this.currentLayout]?.slots ?? 1;
    this.notify();
  }
}
