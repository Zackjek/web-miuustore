"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import type { Order,Product,Supplier,Settings } from "./order-types";
import { isoToday, defaultSettings, isoToWibInput, wibInputToIso } from "./order-types";

const label = "mb-1.5 block text-sm font-semibold text-foreground/80";
const field = "h-10 rounded-xl bg-card px-3 text-base";
const statuses = ["Baru","Diproses","Menunggu","Selesai","Dibatalkan"];

export function OrderForm({initial,products,suppliers,settings,onSubmit,pending}:{initial?:Order|null;products:Product[];suppliers:Supplier[];settings:Settings|null;onSubmit:(v:Record<string,unknown>)=>Promise<void>;pending:boolean}) {
  const [v,setV]=useState<Record<string,string|number>>({
    buyer:initial?.buyer||"",buyer_wa:initial?.buyer_wa||"",product_name:initial?.product_name||"",
    variant:initial?.variant||"",duration:initial?.duration||"",device:initial?.device||"",
    location:initial?.location||"Indonesia",price:initial?.price||0,cost:initial?.cost||0,
    quantity:initial?.quantity||1,supplier:initial?.supplier||"",supplier_admin:initial?.supplier_admin||"",
    order_date:initial?.order_date||isoToday(),due_date:initial?.due_date||"",
    rental_end_at:isoToWibInput(initial?.rental_end_at),
    warranty_days:initial?.warranty_days??settings?.default_warranty??defaultSettings.default_warranty,
    status:initial?.status||"Diproses",notes:initial?.notes||"",public_note:initial?.public_note||"",
    refund_amount:initial?.refund_amount||0,
  });
  const [productId,setProductId]=useState("custom");
  const set=(key:string,value:string|number)=>setV(current=>({...current,[key]:value}));
  const submit=(e:FormEvent)=>{e.preventDefault();void onSubmit({...v,rental_end_at:wibInputToIso(String(v.rental_end_at))});};
  const profit=(Number(v.price)-Number(v.cost))*Number(v.quantity)-Number(v.refund_amount);
  return <form onSubmit={submit} className="max-h-[min(72vh,800px)] space-y-5 overflow-y-auto pr-1">
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-primary">Info buyer</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className={label} htmlFor="order-buyer">Buyer *</label><Input id="order-buyer" required className={field} placeholder="@nama buyer" value={String(v.buyer)} onChange={e=>set("buyer",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-wa">No. WhatsApp buyer</label><Input id="order-wa" className={field} placeholder="08..." value={String(v.buyer_wa)} onChange={e=>set("buyer_wa",e.target.value)}/></div>
    </div>
    <div className="miuu-note-panel mt-4 rounded-2xl p-4">
      <p className="mb-3 text-sm font-bold text-primary">✎ &nbsp;Catatan order</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="order-public">Catatan progres untuk buyer</label><p id="order-public-hint" className="mb-2 text-xs text-muted-foreground">Terlihat di link progres pesanan</p><Textarea id="order-public" aria-describedby="order-public-hint" className="min-h-24 rounded-xl bg-card" placeholder="Contoh: akun sedang disiapkan" value={String(v.public_note)} onChange={e=>set("public_note",e.target.value)}/></div>
        <div><label className={label} htmlFor="order-notes">Catatan pribadi</label><p id="order-notes-hint" className="mb-2 text-xs text-muted-foreground">Hanya kamu yang bisa melihatnya</p><Textarea id="order-notes" aria-describedby="order-notes-hint" className="min-h-24 rounded-xl bg-card" placeholder="Detail internal untuk toko" value={String(v.notes)} onChange={e=>set("notes",e.target.value)}/></div>
      </div>
    </div>
    </div>
    <div className="border-t border-border pt-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-primary">Detail pesanan</p>
    <div><span className={label}>Pilih dari katalog (opsional)</span><Select value={productId} onValueChange={id=>{setProductId(id);const p=products.find(x=>x.id===id);if(p)setV(current=>({...current,product_name:p.name,variant:p.variant,duration:p.duration,price:p.price,cost:p.cost,supplier:p.supplier}));}}><SelectTrigger className="h-10 w-full rounded-xl bg-card text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="custom">Isi produk sendiri</SelectItem>{products.map(p=><SelectItem key={p.id} value={p.id}>{[p.name,p.variant,p.duration].filter(Boolean).join(" · ")} — Rp {p.price.toLocaleString("id-ID")}</SelectItem>)}</SelectContent></Select></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div><label className={label} htmlFor="order-product">Aplikasi / produk *</label><Input id="order-product" required className={field} placeholder="Netflix" value={String(v.product_name)} onChange={e=>set("product_name",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-variant">Tipe / paket</label><Input id="order-variant" className={field} placeholder="Sharing 1P1U" value={String(v.variant)} onChange={e=>set("variant",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-duration">Durasi</label><Input id="order-duration" className={field} placeholder="1 Bulan" value={String(v.duration)} onChange={e=>set("duration",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-qty">Jumlah</label><Input id="order-qty" type="number" min="1" className={field} value={Number(v.quantity)} onChange={e=>set("quantity",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-device">Device</label><Input id="order-device" className={field} placeholder="iPhone / Android" value={String(v.device)} onChange={e=>set("device",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-location">Lokasi</label><Input id="order-location" className={field} value={String(v.location)} onChange={e=>set("location",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-price">Harga jual (Rp)</label><Input id="order-price" type="number" min="0" className={field} value={Number(v.price)} onChange={e=>set("price",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-cost">Modal / FH (Rp)</label><Input id="order-cost" type="number" min="0" className={field} value={Number(v.cost)} onChange={e=>set("cost",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-date">Tanggal order</label><Input id="order-date" type="date" className={field} value={String(v.order_date)} onChange={e=>set("order_date",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-due">Tanggal jatuh tempo</label><Input id="order-due" type="date" className={field} value={String(v.due_date)} onChange={e=>set("due_date",e.target.value)}/></div>
      <div className="sm:col-span-2"><label className={label} htmlFor="rental-end">Akhir masa sewa aplikasi (WIB)</label><Input id="rental-end" type="datetime-local" className={field} value={String(v.rental_end_at)} onChange={e=>set("rental_end_at",e.target.value)}/><p className="mt-1 text-sm text-muted-foreground">Isi untuk mengaktifkan pengingat logout. Kosongkan bila order ini bukan sewa aplikasi. Waktu ini terpisah dari garansi.</p></div>
      <div><label className={label} htmlFor="order-warranty">Garansi (hari)</label><Input id="order-warranty" type="number" min="0" className={field} value={Number(v.warranty_days)} onChange={e=>set("warranty_days",e.target.value)}/></div>
      <div><span className={label}>Status order</span><Select value={String(v.status)} onValueChange={x=>set("status",x)}><SelectTrigger className="h-10 w-full rounded-xl bg-card"><SelectValue/></SelectTrigger><SelectContent>{statuses.map(s=><SelectItem value={s} key={s}>{s}</SelectItem>)}</SelectContent></Select></div>
      <div><label className={label} htmlFor="order-supplier">Supplier / FH</label><Input id="order-supplier" list="supplier-list" className={field} placeholder="Nama supplier" value={String(v.supplier)} onChange={e=>set("supplier",e.target.value)}/><datalist id="supplier-list">{suppliers.map(s=><option key={s.id} value={s.name}/>)}</datalist></div>
      <div><label className={label} htmlFor="order-admin">Admin supplier</label><Input id="order-admin" className={field} placeholder="Opsional" value={String(v.supplier_admin)} onChange={e=>set("supplier_admin",e.target.value)}/></div>
      <div><label className={label} htmlFor="order-refund">Refund tersimpan (Rp)</label><Input id="order-refund" type="number" min="0" className={field} value={Number(v.refund_amount)} onChange={e=>set("refund_amount",e.target.value)}/></div>
      <div className="flex items-end"><div className="w-full rounded-xl bg-secondary p-3 text-sm">Perkiraan profit <strong className="block text-lg text-primary">Rp {profit.toLocaleString("id-ID")}</strong></div></div>
    </div>
    </div>
    <div className="sticky bottom-0 flex justify-end gap-3 bg-card/95 py-3"><Button type="submit" disabled={pending} className="h-11 rounded-xl px-7">{pending?"Menyimpan...":initial?"Simpan perubahan":"Simpan order ♡"}</Button></div>
  </form>;
}

export function ProductForm({initial,onSubmit,pending}:{initial?:Product|null;onSubmit:(v:Record<string,unknown>)=>Promise<void>;pending:boolean}) {
  const [v,setV]=useState({name:initial?.name||"",variant:initial?.variant||"",duration:initial?.duration||"",cost:initial?.cost||0,price:initial?.price||0,supplier:initial?.supplier||""});
  const set=(k:string,value:string|number)=>setV(c=>({...c,[k]:value}));
  return <form onSubmit={e=>{e.preventDefault();void onSubmit(v);}} className="space-y-4">
    <div><label className={label} htmlFor="p-name">Aplikasi / produk *</label><Input id="p-name" required className={field} placeholder="Canva" value={v.name} onChange={e=>set("name",e.target.value)}/></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className={label} htmlFor="p-variant">Tipe</label><Input id="p-variant" className={field} placeholder="Private / Sharing" value={v.variant} onChange={e=>set("variant",e.target.value)}/></div>
      <div><label className={label} htmlFor="p-duration">Durasi</label><Input id="p-duration" className={field} placeholder="1 Bulan" value={v.duration} onChange={e=>set("duration",e.target.value)}/></div>
      <div><label className={label} htmlFor="p-cost">Harga FH / modal</label><Input id="p-cost" type="number" min="0" className={field} value={v.cost} onChange={e=>set("cost",Number(e.target.value))}/></div>
      <div><label className={label} htmlFor="p-price">Harga jual</label><Input id="p-price" type="number" min="0" className={field} value={v.price} onChange={e=>set("price",Number(e.target.value))}/></div>
    </div>
    <div><label className={label} htmlFor="p-supplier">FH / supplier (opsional)</label><Input id="p-supplier" className={field} value={v.supplier} onChange={e=>set("supplier",e.target.value)}/></div>
    <p className="rounded-xl bg-secondary p-3 text-sm">Profit per item: <strong className="text-primary">Rp {(Number(v.price)-Number(v.cost)).toLocaleString("id-ID")}</strong></p>
    <div className="flex justify-end"><Button disabled={pending} className="rounded-xl px-6">{pending?"Menyimpan...":initial?"Simpan perubahan":"Tambah produk"}</Button></div>
  </form>;
}