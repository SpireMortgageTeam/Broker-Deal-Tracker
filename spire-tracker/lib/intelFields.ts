import { IntelFieldKey } from "./types";

// Static config for the Community Intel questionnaire — category grouping
// and human-readable labels for each of the 20 fields. One flat config
// file, same convention as lib/constants.ts.

export const INTEL_CATEGORIES: { label: string; fields: IntelFieldKey[] }[] = [
  { label: "Community Profile", fields: ["pricePoints", "propertyTypes"] },
  { label: "Communication Preferences", fields: ["preferredContactMethod", "updateFrequency", "followUpExpectations", "sidewaysCommunication"] },
  { label: "Market Intelligence", fields: ["currentBuyerTypes", "sellingWell", "harderToMove", "financingObjections", "whereBuyersStuck"] },
  { label: "Risk Flags & Fall Closings", fields: ["fallClosingsWorried", "financingReviewNeeded", "appraisalValuationIssues", "challengingModelsLotsUpgrades"] },
  { label: "Support & Tools", fields: ["whatWouldHelp", "toolsGuidesWishlist"] },
  { label: "Feedback on Us", fields: ["whereDroppedBall", "whatCouldBeBetter", "valuableExtensionVision"] },
];

export const INTEL_FIELD_LABELS: Record<IntelFieldKey, string> = {
  pricePoints: "Price points",
  propertyTypes: "Property types",
  preferredContactMethod: "Preferred contact method",
  updateFrequency: "Update frequency",
  followUpExpectations: "Follow-up expectations",
  sidewaysCommunication: "Sideways communication",
  currentBuyerTypes: "Current buyer types",
  sellingWell: "What's selling well",
  harderToMove: "Harder to move",
  financingObjections: "Financing objections",
  whereBuyersStuck: "Where buyers get stuck",
  fallClosingsWorried: "Fall closings worried about",
  financingReviewNeeded: "Financing review needed",
  appraisalValuationIssues: "Appraisal / valuation issues",
  challengingModelsLotsUpgrades: "Challenging models, lots, or upgrades",
  whatWouldHelp: "What would help",
  toolsGuidesWishlist: "Tools / guides wishlist",
  whereDroppedBall: "Where we've dropped the ball",
  whatCouldBeBetter: "What could be better",
  valuableExtensionVision: "Valuable extension of their team — vision",
};
