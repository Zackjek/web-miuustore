export type Order = {
  id:string; invoice_seq:number; tracking_code:string; buyer:string; buyer_wa:string;
  product_name:string; variant:string; duration:string; device:string; location:string;
  price:number; cost:number; quantity:number; supplier:string; supplier_admin:string;
  order_date:string; due_date:string; warranty_days:number; rental_end_at:string|null; logged_out_at:string|null; status:string; notes:string;
  public_note:string; refund_amount:number; created_at:string; updated_at:string;
};
export type Product = {id:string;name:string;variant:string;duration:string;cost:number;price:number;supplier:string;sort_order:number;created_at:string};
export type Supplier = {id:string;name:string;admin:string;contact:string;created_at:string};
export type Expense = {id:string;title:string;amount:number;date:string;notes:string;created_at:string};
export type BuyerNote = {id:string;buyer:string;notes:string;updated_at:string};
export type Settings = {shop_name:string;currency:string;default_warranty:number;receipt_style:string;receipt_color:string;buyer_template:string;account_template:string;seller_wa:string};
export type Store = {orders:Order[];products:Product[];suppliers:Supplier[];expenses:Expense[];buyerNotes:BuyerNote[];settings:Settings|null};
export type View = "dashboard"|"orders"|"products"|"calculator"|"warranty"|"calendar"|"logout"|"suppliers"|"buyers"|"profit"|"formats"|"promo"|"watermark"|"settings";
export const moneyFmt = (n:number,currency="Rp") => currency+" "+new Intl.NumberFormat("id-ID").format(n||0);
export const dateFmt = (s:string) => s ? new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric"}).format(new Date(s)) : "—";
export const isoToday = () => new Date().toISOString().slice(0,10);
export const invoice = (n:number) => "INV-"+String(n).padStart(5,"0");
export const daysLeft = (s:string) => s ? Math.ceil((new Date(s+"T12:00:00").getTime()-Date.now())/86400000) : null;
export const addDays = (s:string,days:number) => {const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+Number(days||0));return d.toISOString().slice(0,10);};
export const orderDue = (o:Order) => o.due_date || addDays(o.order_date,o.warranty_days);
export const defaultSettings:Settings={shop_name:"Ruang Order",currency:"Rp",default_warranty:30,receipt_style:"thermal",receipt_color:"#399dc8",buyer_template:"Halo {buyer}, pesanan {invoice} untuk {product} sedang diproses. Cek progres: {link}",account_template:"Halo {buyer}, pesanan {invoice} untuk {product} sudah selesai. Terima kasih!",seller_wa:""};
export type RentalPhase = "none"|"later"|"soon"|"expired"|"logged_out"|"cancelled";
export function rentalPhase(order:Order,now=Date.now()):RentalPhase {
  if(order.status==="Dibatalkan")return "cancelled";
  if(order.logged_out_at)return "logged_out";
  if(!order.rental_end_at)return "none";
  const remaining=new Date(order.rental_end_at).getTime()-now;
  if(!Number.isFinite(remaining))return "none";
  return remaining<=0?"expired":remaining<=3*86400000?"soon":"later";
}
export const rentalEndFmt=(s:string|null|undefined)=>s?new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(s))+" WIB":"—";
export function isoToWibInput(s:string|null|undefined){
  if(!s)return "";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(s));
  const part=(k:string)=>parts.find(x=>x.type===k)?.value||"";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function wibInputToIso(s:string){
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if(!match)return null;
  const [,year,month,day,hour,minute]=match.map(Number);
  const utc=new Date(Date.UTC(year,month-1,day,hour-7,minute));
  return Number.isNaN(utc.getTime())?null:utc.toISOString();
}
export function formatTemplate(template:string,order:Order,link:string) {
  const values:Record<string,string>={buyer:order.buyer,invoice:invoice(order.invoice_seq),product:[order.product_name,order.variant,order.duration].filter(Boolean).join(" · "),status:order.status,link,due:dateFmt(orderDue(order))};
  return template.replace(/\{(buyer|invoice|product|status|link|due)\}/g,(_,key:string)=>values[key]||"");
}
