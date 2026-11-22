export const inr = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

export const showDate = (iso: string) => iso.split("-").reverse().join("/");

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const below100 = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const below1000 = (n: number) => {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? ONES[h] + " Hundred" : "", r ? below100(r) : ""].filter(Boolean).join(" ");
};

/** Indian numbering (lakh/crore). */
export function rupeesInWords(amount: number): string {
  const total = Math.round(amount * 100);
  let rs = Math.floor(total / 100);
  const ps = total % 100;
  const parts: string[] = [];
  const crore = Math.floor(rs / 1e7); rs %= 1e7;
  const lakh = Math.floor(rs / 1e5); rs %= 1e5;
  const thousand = Math.floor(rs / 1e3); rs %= 1e3;
  if (crore) parts.push(below1000(crore) + " Crore");
  if (lakh) parts.push(below100(lakh) + " Lakh");
  if (thousand) parts.push(below100(thousand) + " Thousand");
  if (rs) parts.push(below1000(rs));
  let s = (parts.join(" ") || "Zero") + " Rupees";
  if (ps) s += " and " + below100(ps) + " Paise";
  return s + " Only";
}
