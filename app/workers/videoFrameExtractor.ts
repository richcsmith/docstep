// WebCodecs worker: extract a frame every 2 seconds using only WebCodecs API
// No DOM, no document, no canvas

// @ts-expect-error - mp4box.all.min.js is available in the public/static path
importScripts("../../node_modules/mp4box/dist/mp4box.all.min.js"); // Ensure this file is available in your public/static path

declare const MP4Box: {
  createFile: () => MP4BoxFile;
};

// Minimal MP4BoxFile type for our usage
interface MP4BoxFile {
  onReady: ((info: MP4Info) => void) | null;
  onSamples: ((id: number, user: unknown, samples: MP4Sample[]) => void) | null;
  setExtractionOptions: (
    trackId: number,
    user: unknown,
    options: { nbSamples: number }
  ) => void;
  start: () => void;
  appendBuffer: (buffer: ArrayBuffer) => void;
  flush: () => void;
}

interface MP4Info {
  tracks: MP4Track[];
}

interface MP4Track {
  id: number;
  timescale: number;
  codec: string;
  video?: unknown;
}

interface MP4Sample {
  is_sync: boolean;
  dts: number;
  duration: number;
  data: Uint8Array;
}

interface FrameData {
  base64: string;
  timestamp: number;
  width: number;
  height: number;
  duration: number;
}

interface VideoMetadata {
  [timestamp: number]: FrameData;
}

// Helper: convert VideoFrame to base64 PNG using OffscreenCanvas (if available)
async function videoFrameToBase64(frame: VideoFrame): Promise<string> {
  // OffscreenCanvas is available in most modern browsers/workers
  const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get OffscreenCanvas context");
  ctx.drawImage(frame, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const arrayBuffer = await blob.arrayBuffer();
  // Convert to base64
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

self.onmessage = async (e: MessageEvent) => {
  const { videoData } = e.data;
  const frames: VideoMetadata = {};
  let lastFrameTime = -2_000_000; // microseconds

  try {
    // 1. Parse MP4 and extract video samples using mp4box.js
    const mp4boxFile = MP4Box.createFile();
    let videoTrackId: number | null = null;
    let videoTimescale = 0;
    const videoSamples: MP4Sample[] = [];
    let videoCodec: string | null = null;
    let readyPromiseResolve: (() => void) | null = null;
    const readyPromise = new Promise<void>((resolve) => {
      readyPromiseResolve = resolve;
    });

    mp4boxFile.onReady = (info: MP4Info) => {
      const videoTrack = info.tracks.find((t) => t.video);
      if (!videoTrack) throw new Error("No video track found");
      videoTrackId = videoTrack.id;
      videoTimescale = videoTrack.timescale;
      videoCodec = videoTrack.codec;
      mp4boxFile.setExtractionOptions(videoTrackId, null, { nbSamples: 1 });
      mp4boxFile.start();
      if (readyPromiseResolve) readyPromiseResolve();
    };

    mp4boxFile.onSamples = (
      id: number,
      user: unknown,
      samples: MP4Sample[]
    ) => {
      if (id === videoTrackId) {
        videoSamples.push(...samples);
      }
    };

    // Feed the file to mp4box.js
    const arrayBuffer = videoData as ArrayBuffer;
    (arrayBuffer as unknown as { fileStart: number }).fileStart = 0;
    mp4boxFile.appendBuffer(arrayBuffer);
    mp4boxFile.flush();
    await readyPromise;

    if (!videoTrackId || !videoCodec || videoSamples.length === 0) {
      throw new Error("Failed to extract video samples");
    }

    // 2. Set up WebCodecs decoder
    const decoder = new VideoDecoder({
      output: async (frame: VideoFrame) => {
        // Only extract every 2 seconds
        if (frame.timestamp - lastFrameTime >= 2_000_000) {
          lastFrameTime = frame.timestamp;
          const base64 = await videoFrameToBase64(frame);
          frames[frame.timestamp] = {
            base64,
            timestamp: frame.timestamp,
            width: frame.displayWidth,
            height: frame.displayHeight,
            duration: frame.duration || 0,
          };
        }
        frame.close();
      },
      error: (err) => {
        self.postMessage({ type: "error", error: err.message });
      },
    });

    decoder.configure({ codec: videoCodec });

    // 3. Feed samples to decoder
    for (const sample of videoSamples) {
      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? "key" : "delta",
        timestamp: Math.round((sample.dts / videoTimescale) * 1_000_000), // microseconds
        duration: Math.round((sample.duration / videoTimescale) * 1_000_000), // microseconds
        data: sample.data,
      });
      decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();

    self.postMessage({ type: "success", frames });
  } catch (error: unknown) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
