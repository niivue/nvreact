import { describe, test, expect, beforeEach, mock } from "bun:test";
import { render } from "@testing-library/react";
import React from "react";
import {
  registerNiivueMock,
  clearMockInstances,
  mockInstances,
} from "./__mocks__/niivue";

registerNiivueMock();

import { NvViewer } from "./nvviewer";

describe("NvViewer", () => {
  beforeEach(() => {
    clearMockInstances();
  });

  test("renders a container div with position relative", () => {
    const { container } = render(<NvViewer />);
    const div = container.firstElementChild as HTMLElement;
    expect(div).toBeDefined();
    expect(div.tagName).toBe("DIV");
    expect(div.style.position).toBe("relative");
  });

  test("creates a canvas element inside the container", () => {
    const { container } = render(<NvViewer />);
    const div = container.firstElementChild as HTMLElement;
    const canvas = div.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas!.className).toBe("niivue-canvas");
  });

  test("creates a Niivue instance and attaches to canvas", () => {
    render(<NvViewer />);
    expect(mockInstances.length).toBeGreaterThanOrEqual(1);
    const nv = mockInstances[0]!;
    expect(nv.attachToCanvas).toHaveBeenCalled();
  });

  test("calls setMouseEventConfig on the Niivue instance", () => {
    render(<NvViewer />);
    const nv = mockInstances[0]!;
    expect(nv.setMouseEventConfig).toHaveBeenCalled();
  });

  test("calls setSliceType with default AXIAL", () => {
    render(<NvViewer />);
    const nv = mockInstances[0]!;
    // SLICE_TYPE.AXIAL = 0
    expect(nv.setSliceType).toHaveBeenCalledWith(0);
  });

  test("calls setSliceType with provided sliceType", () => {
    // SLICE_TYPE.CORONAL = 1
    render(<NvViewer sliceType={1} />);
    const nv = mockInstances[0]!;
    expect(nv.setSliceType).toHaveBeenCalledWith(1);
  });

  test("passes className to the container div", () => {
    const { container } = render(<NvViewer className="my-viewer" />);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toBe("my-viewer");
  });

  test("passes style to the container div (merged with position: relative)", () => {
    const { container } = render(
      <NvViewer style={{ width: "500px", height: "400px" }} />,
    );
    const div = container.firstElementChild as HTMLElement;
    expect(div.style.position).toBe("relative");
    expect(div.style.width).toBe("500px");
    expect(div.style.height).toBe("400px");
  });

  test("cleans up canvas on unmount", () => {
    const { container, unmount } = render(<NvViewer />);
    const div = container.firstElementChild as HTMLElement;

    // Canvas should exist before unmount
    expect(div.querySelector("canvas")).not.toBeNull();

    unmount();

    // After unmount, the canvas should be removed from the container
    // (cleanup removes it from DOM)
    expect(div.querySelector("canvas")).toBeNull();
  });

  test("volume diffing: adding volumes calls addVolumeFromUrl", () => {
    const volumes = [{ url: "brain.nii" }];
    render(<NvViewer volumes={volumes} />);
    const nv = mockInstances[0]!;
    expect(nv.addVolumeFromUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: "brain.nii" }),
    );
  });

  test("volume diffing: adding multiple volumes", () => {
    const volumes = [{ url: "a.nii" }, { url: "b.nii" }];
    render(<NvViewer volumes={volumes} />);
    const nv = mockInstances[0]!;
    expect(nv.addVolumeFromUrl).toHaveBeenCalledTimes(2);
  });

  test("volume diffing: no volumes results in no addVolumeFromUrl calls", () => {
    render(<NvViewer />);
    const nv = mockInstances[0]!;
    expect(nv.addVolumeFromUrl).not.toHaveBeenCalled();
  });

  test("wires onLocationChange callback to Niivue", () => {
    const onLocationChange = mock((_data: unknown) => {});
    render(<NvViewer onLocationChange={onLocationChange} />);
    const nv = mockInstances[0]!;

    // Simulate Niivue calling onLocationChange
    if (nv.onLocationChange) {
      nv.onLocationChange({ x: 1, y: 2, z: 3 });
    }
    expect(onLocationChange).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 });
  });

  test("wires onImageLoaded callback to Niivue", () => {
    const onImageLoaded = mock((_vol: unknown) => {});
    render(<NvViewer onImageLoaded={onImageLoaded} />);
    const nv = mockInstances[0]!;

    // Simulate Niivue calling onImageLoaded
    if (nv.onImageLoaded) {
      nv.onImageLoaded({ url: "test.nii" });
    }
    expect(onImageLoaded).toHaveBeenCalledWith({ url: "test.nii" });
  });
});
