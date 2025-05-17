import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface FrameData {
  base64: string;
  timestamp: number;
  width: number;
  height: number;
  duration: number;
}

const ffmpeg = new FFmpeg();

async function transcodeToMp4H264(
  file: File,
  onProgress?: (ratio: number) => void
): Promise<Uint8Array> {
  if (!ffmpeg.loaded) {
    await ffmpeg.load();
  }
  await ffmpeg.writeFile("input", await fetchFile(file));
  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(progress);
  };
  ffmpeg.on("progress", progressHandler);
  await ffmpeg.exec([
    "-i",
    "input",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "faststart",
    "-an",
    "output.mp4",
  ]);
  ffmpeg.off("progress", progressHandler);
  const data = await ffmpeg.readFile("output.mp4");
  await ffmpeg.deleteFile("input");
  await ffmpeg.deleteFile("output.mp4");
  return data as Uint8Array;
}

export default function VideoFrameExtractionForm() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [frames, setFrames] = useState<Record<number, FrameData>>({});
  const workerRef = useRef<Worker | null>(null);

  // Set up the worker only on the client
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/videoFrameExtractor.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (e) => {
      const { type, frames, error } = e.data;
      setIsProcessing(false);
      setProgress(0);
      if (type === "success") {
        setFrames(frames);
        if (Object.keys(frames).length === 0) {
          setError("No frames were extracted from the video");
        }
      } else {
        setError(error);
      }
    };
    worker.onerror = (e) => {
      setError(e.message);
      setIsProcessing(false);
      setProgress(0);
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setError(null);
      setFrames({});
      setProgress(0);
    }
  };

  const sendVideoToWorker = useCallback(async () => {
    if (!videoFile || !workerRef.current) return;
    setIsProcessing(true);
    setError(null);
    setFrames({});
    setProgress(0);
    try {
      // Transcode to MP4/H.264 first
      setProgress(0.01);
      const transcoded = await transcodeToMp4H264(videoFile, (ratio) =>
        setProgress(ratio * 0.8)
      );
      setProgress(0.85); // Processing in worker
      workerRef.current.postMessage({ videoData: transcoded.buffer });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process video");
      setIsProcessing(false);
      setProgress(0);
    }
  }, [videoFile]);

  return (
    <div className="space-y-4 w-full max-w-md">
      <input
        name="videoFile"
        type="file"
        onChange={handleFileChange}
        accept="video/*"
        className="w-full p-2 border rounded"
      />
      <button
        onClick={sendVideoToWorker}
        disabled={!videoFile || isProcessing}
        className={`w-full p-2 rounded ${
          !videoFile || isProcessing
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
      >
        {isProcessing ? "Processing..." : "Process Video"}
      </button>
      {isProcessing && (
        <div className="w-full bg-gray-200 rounded h-4">
          <div
            className="bg-blue-500 h-4 rounded"
            style={{ width: `${Math.round(progress * 100)}%` }}
          ></div>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>
      )}
      {Object.keys(frames).length > 0 && (
        <div className="p-4 bg-green-100 text-green-700 rounded max-h-96 overflow-y-auto">
          <div>Extracted {Object.keys(frames).length} frames:</div>
          <ul className="text-xs">
            {Object.entries(frames).map(([ts, frame]) => (
              <li key={ts} className="mb-2">
                <div>Timestamp: {frame.timestamp / 1_000_000}s</div>
                <img
                  src={`data:image/png;base64,${frame.base64}`}
                  alt={`Frame at ${frame.timestamp / 1_000_000}s`}
                  style={{ width: 80, height: 45, objectFit: "cover" }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
