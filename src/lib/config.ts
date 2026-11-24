import type { Seller } from "./types";

// Edit to match the Manna Enterprises Bill of Supply.
export const BUSINESS = {
  name: "Manna Enterprises",
  address: "Address line 1, City - PIN",
  gstin: "",
  phone: "",
};

export const DEFAULT_SELLER: Seller = {
  name: BUSINESS.name,
  address: BUSINESS.address,
  gstin: BUSINESS.gstin,
  state: "",
  code: "",
  email: "",
};
export const FIRST_INVOICE_NO = 10000;
export const DEFAULT_HSN = "";
export const DEFAULT_UNIT = "pcs";
export const DECLARATION = "Composition taxable person, not eligible to collect tax on supplies.";
