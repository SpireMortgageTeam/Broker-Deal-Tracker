"use client";
import { useState } from "react";
import { TrackerDB } from "@/lib/types";
import type { Mutate } from "@/app/page";
import EmailAssistant from "./EmailAssistant";
import InstaReview from "./InstaReview";
import FeatureSheet from "./FeatureSheet";

// Shared tools that don't belong to any one broker — available to the whole
// team from the main landing page. Tabbed the same way BrokerView is, so
// adding the next resource later is just another tab + case here.
// Email Assistant and Insta Review are fully self-contained (no Redis data
// of their own), so db/mutate are only threaded through to Feature Sheets.
type Tab = "email" | "insta" | "sheets";

export default function ResourcesView({ db, mutate }: { db: TrackerDB; mutate: Mutate }) {
  const [tab, setTab] = useState<Tab>("email");

  return (
    <>
      <div className="tabs">
        <div className={`tab ${tab === "email" ? "active" : ""}`} onClick={() => setTab("email")}>Email Assistant</div>
        <div className={`tab ${tab === "insta" ? "active" : ""}`} onClick={() => setTab("insta")}>Insta Review</div>
        <div className={`tab ${tab === "sheets" ? "active" : ""}`} onClick={() => setTab("sheets")}>Feature Sheets</div>
      </div>

      {tab === "email" && <EmailAssistant />}
      {tab === "insta" && <InstaReview />}
      {tab === "sheets" && <FeatureSheet db={db} mutate={mutate} />}
    </>
  );
}
