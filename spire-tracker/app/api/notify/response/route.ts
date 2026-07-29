import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KV_KEYS } from "@/lib/constants";
import { sendEmail, opsUpdateEmail } from "@/lib/email";
import type { BrokerContact } from "@/lib/types";

// Fired when ops responds to, or resolves, an escalation. Emails the specific
// broker who raised it — looked up by name (the app's only identifier) in the
// broker-contacts directory. Ops recipients are used as reply-to.
export async function POST(request: NextRequest) {
  try {
    const { broker, clientName, stage, reason, opsResponse, kind } = await request.json();

    const contacts = ((await redis.get(KV_KEYS.brokerContacts)) as BrokerContact[] | null) || [];
    const brokerEmail = contacts.find((c) => c.name === broker)?.email;
    if (!brokerEmail) {
      return NextResponse.json({ ok: false, skipped: `no email on file for broker "${broker}"` });
    }

    const opsRecipients = ((await redis.get(KV_KEYS.opsRecipients)) as string[] | null) || [];

    const { subject, html } = opsUpdateEmail({
      broker,
      clientName,
      stage,
      reason,
      opsResponse,
      kind: kind === "resolved" ? "resolved" : "response",
    });

    const result = await sendEmail({
      to: [brokerEmail],
      subject,
      html,
      replyTo: opsRecipients[0],
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("notify/response failed", err);
    return NextResponse.json({ ok: false, error: "notify failed" }, { status: 200 });
  }
}
