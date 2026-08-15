"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

type VideoUploadFormProps = {
  vehicleId: string;
};

export function VideoUploadForm({ vehicleId }: VideoUploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = fileInputRef.current?.files?.[0];
    const targetFrameCount = String(formData.get("targetFrameCount") ?? "72");

    if (!file) {
      setError("Select an MP4 or MOV walkaround video.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/captures`, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-Target-Frame-Count": targetFrameCount,
        },
        body: file,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "The upload failed.");
        return;
      }

      router.refresh();
    } catch {
      setError("The server could not be reached during upload.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="upload-field">
        <label className="upload-dropzone" htmlFor="walkaround-video">
          <span className="upload-icon" aria-hidden="true">↑</span>
          <strong>{selectedName ?? "Choose walkaround video"}</strong>
          <span>MP4 or MOV · one complete circle around the vehicle</span>
        </label>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          id="walkaround-video"
          name="video"
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          onChange={(event) => setSelectedName(event.target.files?.[0]?.name ?? null)}
        />
      </div>

      <div className="field frame-count-field">
        <label htmlFor="targetFrameCount">Spin frame count</label>
        <select id="targetFrameCount" name="targetFrameCount" defaultValue="72">
          <option value="36">36 frames · fastest</option>
          <option value="48">48 frames · balanced</option>
          <option value="72">72 frames · smoothest</option>
        </select>
      </div>

      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={isUploading}>
          {isUploading ? "Uploading and analyzing…" : "Upload video"}
        </button>
      </div>
    </form>
  );
}
