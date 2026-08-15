# Development Status — Phase 01 Completion

## Working

- **Video Ingestion & Analysis**:
  - Validated multipart streaming upload supporting MP4 and MOV formats.
  - Video stream analysis with `ffprobe` extracting duration, FPS, codec (HEVC/H.264), dimensions, and orientation tags.
- **Deterministic Frame Sampling**:
  - Deterministic frame generation for 36, 48, and 72 target frame counts.
  - FFmpeg Lanczos downsampling (max 1600px width/height preserving aspect ratio) with zero-padded naming (`frame-001.png` to `frame-0XX.png`).
  - 96% usable duration sampling (`durationSeconds * 0.96`) preventing loop boundary duplicate angle pauses.
- **Web-Optimized Image Generation**:
  - Concurrent multi-worker FFmpeg WebP optimization (`quality=84`, max 1600px width) and WebP thumbnails (`quality=74`, max 320px width).
  - Valid image dimensions, compression, and automated cleanup of intermediate raw PNG frames.
- **SQLite Persistence**:
  - Local SQLite database (`data/vehicle-360.sqlite`) with WAL mode and `STRICT` tables (`vehicles`, `captures`, `frames`).
  - Foreign keys, transactions on frame manifests, error logging on failures, and verified persistence across server/database restarts.
- **Interactive 360 Spin Viewer**:
  - Single-image off-DOM cached renderer with pointer swipe/drag, keyboard arrow navigation, 360° forward and reverse wrapping, and autoplay.
  - Neighbor-first batched preloading order for smooth interactive rotation without DOM overload.

## Changed

- Added `vitest.config.mts` with Node environment, test timeout settings, path alias resolution (`@/*`), and `server-only` test stubbing.
- Added `src/server/empty.ts` stub to satisfy `server-only` imports during automated test execution.
- Added comprehensive end-to-end automated acceptance suite in `src/server/processing/pipeline-acceptance.test.ts` validating real-video processing on `IMG_0522.mov` (36, 48, 72 frames), wrapping mechanics, error transitions, and SQLite persistence.

## Known Limitations

- Advanced computer vision, car boundary detection, and background removal are deferred.
- Camera stabilization, optical flow smoothing, and multi-sensor orientation tracking are deferred.
- Authentication, tenancy, dealership accounts, cloud object storage, and remote database (Supabase) are deferred to later phases.
- Real-time video encoding progress is tracked in discrete processing stages and image optimization increments.

## Test Results

- **Unit & Acceptance Test Suite (`npm test`)**: 17 / 17 tests passed across 3 test suites:
  - `src/lib/spin/frame-utils.test.ts` (6 tests)
  - `src/server/captures/capture-state.test.ts` (3 tests)
  - `src/server/processing/pipeline-acceptance.test.ts` (8 tests)
- **Real Video Runs (`IMG_0522.mov` - 38.77s HEVC 3840×2160)**:
  - 36-frame test: 36 WebP frames (1600×900) + 36 thumbnails (320×180), SQLite manifest created, state `READY`, 100% progress.
  - 48-frame test: 48 WebP frames (1600×900) + 48 thumbnails (320×180), SQLite manifest created, state `READY`, 100% progress.
  - 72-frame test: 72 WebP frames (1600×900) + 72 thumbnails (320×180), SQLite manifest created, state `READY`, 100% progress.
- **Loop & Rotation Verification**:
  - Forward loop (`... -> 71 -> 0 -> 1`), Reverse loop (`0 -> 71 -> 70`), 48-frame wrap, and 36-frame wrap verified mathematically and in viewer state.
- **Failure Handling**:
  - Invalid/corrupted non-video input rejected with technical diagnostic error in `captures.error` and vehicle status set to `FAILED`.
- **Production Build & Lint**:
  - Next.js production build (`npm run build`) compiled cleanly with zero errors.
  - ESLint (`npm run lint`) passed with zero errors or warnings.

## Next Phase

Phase 02 — 360 Quality & Performance
