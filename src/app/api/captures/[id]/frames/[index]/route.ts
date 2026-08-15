import { readFile } from "node:fs/promises";

import { getCaptureFrame } from "@/server/captures/capture-repository";
import { resolveStoredPath } from "@/server/storage/local-storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: RouteContext<"/api/captures/[id]/frames/[index]">,
) {
  const { id, index: indexText } = await context.params;
  const index = Number(indexText);
  if (!Number.isInteger(index) || index < 0) {
    return Response.json({ error: "Invalid frame index." }, { status: 400 });
  }

  const frame = getCaptureFrame(id, index);
  if (!frame) {
    return Response.json({ error: "Frame not found." }, { status: 404 });
  }

  const useThumbnail = new URL(request.url).searchParams.get("thumb") === "1";
  const storedPath = useThumbnail ? frame.thumbnailPath : frame.path;
  const resolved = resolveStoredPath(storedPath);

  try {
    const image = await readFile(resolved.absolutePath);
    return new Response(image, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(image.byteLength),
      },
    });
  } catch (error) {
    console.error("Failed to read processed frame", { id, index, error });
    return Response.json({ error: "Processed frame file is unavailable." }, { status: 404 });
  }
}
