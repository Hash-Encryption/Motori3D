import { getCapture } from "@/server/captures/capture-repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/captures/[id]">,
) {
  const { id } = await context.params;
  const capture = getCapture(id);
  if (!capture) {
    return Response.json({ error: "Capture not found." }, { status: 404 });
  }
  return Response.json({ capture });
}
