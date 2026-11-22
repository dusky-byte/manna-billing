export interface Item { id: number; code: string; name: string; hsn: string; unit: string; rate: number }
export interface Line { itemId: number | null; code: string; name: string; hsn: string; unit: string; qty: number; rate: number }
export interface InvoiceLine { sl: number; name: string; hsn: string; unit: string; qty: number; rate: number; amount: number }
export interface Invoice { no: number; date: string; customer: string; phone: string; total: number }
export interface InvoiceInput { date: string; customer: string; phone: string; lines: Line[] }
