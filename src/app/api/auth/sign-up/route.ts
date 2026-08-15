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

  const { email, password, fullName, dealershipName, dealershipSlug } =
    (body as Record<string, string>) ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 422 },
    );
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long." },
      { status: 422 },
    );
  }

  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    return NextResponse.json(
      { error: "Full name is required." },
      { status: 422 },
    );
  }

  if (!dealershipName || typeof dealershipName !== "string" || !dealershipName.trim()) {
    return NextResponse.json(
      { error: "Dealership name is required." },
      { status: 422 },
    );
  }

  const rawSlug =
    dealershipSlug ||
    dealershipName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const slug = rawSlug || `dealership-${Date.now().toString(36)}`;

  const supabase = await createClient();

  // 1. Authenticate / create user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const user = authData.user;
  if (!user) {
    return NextResponse.json(
      { error: "Failed to create user account." },
      { status: 500 },
    );
  }

  // 2. If user is authenticated in the current session, create initial dealership atomically via RPC
  let businessId: string | null = null;
  if (authData.session) {
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_dealership",
      {
        dealership_name: dealershipName.trim(),
        dealership_slug: slug,
      },
    );

    if (rpcError) {
      console.error("Dealership bootstrap RPC failed", rpcError);
      return NextResponse.json(
        {
          error: `Account created, but dealership creation failed: ${rpcError.message}`,
          user: { id: user.id, email: user.email },
        },
        { status: 400 },
      );
    }

    businessId = rpcResult?.business_id ?? null;
  }

  const response = NextResponse.json(
    {
      success: true,
      user: { id: user.id, email: user.email },
      businessId,
      sessionCreated: !!authData.session,
    },
    { status: 201 },
  );

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
