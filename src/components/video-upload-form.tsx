"use client";

import { useRouter } from "next/navigation";
import { type DragEvent, type FormEvent, useRef, useState } from "react";

type VideoUploadFormProps = {
  vehicleId: string;
};

export function VideoUploadForm({ vehicleId }: VideoUploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFrameCount, setTargetFrameCount] = useState("48");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"UPLOADING" | "ANALYZING" | null>(null);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelection(file: File | undefined | null) {
    if (!file) return;
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["mp4", "mov"].includes(ext ?? "") && !file.type.includes("video")) {
      setError("Please select an MP4 or MOV video file.");
      return;
    }

    setSelectedFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  }

  function handleCancelUpload() {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadPhase(null);
    setError("Upload was canceled.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = selectedFile || fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Select an MP4 or MOV walkaround video.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    setUploadPhase("UPLOADING");
    setUploadedBytes(0);
    setTotalBytes(file.size);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
        setUploadedBytes(e.loaded);
        setTotalBytes(e.total);
        if (percent >= 100) {
          setUploadPhase("ANALYZING");
        }
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      xhrRef.current = null;

      try {
        const result = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          router.refresh();
        } else {
          setError(
            result.error ?? `Upload failed with status code ${xhr.status}.`,
          );
        }
      } catch {
        if (xhr.status >= 200 && xhr.status < 300) {
          router.refresh();
        } else {
          setError(`Upload failed with status ${xhr.status}.`);
        }
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      xhrRef.current = null;
      setError("Network error: Failed to connect to server during upload.");
    };

    xhr.ontimeout = () => {
      setIsUploading(false);
      xhrRef.current = null;
      setError("Upload timed out. Check your connection or try a smaller video.");
    };

    xhr.timeout = 180000; // 3 minutes timeout

    xhr.open("POST", `/api/vehicles/${vehicleId}/captures`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.setRequestHeader("X-Target-Frame-Count", targetFrameCount);

    xhr.send(file);
  }

  function formatMb(bytes: number) {
    return (bytes / 1024 / 1024).toFixed(1);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="capture-error" role="alert">
          <strong>Upload Notice</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="upload-field">
        <label
          className={`upload-dropzone transition-all cursor-pointer ${
            isDragging
              ? "border-amber-500 bg-amber-950/20 scale-[1.01]"
              : "hover:border-stone-400"
          }`}
          htmlFor="walkaround-video"
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="upload-icon" aria-hidden="true">
            {selectedFile ? "✓" : "↑"}
          </span>
          <strong>
            {selectedFile ? selectedFile.name : "Choose or drag & drop walkaround video"}
          </strong>
          <span>
            {selectedFile
              ? `${formatMb(selectedFile.size)} MB · Ready to upload`
              : "MP4 or MOV · one complete circle around the vehicle"}
          </span>
        </label>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          id="walkaround-video"
          name="video"
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          disabled={isUploading}
          onChange={(event) => handleFileSelection(event.target.files?.[0])}
        />
      </div>

      {/* Live Upload Progress Bar */}
      {isUploading && (
        <div className="progress-block my-4 p-4 bg-stone-900 border border-stone-800 rounded-xl" aria-live="polite">
          <div className="flex justify-between items-center text-sm font-semibold mb-2">
            <span className="text-amber-400">
              {uploadPhase === "ANALYZING"
                ? "Analyzing video & extracting metadata..."
                : `Uploading video (${formatMb(uploadedBytes)} MB / ${formatMb(totalBytes)} MB)...`}
            </span>
            <span className="font-mono text-white">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-stone-950 rounded-full h-3 overflow-hidden border border-stone-800">
            <div
              className="bg-amber-500 h-full transition-all duration-200 ease-out rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="field frame-count-field">
        <label htmlFor="targetFrameCount">Spin frame count</label>
        <select
          id="targetFrameCount"
          name="targetFrameCount"
          value={targetFrameCount}
          disabled={isUploading}
          onChange={(e) => setTargetFrameCount(e.target.value)}
        >
          <option value="36">36 frames · fastest</option>
          <option value="48">48 frames · balanced (recommended)</option>
          <option value="72">72 frames · smoothest</option>
        </select>
      </div>

      <div className="form-actions flex gap-3 items-center mt-6">
        <button
          className="button button-primary"
          type="submit"
          disabled={isUploading || !selectedFile}
        >
          {isUploading
            ? uploadPhase === "ANALYZING"
              ? "Analyzing video..."
              : "Uploading..."
            : "Upload Video"}
        </button>

        {isUploading && (
          <button
            type="button"
            onClick={handleCancelUpload}
            className="button button-secondary text-red-400 hover:text-red-300"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
