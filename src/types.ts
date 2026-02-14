import type { Niivue, NVImage, NVConfigOptions } from "@niivue/niivue";

export type { NVImage, NVConfigOptions };

/** Extract the ImageFromUrlOptions type from Niivue's addVolumeFromUrl method */
export type ImageFromUrlOptions = Parameters<Niivue["addVolumeFromUrl"]>[0];

export interface NvSceneEventMap {
  viewerCreated: (nv: Niivue, index: number) => void;
  viewerRemoved: (index: number) => void;
  locationChange: (viewerIndex: number, data: unknown) => void;
  imageLoaded: (viewerIndex: number, volume: NVImage) => void;
  error: (viewerIndex: number, error: unknown) => void;
  volumeAdded: (viewerIndex: number, imageOptions: ImageFromUrlOptions, image: NVImage) => void;
  volumeRemoved: (viewerIndex: number, url: string) => void;
}

export interface ViewerState {
  id: string;
  loading: number;
  errors: unknown[];
}
