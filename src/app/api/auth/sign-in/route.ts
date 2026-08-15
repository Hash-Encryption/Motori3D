import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { BUSINESS_PREFERENCE_COOKIE } from "@/server/auth/auth-context";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const { email, password } = (body as Record<string, string>) ?? {};

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const user = data.user;

  // Check if user has an active dealership membership
  const { data: memberships } = await supabase
    .from("business_memberships")
    .select("id, business_id")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");

  let businessId: string | null = memberships?.[0]?.business_id ?? null;

  // If user has no active dealership (e.g. signed up before email confirmation was toggled), auto-provision
  if (!businessId) {
    const fullName = user.user_metadata?.full_name || email.split("@")[0];
    const defaultName = `${fullName}'s Motors`;
    const defaultSlug = `motors-${user.id.slice(0, 8)}`;

    const { data: rpcResult } = await supabase.rpc("create_dealership", {
      dealership_name: defaultName,
      dealership_slug: defaultSlug,
    });

    businessId = rpcResult?.business_id ?? null;
  }

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
    },
    businessId,
  });

  if (businessId) {
    response.cookies.set(BUSINESS_PREFERENCE_COOKIE, businessId, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return response;
}
