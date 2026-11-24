import type { Buyer, Line } from "./types";

export const BILLING_DRAFT_KEY = "manna-billing-draft";

export interface BillingDraft {
  date: string;
  buyer: Buyer;
  lines: Line[];
}

export function readBillingDraft(): BillingDraft | null {
  const raw = sessionStorage.getItem(BILLING_DRAFT_KEY);
  if (!raw) return null;

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Saved billing draft is invalid.");
  const draft = value as Partial<BillingDraft>;
  const buyer = draft.buyer;
  if (
    typeof draft.date !== "string" ||
    !buyer ||
    typeof buyer.name !== "string" ||
    typeof buyer.address !== "string" ||
    typeof buyer.gstin !== "string" ||
    typeof buyer.state !== "string" ||
    typeof buyer.code !== "string" ||
    !Array.isArray(draft.lines)
  ) {
    throw new Error("Saved billing draft is invalid.");
  }
  return { date: draft.date, buyer, lines: draft.lines };
}

export function writeBillingDraft(draft: BillingDraft): void {
  sessionStorage.setItem(BILLING_DRAFT_KEY, JSON.stringify(draft));
}
