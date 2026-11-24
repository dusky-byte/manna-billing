export interface Seller { name: string; address: string; gstin: string; state: string; code: string; email: string }
export interface Buyer { name: string; address: string; gstin: string; state: string; code: string }
export interface Item { id: number; code: string; name: string; hsn: string; unit: string; rate: number }
export interface Line { itemId: number | null; code: string; name: string; hsn: string; unit: string; qty: number; rate: number }
export interface InvoiceLine { sl: number; name: string; hsn: string; unit: string; qty: number; rate: number; amount: number }
export interface Invoice { no: number; date: string; total: number; seller: Seller; buyer: Buyer }
export interface InvoiceInput { date: string; seller: Seller; buyer: Buyer; lines: Line[] }
