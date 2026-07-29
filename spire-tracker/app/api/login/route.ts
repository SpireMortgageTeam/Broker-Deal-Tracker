import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expected = process.env.TEAM_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!expected || !sessionSecret) {
    return NextResponse.json(
      { error: "Server is missing TEAM_PASSWORD or SESSION_SECRET env vars" },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("spire_session", sessionSecret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
