"use client";
import { Deal } from "@/lib/types";
import { ACTIVE_STAGES, STAGE_COLORS } from "@/lib/constants";

export default function FunnelBar({ deals }: { deals: Deal[] }) {
  const counts = ACTIVE_STAGES.map((stage) => ({
    stage,
    n: deals.filter((d) => d.stage === stage).length,
  }));
  const total = Math.max(1, counts.reduce((a, c) => a + c.n, 0));
  const anyOpen = counts.some((c) => c.n > 0);

  if (!anyOpen) {
    return (
      <div className="funnel-wrap"><div className="funnel">
        <div className="funnel-seg" style={{ width: "100%", background: "var(--warmgrey)", color: "var(--greyblue)" }}>
          No open deals
        </div>
      </div></div>
    );
  }

  return (
    <div className="funnel-wrap"><div className="funnel">
      {counts
        .filter((c) => c.n > 0)
        .map((c) => (
          <div
            key={c.stage}
            className="funnel-seg"
            style={{ width: `${Math.max(8, (c.n / total) * 100)}%`, background: STAGE_COLORS[c.stage] }}
            title={`${c.stage}: ${c.n}`}
          >
            <div className="n">{c.n}</div>
            <div>{c.stage}</div>
          </div>
        ))}
    </div></div>
  );
}
