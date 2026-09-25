"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ArrowLeft, Heart, Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Result = {order:{invoice_seq:number;product_name:string;variant:string;duration:string;order_date:string;due_date:string;warranty_days:number;rental_end_at:string|null;status:string;public_note:string;updated_at:string};events:{status:string;note:string;created_at:string}[]};
const date = (s:string) => s ? new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(new Date(s)) : "—";
const dueDate = (order:Result["order"]) => {
  if (order.due_date) return order.due_date;
  if (!order.order_date || !order.warranty_days) return "";
  const value = new Date(order.order_date + "T12:00:00");
  value.setDate(value.getDate() + order.warranty_days);
  return value.toISOString().slice(0,10);
};
export default function Tracker() {
  const [code,setCode]=useState("");
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [dark,setDark]=useState(false);
  useEffect(()=>{ const p=new URLSearchParams(location.search).get("kode"); if(p) {setCode(p); void search(p);} },[]);
  useEffect(()=>{document.documentElement.classList.toggle("dark",dark);},[dark]);
  async function search(value=code) {
    let parsed=value.trim();
    try {if(parsed.startsWith("http")) parsed=new URL(parsed).searchParams.get("kode")||parsed;} catch {}
    setError(""); setResult(null); setLoading(true);
    try {
      const r=await fetch("/api/progress?code="+encodeURIComponent(parsed));
      const data=await r.json() as Result & {error?:string};
      if(!r.ok) throw new Error(data.error||"Kode order tidak ditemukan.");
      setResult(data);
      history.replaceState(null,"","/cek?kode="+encodeURIComponent(parsed));
    } catch(e) {setError(e instanceof Error?e.message:"Gagal memeriksa order.");}
    finally {setLoading(false);}
  }
  return <main className="soft-bg min-h-screen px-4 py-9 sm:py-14">
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={18}/> Ruang Order</Link>
        <Button variant="ghost" size="icon" aria-label="Ganti tema" onClick={()=>setDark(!dark)}>{dark?<Sun size={19}/>:<Moon size={19}/>}</Button>
      </div>
      <div className="glass rounded-[28px] p-6 sm:p-9">
        <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Search size={23}/></div>
        <h1 className="serif text-3xl sm:text-4xl">Cek progres pesanan</h1>
        <p className="mt-2 text-muted-foreground">Masukkan kode order atau tempel link yang dikirim penjual.</p>
        <form onSubmit={e=>{e.preventDefault();void search();}} className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Input aria-label="Kode order" placeholder="Contoh: RO-..." value={code} onChange={e=>setCode(e.target.value)} className="h-12 flex-1 rounded-xl bg-card px-4 text-base"/>
          <Button className="h-12 rounded-xl px-7" disabled={!code.trim()||loading}>{loading?"Memeriksa...":"Cek order"}</Button>
        </form>
        {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      </div>
      {result&&<div className="glass mt-5 rounded-[28px] p-6 sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-semibold tracking-wide text-muted-foreground">INV-{String(result.order.invoice_seq).padStart(5,"0")}</p><h2 className="serif mt-1 text-2xl">{result.order.product_name}</h2><p className="mt-1 text-sm text-muted-foreground">{[result.order.variant,result.order.duration].filter(Boolean).join(" · ")}</p></div>
          <span className={"status-pill status-"+result.order.status}>{result.order.status}</span>
        </div>
        <div className="mt-7 grid gap-3 rounded-2xl bg-secondary/60 p-5 sm:grid-cols-2">
          <div><span className="text-sm text-muted-foreground">Tanggal order</span><p className="mt-1 font-semibold">{date(result.order.order_date)}</p></div>
          <div><span className="text-sm text-muted-foreground">Garansi / jatuh tempo</span><p className="mt-1 font-semibold">{date(dueDate(result.order))}</p></div>
          {result.order.rental_end_at&&<div className="sm:col-span-2"><span className="text-sm text-muted-foreground">Akhir masa sewa aplikasi</span><p className="mt-1 font-semibold">{new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(result.order.rental_end_at))} WIB</p></div>}
        </div>
        {result.order.public_note&&<p className="mt-5 rounded-xl border border-border bg-card p-4">{result.order.public_note}</p>}
        <h3 className="serif mt-8 text-xl">Riwayat progres</h3>
        <ol className="mt-4 space-y-5 border-l-2 border-primary/30 pl-6">{result.events.map((ev,i)=><li key={i} className="relative"><span className="absolute -left-[31px] top-1 flex size-3 rounded-full bg-primary ring-4 ring-card"/><p className="font-semibold">{ev.status}</p><p className="text-sm text-muted-foreground">{date(ev.created_at)}</p>{ev.note&&<p className="mt-1 text-sm">{ev.note}</p>}</li>)}</ol>
      </div>}
      <p className="mt-8 flex items-center justify-center gap-1 text-center text-sm text-muted-foreground"><Heart size={13}/> Informasi status berasal dari penjual pesananmu.</p>
    </div>
  </main>;
}
