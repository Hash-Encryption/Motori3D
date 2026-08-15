"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { buildPreloadOrder, wrapFrameIndex } from "@/lib/spin/frame-utils";

type SpinViewerProps = {
  vehicleName: string;
  frameUrls: string[];
  width: number;
  height: number;
  pixelsPerFrame?: number;
  captureId?: string;
};

type DragState = {
  pointerId: number;
  startX: number;
  lastX: number;
  accumulatedX: number;
};

export function SpinViewer({
  vehicleName,
  frameUrls,
  width,
  height,
  pixelsPerFrame = 10,
  captureId,
}: SpinViewerProps) {
  const sequenceKey =
    captureId ?? `${frameUrls.length}:${frameUrls[0] ?? ""}:${frameUrls[frameUrls.length - 1] ?? ""}`;

  const [prevSequenceKey, setPrevSequenceKey] = useState(sequenceKey);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (prevSequenceKey !== sequenceKey) {
    setPrevSequenceKey(sequenceKey);
    setCurrentFrame(0);
    setLoadedCount(0);
    setIsAutoplaying(false);
    setIsDragging(false);
  }

  const viewerRef = useRef<HTMLDivElement>(null);
  const currentFrameRef = useRef(0);
  const pendingFrameRef = useRef(0);
  const frameRequestRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const loadedFramesRef = useRef(new Set<number>());
  const sequenceGenRef = useRef(0);
  const cachedImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());

  const commitFrame = useCallback(
    (nextFrame: number) => {
      const total = frameUrls.length || 1;
      const wrapped = wrapFrameIndex(nextFrame, total);
      currentFrameRef.current = wrapped;
      pendingFrameRef.current = wrapped;

      if (frameRequestRef.current === null) {
        frameRequestRef.current = window.requestAnimationFrame(() => {
          setCurrentFrame(pendingFrameRef.current);
          frameRequestRef.current = null;
        });
      }
    },
    [frameUrls.length],
  );

  useEffect(() => {
    sequenceGenRef.current += 1;
    const currentGen = sequenceGenRef.current;

    currentFrameRef.current = 0;
    pendingFrameRef.current = 0;
    dragRef.current = null;
    loadedFramesRef.current.clear();
    cachedImagesRef.current.clear();

    if (frameUrls.length === 0) return;

    let cancelled = false;
    let timerId: number | null = null;
    const loaded = loadedFramesRef.current;
    const cachedImages = cachedImagesRef.current;
    const loadingSet = new Set<number>();

    async function loadFrame(index: number) {
      if (cancelled || currentGen !== sequenceGenRef.current) return;
      if (loaded.has(index) || loadingSet.has(index)) return;

      loadingSet.add(index);
      const img = new Image();
      cachedImages.set(index, img);
      img.decoding = "async";
      img.src = frameUrls[index];

      try {
        if ("decode" in img && typeof img.decode === "function") {
          await img.decode();
        } else {
          await new Promise<void>((resolve) => {
            img.onload = img.onerror = () => resolve();
          });
        }
      } catch {
        // Non-fatal decode error or abort; frame still proceeds
      }

      loadingSet.delete(index);
      if (cancelled || currentGen !== sequenceGenRef.current) return;

      if (!loaded.has(index)) {
        loaded.add(index);
        setLoadedCount(loaded.size);
      }
    }

    async function processNextBatches() {
      if (cancelled || currentGen !== sequenceGenRef.current) return;
      if (loaded.size >= frameUrls.length) return;

      const priorityOrder = buildPreloadOrder(frameUrls.length, currentFrameRef.current);
      const batch: number[] = [];
      const batchSize = loaded.size === 0 ? 6 : 4;

      for (const idx of priorityOrder) {
        if (!loaded.has(idx) && !loadingSet.has(idx)) {
          batch.push(idx);
          if (batch.length >= batchSize) break;
        }
      }

      if (batch.length > 0) {
        await Promise.all(batch.map((idx) => loadFrame(idx)));
      }

      if (!cancelled && currentGen === sequenceGenRef.current && loaded.size < frameUrls.length) {
        timerId = window.setTimeout(processNextBatches, 40);
      }
    }

    processNextBatches();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      for (const img of cachedImages.values()) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [sequenceKey, frameUrls]);

  useEffect(() => {
    if (!isAutoplaying) return;
    const interval = window.setInterval(() => {
      commitFrame(currentFrameRef.current + 1);
    }, 110);
    return () => window.clearInterval(interval);
  }, [commitFrame, isAutoplaying]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === viewerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRequestRef.current !== null) {
        window.cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    setIsAutoplaying(false);
    setIsDragging(true);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      accumulatedX: 0,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Defensive for non-browser/unsupported environments
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.accumulatedX += deltaX;

    if (Math.abs(event.clientX - drag.startX) < 4) return;
    if (Math.abs(drag.accumulatedX) >= pixelsPerFrame) {
      const frameDelta = Math.trunc(drag.accumulatedX / pixelsPerFrame);
      drag.accumulatedX -= frameDelta * pixelsPerFrame;
      commitFrame(currentFrameRef.current - frameDelta);
    }
  }

  function endPointerInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Defensive fallback
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIsAutoplaying(false);
      commitFrame(currentFrameRef.current - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setIsAutoplaying(false);
      commitFrame(currentFrameRef.current + 1);
    }
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await viewerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  function resetView() {
    setIsAutoplaying(false);
    commitFrame(0);
  }

  const readyThreshold = Math.min(6, frameUrls.length || 1);
  const enoughFramesLoaded = loadedCount >= readyThreshold;
  const safeFrameIndex = wrapFrameIndex(currentFrame, frameUrls.length || 1);
  const activeFrameUrl = frameUrls[safeFrameIndex] ?? frameUrls[0] ?? "";

  return (
    <div className="spin-viewer" ref={viewerRef}>
      <div
        className={`spin-stage ${isDragging ? "is-dragging" : ""}`}
        role="application"
        aria-label={`${vehicleName} 360 degree viewer`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerInteraction}
        onPointerCancel={endPointerInteraction}
      >
        {/* Only this current image is rendered; all other frames are cached off-DOM. */}
        {activeFrameUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- direct URL swapping is the core image-sequence viewer behavior
          <img
            src={activeFrameUrl}
            alt={`${vehicleName}, angle ${safeFrameIndex + 1} of ${frameUrls.length}`}
            width={width}
            height={height}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
          />
        ) : null}
        {!enoughFramesLoaded && frameUrls.length > 0 ? (
          <div className="spin-loading" role="status">
            Preparing spin · {loadedCount}/{readyThreshold}
          </div>
        ) : null}
        <div className="drag-hint" aria-hidden="true">← Drag to rotate →</div>
      </div>

      <div className="spin-readout" aria-live="polite">
        <span>Frame {safeFrameIndex + 1} / {frameUrls.length}</span>
        <span>{loadedCount === frameUrls.length ? "All frames loaded" : `${loadedCount} loaded`}</span>
      </div>

      <div className="spin-controls" aria-label="360 viewer controls">
        <button type="button" onClick={() => { setIsAutoplaying(false); commitFrame(currentFrameRef.current - 1); }}>
          ← Previous
        </button>
        <button type="button" onClick={() => setIsAutoplaying((value) => !value)}>
          {isAutoplaying ? "Pause" : "Auto rotate"}
        </button>
        <button type="button" onClick={() => { setIsAutoplaying(false); commitFrame(currentFrameRef.current + 1); }}>
          Next →
        </button>
        <button type="button" onClick={resetView}>Front view</button>
        <button type="button" onClick={toggleFullscreen}>
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
    </div>
  );
}
