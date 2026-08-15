import { getCapture } from "@/server/captures/capture-repository";
import { queueCaptureProcessing } from "@/server/processing/processing-jobs";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/captures/[id]/process">,
) {
  const { id } = await context.params;
  const capture = getCapture(id);
  if (!capture) {
    return Response.json({ error: "Capture not found." }, { status: 404 });
  }
  if (!["UPLOADED", "FAILED", "READY"].includes(capture.status)) {
    return Response.json(
      { error: "This capture is already processing." },
      { status: 409 },
    );
  }
  if (!capture.sourceVideoPath || !capture.sourceSizeBytes) {
    return Response.json(
      { error: "The source video is unavailable. Upload it again." },
      { status: 422 },
    );
  }

  void queueCaptureProcessing(id);
  return Response.json({ accepted: true }, { status: 202 });
}
