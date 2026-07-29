import { NextRequest, NextResponse } from "next/server";

// Separate from the main team password — this gates entry into the Ops
// Manager view specifically. Checked server-side so the password itself
// never ships in the client bundle.
export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expected = process.env.OPS_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "Server is missing the OPS_PASSWORD env var" },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
