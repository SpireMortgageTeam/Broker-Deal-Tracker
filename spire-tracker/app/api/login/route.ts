import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  let token: string;
  try {
    if (!(await checkPassword(password))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    token = await createSessionToken();
  } catch {
    return NextResponse.json(
      { error: "Server is missing TEAM_PASSWORD or SESSION_SECRET env vars" },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
