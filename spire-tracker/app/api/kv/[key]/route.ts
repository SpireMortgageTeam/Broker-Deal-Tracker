import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KV_KEYS } from "@/lib/constants";

const ALLOWED_KEYS: string[] = Object.values(KV_KEYS);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown key" }, { status: 400 });
  }
  try {
    const value = await redis.get(key);
    // Upstash auto-deserializes JSON, so `value` may already be an array/object.
    const arr = Array.isArray(value) ? value : [];
    return NextResponse.json({ value: arr });
  } catch (err) {
    console.error("KV GET failed", key, err);
    return NextResponse.json({ error: "Storage read failed" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown key" }, { status: 400 });
  }
  try {
    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Expected a JSON array body" }, { status: 400 });
    }
    await redis.set(key, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("KV POST failed", key, err);
    return NextResponse.json({ error: "Storage write failed" }, { status: 500 });
  }
}
