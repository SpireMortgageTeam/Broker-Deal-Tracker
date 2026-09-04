"use client";
import { useState } from "react";
import EmailAssistant from "./EmailAssistant";
import InstaReview from "./InstaReview";

// Shared tools that don't belong to any one broker — available to the whole
// team from the main landing page. Tabbed the same way BrokerView is, so
// adding the next resource later is just another tab + case here.
type Tab = "email" | "insta";

export default function ResourcesView() {
  const [tab, setTab] = useState<Tab>("email");

  return (
    <>
      <div className="tabs">
        <div className={`tab ${tab === "email" ? "active" : ""}`} onClick={() => setTab("email")}>Email Assistant</div>
        <div className={`tab ${tab === "insta" ? "active" : ""}`} onClick={() => setTab("insta")}>Insta Review</div>
      </div>

      {tab === "email" && <EmailAssistant />}
      {tab === "insta" && <InstaReview />}
    </>
  );
}
