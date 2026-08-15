# Vehicle 360

Vehicle 360 is a local-first MVP for car dealerships. A dealership employee
creates a vehicle project, uploads one real phone walkaround video, processes it
into an ordered WebP image sequence, and opens that sequence in a custom
drag-to-rotate viewer.

This is intentionally not 3D reconstruction. The product does not use
photogrammetry, NeRF, Gaussian splatting, mesh generation, or a third-party 360
viewer. Every displayed angle is a real frame extracted from the uploaded video.

## Verified MVP flow

```text
new vehicle
  -> upload MP4/MOV
  -> analyze with ffprobe
  -> extract 36, 48, or 72 ordered frames
  -> optimize viewer WebP + thumbnail WebP files
  -> store a frame manifest in SQLite
  -> drag/swipe the custom viewer
```

The complete flow has been verified with a generated 1280×720 H.264 fixture.
The first real-car phone-video acceptance test remains pending until a normal
walkaround video is supplied.

## Architecture

- **Web application:** Next.js 16 App Router, React 19, strict TypeScript
- **Application UI:** mobile-first CSS with Tailwind available for utilities
- **Database:** Node.js built-in SQLite driver; no external database service
- **Video tools:** project-local `ffmpeg-static` and `ffprobe-static` binaries
- **Storage:** local filesystem behind path-resolution helpers and internal IDs
- **Processing:** in-process local job coordinator with persisted stage/progress
- **Viewer:** custom React image-sequence viewer using one visible `<img>`
- **Tests:** Vitest utility/status tests plus live browser and pipeline checks

The database and media stay local. Generated data is ignored by Git.

## Requirements

- Node.js 24 or newer (the application uses the built-in `node:sqlite` API)
- npm
- Enough local disk space for the source video and generated frames

No global FFmpeg installation is required. To use system binaries instead, set
`FFMPEG_PATH` and `FFPROBE_PATH` in `.env`.

## Installation

```powershell
cd C:\codexprojects\vehicle-360
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Open `http://localhost:3000`.

The SQLite database and tables are created automatically on first use at
`data/vehicle-360.sqlite`.

## Commands

```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd start
```

## Processing pipeline

### 1. Upload

The browser streams the selected MP4 or MOV directly to a route handler. The
server rejects unsupported types, enforces `MAX_UPLOAD_MB`, generates its own
vehicle/capture IDs, sanitizes the original display filename, and never uses the
uploaded filename as a storage path.

### 2. Analyze

ffprobe reads and persists:

- duration
- frame rate
- width and height
- codec
- orientation metadata
- estimated source-frame count

An unreadable or corrupted video produces a visible failure instead of silently
continuing.

### 3. Extract

The target can be 36, 48, or 72 frames. For a duration `D` and target `N`, the
timestamp utility uses:

```text
usableDuration = D * 0.96
timestamp[i] = usableDuration * i / N
```

Sampling only the first 96% is the MVP duplicate-ending strategy. It avoids the
common repeated front angle at the beginning and end without introducing
computer-vision heuristics.

FFmpeg extracts exactly the requested count into deterministic names such as
`frame-001.png`. It auto-applies orientation, preserves aspect ratio, prevents
upscaling, and limits the longest edge to 1600px.

### 4. Optimize

The raw frames are converted to metadata-free WebP files at quality 84. A 320px
thumbnail is created at quality 74. Processing progress is updated from the
actual completed-image count. The pipeline verifies the generated count,
filenames, dimensions, and first optimized image before committing the manifest.
Raw temporary frames are removed after success.

Alignment is currently an explicit future pipeline stage. Version 1 does not
claim stabilization or automatic vehicle centering.

### 5. View

The viewer renders only the current frame. It loads the front frame and nearby
angles first, then loads the rest in small background batches. Loaded images are
held in the browser cache and are not requested repeatedly.

Interaction features:

- Pointer Events for mouse, pen, and touch
- approximately 10 horizontal pixels per frame
- requestAnimationFrame-coalesced React updates
- continuous wraparound in both directions
- autoplay that pauses on interaction
- previous, next, reset/front view, and fullscreen controls
- keyboard left/right arrows
- `touch-action: pan-y` so normal vertical page scrolling remains available

## Local directory structure

```text
data/
  vehicle-360.sqlite

storage/
  vehicles/<vehicle-id>/
    captures/<capture-id>/
      source/original.mp4
      frames/frame-001.webp
      frames/frame-002.webp
      thumbs/frame-001.webp
      thumbs/frame-002.webp
```

Media is served through capture/frame IDs. Public routes do not accept arbitrary
filesystem paths.

## Test with a phone video

Use one normal 15–40 second video:

- one complete circle around a parked vehicle
- the entire vehicle visible
- roughly constant distance and camera height
- landscape preferred, portrait accepted when FFmpeg can decode it

Create a vehicle, open **Continue**, select the video and frame count, upload,
then select **Start processing**. The processing screen reports real persisted
stages. Select **Open 360** only after the status reaches `READY`.

## Current limitations

- Processing jobs run inside the local Next.js process and do not survive a
  server shutdown during an active job.
- There is no frame alignment, blur detection, vehicle centering, or background
  removal yet.
- Storage is local rather than cloud/object storage.
- Authentication and dealership tenancy are intentionally outside this MVP.
- A real phone walkaround is still required for final real-world acceptance.

## Future improvements

The service boundaries allow later addition of cloud storage/CDN delivery,
durable workers, capture guidance, alignment, quality checks, background removal,
plate/wheel blurring, interior panoramas, inventory, analytics, and dealership
publishing. Those features are deliberately not implemented in this base.

See `DEVELOPMENT_STATUS.md` for the exact verified state.
