"use client";
import {useState} from "react";
import {Bell,CalendarClock,Check,ExternalLink,SquarePen} from "lucide-react";
import {Button} from "@/components/ui/button";
import type {Order} from "./order-types";
import {invoice,rentalEndFmt,rentalPhase} from "./order-types";

type Props={orders:Order[];sellerWa:string;now:number;browserAlerts:boolean;enableBrowserAlerts:()=>Promise<void>;openEditor:(order:Order)=>void;openSettings:()=>void;markLogout:(order:Order,completed:boolean)=>Promise<void>};
const card="glass rounded-[22px] p-5 sm:p-6";
export function LogoutView({orders,sellerWa,now,browserAlerts,enableBrowserAlerts,openEditor,openSettings,markLogout}:Props){
  const [filter,setFilter]=useState<"pending"|"all">("pending"),[busy,setBusy]=useState<string|null>(null);
  const list=orders.filter(o=>o.rental_end_at&&o.status!=="Dibatalkan")
    .filter(o=>filter==="all"||["expired","soon"].includes(rentalPhase(o,now)))
    .sort((a,b)=>{
      const priority=(o:Order)=>({expired:0,soon:1,later:2,logged_out:3,none:4,cancelled:5})[rentalPhase(o,now)];
      return priority(a)-priority(b)||new Date(a.rental_end_at||0).getTime()-new Date(b.rental_end_at||0).getTime();
    });
  const phone=sellerWa.replace(/\D/g,"").replace(/^0/,"62");
  async function complete(o:Order,flag:boolean){setBusy(o.id);try{await markLogout(o,flag);}catch{}finally{setBusy(null);}}
  return <div className="space-y-4">
    <div className={card+" flex flex-wrap items-center justify-between gap-4"}>
      <div><h2 className="font-semibold">Peringatan masa sewa</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pengingat muncul 3 hari sebelum waktu akhir dan tetap ada sampai kamu menandai logout selesai. Isi akhir masa sewa pada setiap order aplikasi.</p></div>
      {!browserAlerts&&<Button variant="outline" onClick={()=>void enableBrowserAlerts()} className="rounded-xl"><Bell size={16}/> Aktifkan notifikasi browser</Button>}
      {browserAlerts&&<span className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><Check size={16}/> Notifikasi saat web terbuka aktif</span>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2"><Button variant={filter==="pending"?"default":"outline"} onClick={()=>setFilter("pending")} className="rounded-xl">Perlu dicek</Button><Button variant={filter==="all"?"default":"outline"} onClick={()=>setFilter("all")} className="rounded-xl">Semua sewa</Button></div>
      {!phone&&<button className="text-sm font-semibold text-primary underline" onClick={openSettings}>Isi nomor WA seller untuk tombol pengingat</button>}
    </div>
    {!list.length?<div className={card+" py-12 text-center"}><CalendarClock className="mx-auto mb-3 text-primary" size={30}/><p className="font-semibold">{filter==="pending"?"Belum ada sewa yang perlu ditindaklanjuti.":"Belum ada waktu akhir sewa yang dicatat."}</p><p className="mt-1 text-sm text-muted-foreground">{filter==="pending"?"Order akan muncul di sini saat tersisa 3 hari atau sudah habis.":"Buka order, lalu isi tanggal dan jam akhir masa sewa (WIB)."}</p></div>
      :<div className="grid gap-3 lg:grid-cols-2">{list.map(o=>{
        const phase=rentalPhase(o,now),remaining=Math.max(0,new Date(o.rental_end_at||0).getTime()-now);
        const msg=`Pengingat logout ${invoice(o.invoice_seq)}: ${o.buyer} · ${o.product_name}${o.variant?" ("+o.variant+")":""}. Masa sewa berakhir ${rentalEndFmt(o.rental_end_at)}. Mohon keluarkan akun buyer dari aplikasi dan tandai selesai di Ruang Order.`;
        return <article key={o.id} className={card+" flex flex-col gap-4"}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm text-muted-foreground">{invoice(o.invoice_seq)}</p><h3 className="mt-1 text-lg font-semibold">{o.buyer}</h3><p className="text-sm text-muted-foreground">{[o.product_name,o.variant,o.duration].filter(Boolean).join(" · ")}</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${phase==="expired"?"bg-red-100 text-red-800":phase==="soon"?"bg-amber-100 text-amber-800":phase==="logged_out"?"bg-green-100 text-green-800":"bg-secondary text-primary"}`}>{phase==="expired"?"Perlu logout":phase==="soon"?"Segera habis":phase==="logged_out"?"Sudah logout":"Aktif"}</span></div>
          <div className="rounded-xl bg-secondary/60 p-4"><p className="text-sm text-muted-foreground">Akhir masa sewa</p><p className="font-semibold">{rentalEndFmt(o.rental_end_at)}</p>{phase==="soon"&&<p className="mt-1 text-sm">Sekitar {Math.ceil(remaining/3600000)} jam lagi</p>}{o.logged_out_at&&<p className="mt-1 text-sm text-muted-foreground">Ditandai logout: {rentalEndFmt(o.logged_out_at)}</p>}</div>
          <div className="mt-auto flex flex-wrap gap-2">{phase!=="logged_out"?<Button disabled={busy===o.id} onClick={()=>void complete(o,true)} className="rounded-xl"><Check size={16}/> Sudah logout</Button>:<Button disabled={busy===o.id} variant="outline" onClick={()=>void complete(o,false)} className="rounded-xl">Batalkan tanda</Button>}
            <Button variant="outline" onClick={()=>openEditor(o)} className="rounded-xl"><SquarePen size={16}/> Edit</Button>
            {phone&&<a className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:text-primary" href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">WA saya <ExternalLink size={15}/></a>}</div>
        </article>;
      })}</div>}
    <p className="text-sm text-muted-foreground">Tombol “Sudah logout” hanya mencatat tindakanmu. Keluarkan akun buyer dari aplikasi terkait terlebih dahulu. Pesan WhatsApp dibuka untuk kamu kirim sendiri.</p>
  </div>;
}
