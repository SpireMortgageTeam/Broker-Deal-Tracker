import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KV_KEYS } from "@/lib/constants";
import { sendEmail, escalationEmail } from "@/lib/email";
import type { BrokerContact } from "@/lib/types";

// Fired when a broker flags a deal. Emails everyone on the ops-recipients list.
// Recipient addresses are read server-side from Redis (never trusted from the
// client), and the flagging broker's address is used as reply-to so ops can
// answer them directly from their inbox.
export async function POST(request: NextRequest) {
  try {
    const { broker, clientName, stage, value, reason } = await request.json();

    const opsRecipients = ((await redis.get(KV_KEYS.opsRecipients)) as string[] | null) || [];
    if (!opsRecipients.length) {
      return NextResponse.json({ ok: false, skipped: "no ops recipients configured" });
    }

    const contacts = ((await redis.get(KV_KEYS.brokerContacts)) as BrokerContact[] | null) || [];
    const brokerEmail = contacts.find((c) => c.name === broker)?.email;

    const flaggedAt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Edmonton",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const { subject, html } = escalationEmail({
      broker,
      clientName,
      stage,
      value,
      reason,
      flaggedAt,
    });

    const result = await sendEmail({
      to: opsRecipients,
      subject,
      html,
      replyTo: brokerEmail,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("notify/escalation failed", err);
    return NextResponse.json({ ok: false, error: "notify failed" }, { status: 200 });
  }
}
