import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  Niivue,
  SLICE_TYPE,
  type NVConfigOptions,
  type NVImage,
} from "@niivue/niivue";
import type { ImageFromUrlOptions } from "./types";
import { defaultViewerOptions, defaultMouseConfig } from "./nvscene-controller";

export interface NvViewerProps {
  volumes?: ImageFromUrlOptions[];
  options?: Partial<NVConfigOptions>;
  sliceType?: number;
  className?: string;
  style?: CSSProperties;
  onLocationChange?: (data: unknown) => void;
  onImageLoaded?: (volume: NVImage) => void;
  onError?: (error: unknown) => void;
}

export const NvViewer = ({
  volumes,
  options,
  sliceType = SLICE_TYPE.AXIAL,
  className,
  style,
  onLocationChange,
  onImageLoaded,
  onError,
}: NvViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const nvRef = useRef<Niivue | null>(null);
  const loadedUrlsRef = useRef<Set<string>>(new Set());

  // Store latest callbacks in refs
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;
  const onImageLoadedRef = useRef(onImageLoaded);
  onImageLoadedRef.current = onImageLoaded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Initialize Niivue instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.className = "niivue-canvas";
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    const mergedOptions: Partial<NVConfigOptions> = {
      ...defaultViewerOptions,
      ...options,
    };

    const nv = new Niivue(mergedOptions);
    nv.setMouseEventConfig(defaultMouseConfig);

    nv.onLocationChange = (data: unknown) => {
      onLocationChangeRef.current?.(data);
    };
    nv.onImageLoaded = (vol: NVImage) => {
      onImageLoadedRef.current?.(vol);
    };

    nv.attachToCanvas(canvas);
    nv.setSliceType(sliceType);
    nvRef.current = nv;

    const ro = new ResizeObserver(() => {
      nv.resizeListener();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      // Dispose WebGL context
      const gl = nv._gl;
      if (gl) {
        const ext = gl.getExtension("WEBGL_lose_context");
        if (ext) ext.loseContext();
      }
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
      nvRef.current = null;
      loadedUrlsRef.current.clear();
    };
  }, []); // intentionally stable — options changes don't recreate the instance

  // Handle sliceType changes
  useEffect(() => {
    nvRef.current?.setSliceType(sliceType);
  }, [sliceType]);

  // Handle volume diffing
  useEffect(() => {
    const nv = nvRef.current;
    if (!nv) return;

    const desiredUrls = new Set((volumes ?? []).map((v) => v.url));
    const currentUrls = loadedUrlsRef.current;

    // Remove volumes no longer in the list
    for (const url of currentUrls) {
      if (!desiredUrls.has(url)) {
        const vol = nv.volumes.find(
          (v: NVImage) => v.url === url || v.name === url,
        );
        if (vol) nv.removeVolume(vol);
        currentUrls.delete(url);
      }
    }

    // Add new volumes
    for (const opts of volumes ?? []) {
      if (!currentUrls.has(opts.url)) {
        currentUrls.add(opts.url);
        nv.addVolumeFromUrl(opts).catch((err: unknown) => {
          currentUrls.delete(opts.url);
          onErrorRef.current?.(err);
        });
      }
    }
  }, [volumes]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", ...style }}
    />
  );
};
