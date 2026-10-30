import { type NextRequest, NextResponse } from "next/server";

import {
  BUSINESS_PREFERENCE_COOKIE,
  ForbiddenError,
  getAuthContext,
  UnauthorizedError,
} from "@/server/auth/auth-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: context.user.id,
        email: context.user.email,
      },
      profile: context.profile,
      business: context.business,
      role: context.role,
      isSuperAdmin: context.isSuperAdmin,
      availableBusinesses: context.allMemberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        role: m.role,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to resolve auth context." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { businessId } = (body as Record<string, string>) ?? {};
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required." }, { status: 422 });
  }

  try {
    // Validates that caller is authenticated and actually has membership in businessId
    const context = await getAuthContext({ requestedBusinessId: businessId });
    if (!context) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      activeBusiness: context.business,
      role: context.role,
    });

    response.cookies.set(BUSINESS_PREFERENCE_COOKIE, businessId, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to switch business context." }, { status: 500 });
  }
}
