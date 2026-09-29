import {bad,date,failed,filter,money,optionalDate,positive,rest,status,str,timestamp,unauthorized,verifiedOwner} from "@/lib/supabase-server";
import type {Order,Product,Supplier,Expense,BuyerNote,Settings} from "@/components/order-types";
export const dynamic="force-dynamic";
type Payload=Record<string,unknown>;
const q=(table:string,values:Record<string,string>)=>table+filter(values);
async function parse(request:Request):Promise<Payload|null>{try{const x=await request.json();return x&&typeof x==="object"&&!Array.isArray(x)?x:null;}catch{return null;}}
function rental(value:unknown){return value?timestamp(value):null;}
function trackingCode(){const bytes=crypto.getRandomValues(new Uint8Array(10));return "RO-"+Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();}
function orderValues(x:Payload){return {
  buyer:str(x.buyer,120),buyer_wa:str(x.buyer_wa,40),product_name:str(x.product_name,120),variant:str(x.variant,120),duration:str(x.duration,80),device:str(x.device,60),location:str(x.location,90),
  price:money(x.price),cost:money(x.cost),quantity:positive(x.quantity),supplier:str(x.supplier,120),supplier_admin:str(x.supplier_admin,120),order_date:date(x.order_date),due_date:optionalDate(x.due_date),
  warranty_days:money(x.warranty_days),rental_end_at:rental(x.rental_end_at),status:status(x.status),notes:str(x.notes,3000),public_note:str(x.public_note,1000),refund_amount:money(x.refund_amount)};}
const idOK=(id:string)=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id);

export async function GET(request:Request){
  try{
    const auth=await verifiedOwner(request);if(!auth)return unauthorized();const id="eq."+auth.id,t=auth.token;
    const [orders,products,suppliers,expenses,buyerNotes,settings]=await Promise.all([
      rest<Order[]>(q("orders",{select:"*",owner_id:id,order:"created_at.desc"}),t),
      rest<Product[]>(q("products",{select:"*",owner_id:id,order:"sort_order.asc,name.asc,created_at.asc"}),t),
      rest<Supplier[]>(q("suppliers",{select:"*",owner_id:id,order:"name.asc"}),t),
      rest<Expense[]>(q("expenses",{select:"*",owner_id:id,order:"date.desc,created_at.desc"}),t),
      rest<BuyerNote[]>(q("buyer_notes",{select:"*",owner_id:id,order:"buyer.asc"}),t),
      rest<Settings[]>(q("shop_settings",{select:"*",owner_id:id}),t),
    ]);
    return Response.json({orders,products,suppliers,expenses,buyerNotes,settings:settings[0]||null},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return failed(error);}
}
export async function POST(request:Request){
  try{
    const auth=await verifiedOwner(request);if(!auth)return unauthorized();const data=await parse(request);if(!data)return bad("Isi formulir tidak valid.");
    const kind=str(data.kind,30),id=crypto.randomUUID(),now=new Date().toISOString(),owner_id=auth.id,t=auth.token;
    if(kind==="order"){
      const values=orderValues(data);if(!values.buyer||!values.product_name)return bad("Nama buyer dan produk wajib diisi.");
      if(data.rental_end_at&&!values.rental_end_at)return bad("Waktu akhir sewa tidak valid.");
      const rows=await rest<Order[]>("orders",t,"POST",{id,owner_id,tracking_code:trackingCode(),...values,created_at:now,updated_at:now},"return=representation");
      return Response.json({item:rows[0]},{status:201});
    }
    if(kind==="product"){
      const name=str(data.name,120);if(!name)return bad("Nama produk wajib diisi.");
      await rest("products",t,"POST",{id,owner_id,name,variant:str(data.variant,120),duration:str(data.duration,80),cost:money(data.cost),price:money(data.price),supplier:str(data.supplier,120),sort_order:positive(data.sort_order,1),created_at:now});
    }else if(kind==="supplier"){
      const name=str(data.name,120);if(!name)return bad("Nama supplier wajib diisi.");
      await rest("suppliers",t,"POST",{id,owner_id,name,admin:str(data.admin,120),contact:str(data.contact,80),created_at:now});
    }else if(kind==="expense"){
      const title=str(data.title,160);if(!title)return bad("Nama pengeluaran wajib diisi.");
      await rest("expenses",t,"POST",{id,owner_id,title,amount:money(data.amount),date:date(data.date),notes:str(data.notes,500),created_at:now});
    }else if(kind==="buyer_note"){
      const buyer=str(data.buyer,120);if(!buyer)return bad("Nama buyer wajib diisi.");
      await rest(q("buyer_notes",{on_conflict:"owner_id,buyer"}),t,"POST",{id,owner_id,buyer,notes:str(data.notes,2000),updated_at:now},"resolution=merge-duplicates");
    }else return bad("Jenis data tidak dikenal.");
    return Response.json({ok:true,id},{status:201});
  }catch(error){return failed(error);}
}
export async function PATCH(request:Request){
  try{
    const auth=await verifiedOwner(request);if(!auth)return unauthorized();const data=await parse(request);if(!data)return bad("Isi formulir tidak valid.");
    const kind=str(data.kind,30),id=str(data.id,80),t=auth.token,owner_id=auth.id,now=new Date().toISOString();
    if(kind!=="settings"&&!idOK(id))return bad("ID tidak valid.");
    const path=(table:string)=>q(table,{id:"eq."+id,owner_id:"eq."+owner_id});
    if(kind==="logout"){
      const rows=await rest<Order[]>(path("orders"),t,"PATCH",{logged_out_at:data.completed?now:null,updated_at:now},"return=representation");
      if(!rows.length)return Response.json({error:"Order tidak ditemukan."},{status:404});
    }else if(kind==="order"){
      const values=orderValues(data);if(!values.buyer||!values.product_name)return bad("Nama buyer dan produk wajib diisi.");
      if(data.rental_end_at&&!values.rental_end_at)return bad("Waktu akhir sewa tidak valid.");
      const existing=await rest<Pick<Order,"rental_end_at"|"logged_out_at">[]>(q("orders",{select:"rental_end_at,logged_out_at",id:"eq."+id,owner_id:"eq."+owner_id}),t);
      if(!existing.length)return Response.json({error:"Order tidak ditemukan."},{status:404});
      const oldEnd=existing[0].rental_end_at?new Date(existing[0].rental_end_at).getTime():null;
      const newEnd=values.rental_end_at?new Date(values.rental_end_at).getTime():null;
      await rest(path("orders"),t,"PATCH",{...values,...(oldEnd!==newEnd?{logged_out_at:null}:{}),updated_at:now});
    }else if(kind==="product"){
      if(!str(data.name,120))return bad("Nama produk wajib diisi.");
      await rest(path("products"),t,"PATCH",{name:str(data.name,120),variant:str(data.variant,120),duration:str(data.duration,80),cost:money(data.cost),price:money(data.price),supplier:str(data.supplier,120)});
    }else if(kind==="supplier"){
      if(!str(data.name,120))return bad("Nama supplier wajib diisi.");
      await rest(path("suppliers"),t,"PATCH",{name:str(data.name,120),admin:str(data.admin,120),contact:str(data.contact,80)});
    }else if(kind==="expense"){
      if(!str(data.title,160))return bad("Nama pengeluaran wajib diisi.");
      await rest(path("expenses"),t,"PATCH",{title:str(data.title,160),amount:money(data.amount),date:date(data.date),notes:str(data.notes,500)});
    }else if(kind==="buyer_note"){
      await rest(path("buyer_notes"),t,"PATCH",{notes:str(data.notes,2000),updated_at:now});
    }else if(kind==="settings"){
      const color=str(data.receipt_color,7);if(!/^#[0-9a-fA-F]{6}$/.test(color))return bad("Warna nota tidak valid.");
      await rest(q("shop_settings",{on_conflict:"owner_id"}),t,"POST",{owner_id,shop_name:str(data.shop_name,100)||"Miuu Store",currency:str(data.currency,8)||"Rp",default_warranty:money(data.default_warranty),receipt_style:["thermal","ticket"].includes(str(data.receipt_style))?str(data.receipt_style):"thermal",receipt_color:color,buyer_template:str(data.buyer_template,2000),account_template:str(data.account_template,2000),seller_wa:str(data.seller_wa,40),updated_at:now},"resolution=merge-duplicates");
    }else return bad("Jenis data tidak dikenal.");
    return Response.json({ok:true});
  }catch(error){return failed(error);}
}
export async function DELETE(request:Request){
  try{
    const auth=await verifiedOwner(request);if(!auth)return unauthorized();const data=await parse(request);if(!data)return bad("Isi formulir tidak valid.");
    const kind=str(data.kind,30),id=str(data.id,80),table=({order:"orders",product:"products",supplier:"suppliers",expense:"expenses",buyer_note:"buyer_notes"} as Record<string,string>)[kind];
    if(!table||!idOK(id))return bad("Jenis data atau ID tidak valid.");
    await rest(q(table,{id:"eq."+id,owner_id:"eq."+auth.id}),auth.token,"DELETE");
    return Response.json({ok:true});
  }catch(error){return failed(error);}
}