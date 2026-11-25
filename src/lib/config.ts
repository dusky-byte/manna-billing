import type { Seller } from "./types";

// Default business details (editable in the app, saved on the device). Taken from Invoice 61.
export const BUSINESS = {
  name: "MANNA ENTERPRISES",
  address: "No.35, 24th Cross Street, Jothiyammal Nagar\nShenoy Nagar, Chennai - 600 030",
  gstin: "33HXEPM3269K1Z2",
  phone: "",
};

export const DEFAULT_SELLER: Seller = {
  name: BUSINESS.name,
  address: BUSINESS.address,
  gstin: BUSINESS.gstin,
  state: "Tamil Nadu",
  code: "33",
  email: "hannest7358@gmail.com",
};
export const FIRST_INVOICE_NO = 10000;
export const DEFAULT_HSN = "4901";
export const DEFAULT_UNIT = "No";
export const DECLARATION =
  "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";
