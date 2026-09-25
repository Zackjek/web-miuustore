"use client";
import { useCallback,useEffect,useMemo,useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LayoutDashboard,ReceiptText,Package,Calculator,HeartHandshake,CalendarDays,Truck,Users,ChartNoAxesCombined,MessageSquareText,Megaphone,Image as ImageIcon,Settings as SettingsIcon,Plus,Search,Sun,Moon,LogOut,Copy,SquarePen,Trash2,ExternalLink,ArrowRight,Clock3,ShoppingBag,Wallet,FileText,Bell } from "lucide-react";
import { SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarGroup,SidebarGroupLabel,SidebarGroupContent,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarFooter,SidebarInset,SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from "@/components/ui/alert-dialog";
import { Table,TableHeader,TableBody,TableRow,TableHead,TableCell } from "@/components/ui/table";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { OrderForm,ProductForm } from "./order-forms";
import { ExtraView,SimpleForm,ReceiptView } from "./workspace-views";
import { LogoutView } from "./logout-view";
import { authFetch } from "@/lib/browser-auth";
import type { Store,View,Order,Product,Supplier,Expense,BuyerNote } from "./order-types";
import { moneyFmt,dateFmt,invoice,defaultSettings,orderDue,daysLeft,rentalPhase,rentalEndFmt } from "./order-types";

const navigation:{title:string;items:{view:View;label:string;icon:typeof Package}[]}[]=[
  {title:"RUANG KERJA",items:[
    {view:"dashboard",label:"Dashboard",icon:LayoutDashboard},{view:"orders",label:"Orders",icon:ReceiptText},
    {view:"products",label:"Products",icon:Package},{view:"calculator",label:"Calculator",icon:Calculator},
  ]},
  {title:"PELANGGAN & TOKO",items:[
    {view:"logout",label:"Pengingat logout",icon:Bell},
    {view:"warranty",label:"Warranty & reminder",icon:HeartHandshake},{view:"calendar",label:"Kalender jatuh tempo",icon:CalendarDays},
    {view:"suppliers",label:"Data FH",icon:Truck},{view:"buyers",label:"Buyer favorit",icon:Users},
  ]},
  {title:"ALAT LAINNYA",items:[
    {view:"profit",label:"Profit & keuangan",icon:ChartNoAxesCombined},{view:"formats",label:"Formats",icon:MessageSquareText},
    {view:"promo",label:"Promo text",icon:Megaphone},{view:"watermark",label:"Watermark",icon:ImageIcon},
    {view:"settings",label:"Settings",icon:SettingsIcon},
  ]},
];
const empty:Store={orders:[],products:[],suppliers:[],expenses:[],buyerNotes:[],settings:null};
type Editor = {kind:"order"|"product"|"supplier"|"expense"|"buyer_note";item?:Order|Product|Supplier|Expense|BuyerNote|null};
type DeleteTarget={kind:string;id:string;label:string};
const card="glass rounded-[22px] p-5 sm:p-6";

export default function Workspace({displayName,onSignOut}:{displayName:string;onSignOut:()=>void}) {
  const [data,setData]=useState<Store>(empty);
  const [view,setView]=useState<View>("dashboard");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [editor,setEditor]=useState<Editor|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<DeleteTarget|null>(null);
  const [receipt,setReceipt]=useState<Order|null>(null);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [monthFilter,setMonthFilter]=useState("all");
  const [appFilter,setAppFilter]=useState("all");
  const [dark,setDark]=useState(false);
  const [now,setNow]=useState(Date.now());
  const [browserAlerts,setBrowserAlerts]=useState(false);
  const [pasteOpen,setPasteOpen]=useState(false);
  const [pasteText,setPasteText]=useState("");
  const [mobileMenu,setMobileMenu]=useState(false);
  const settings=data.settings||defaultSettings;
  const currency=settings.currency;

  const load=useCallback(async()=>{
    try{
      const response=await authFetch("/api/data",{cache:"no-store"});
      const body=await response.json() as Store & {error?:string};
      if(!response.ok) throw new Error(body.error||"Data belum dapat dimuat.");
      setData(body);setError("");
    }catch(e){setError(e instanceof Error?e.message:"Data belum dapat dimuat.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();const stored=localStorage.getItem("ruang-order-theme");setDark(stored==="dark");setBrowserAlerts(localStorage.getItem("ruang-order-browser-alerts")==="1");},[load]);
  useEffect(()=>{const tick=()=>setNow(Date.now());const refresh=()=>{tick();void load();};const timer=setInterval(tick,30_000);const poll=setInterval(()=>{if(!document.hidden)void load();},60_000);window.addEventListener("focus",refresh);return()=>{clearInterval(timer);clearInterval(poll);window.removeEventListener("focus",refresh);};},[load]);
  useEffect(()=>{document.documentElement.classList.toggle("dark",dark);localStorage.setItem("ruang-order-theme",dark?"dark":"light");},[dark]);
  const navigate=(next:View)=>{setView(next);setQuery("");setMobileMenu(false);window.scrollTo({top:0,behavior:"smooth"});};
  const mutate=useCallback(async(method:"POST"|"PATCH"|"DELETE",payload:Record<string,unknown>,message="Tersimpan")=>{
    setBusy(true);
    try{
      const response=await authFetch("/api/data",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const body=await response.json() as {error?:string};
      if(!response.ok) throw new Error(body.error||"Perubahan gagal disimpan.");
      await load();setEditor(null);setDeleteTarget(null);toast.success(message);
      return body;
    }catch(e){toast.error(e instanceof Error?e.message:"Gagal menyimpan.");throw e;}
    finally{setBusy(false);}
  },[load]);
  const saveEditor=async(v:Record<string,unknown>)=>{
    if(!editor)return;
    const hasId=!!editor.item?.id;
    await mutate(hasId?"PATCH":"POST",{...v,kind:editor.kind,...(hasId?{id:editor.item?.id}:{})},hasId?"Perubahan disimpan":"Data ditambahkan");
  };
  const copy=async(text:string,message="Tersalin")=>{try{await navigator.clipboard.writeText(text);toast.success(message);}catch{toast.error("Gagal menyalin. Coba lagi.");}};
  const trackingLink=(o:Order)=>location.origin+"/cek?kode="+encodeURIComponent(o.tracking_code);
  const orderSearch=data.orders.filter(o=>{
    const matched=(o.buyer+" "+o.product_name+" "+o.variant+" "+invoice(o.invoice_seq)).toLowerCase().includes(query.toLowerCase());
    return matched&&(statusFilter==="all"||o.status===statusFilter)&&(monthFilter==="all"||o.order_date.slice(0,7)===monthFilter)&&(appFilter==="all"||o.product_name===appFilter);
  });
  const productSearch=data.products.filter(p=>(p.name+" "+p.variant+" "+p.duration).toLowerCase().includes(query.toLowerCase()));
  const totalRevenue=data.orders.reduce((n,o)=>n+o.price*o.quantity-o.refund_amount,0);
  const totalCost=data.orders.reduce((n,o)=>n+o.cost*o.quantity,0);
  const totalProfit=totalRevenue-totalCost-data.expenses.reduce((n,e)=>n+e.amount,0);
  const active=data.orders.filter(o=>!["Selesai","Dibatalkan"].includes(o.status)).length;
  const dueSoon=data.orders.filter(o=>{const d=daysLeft(orderDue(o));return d!==null&&d>=0&&d<=3&&o.status!=="Dibatalkan";}).length;
  const rentAlerts=data.orders.filter(o=>["soon","expired"].includes(rentalPhase(o,now))).sort((a,b)=>new Date(a.rental_end_at||0).getTime()-new Date(b.rental_end_at||0).getTime());
  const expired=rentAlerts.filter(o=>rentalPhase(o,now)==="expired");
  useEffect(()=>{
    if(!browserAlerts||typeof Notification==="undefined"||Notification.permission!=="granted")return;
    for(const order of rentAlerts){
      const phase=rentalPhase(order,now),key=`ruang-alert-${order.id}-${order.rental_end_at}-${phase}`;
      if(localStorage.getItem(key))continue;
      new Notification(phase==="expired"?"Waktunya logout buyer":"Masa sewa segera habis",{body:`${invoice(order.invoice_seq)} · ${order.buyer} · ${order.product_name} · ${rentalEndFmt(order.rental_end_at)}`,tag:key});
      localStorage.setItem(key,"1");
    }
  },[browserAlerts,rentAlerts,now]);
  async function enableBrowserAlerts(){
    if(typeof Notification==="undefined"){toast.error("Browser ini tidak mendukung notifikasi.");return;}
    const permission=await Notification.requestPermission();
    if(permission==="granted"){localStorage.setItem("ruang-order-browser-alerts","1");setBrowserAlerts(true);toast.success("Notifikasi browser aktif selama web terbuka.");}
    else toast.error("Izin notifikasi belum diberikan di browser.");
  }
  const months=[...new Set(data.orders.map(o=>o.order_date.slice(0,7)))].sort().reverse();
  const apps=[...new Set(data.orders.map(o=>o.product_name))].sort();

  async function pasteProducts(){
    const lines=pasteText.split("\n").map(x=>x.trim()).filter(Boolean);
    if(!lines.length)return;
    if(lines.length>50){toast.error("Maksimal 50 baris sekali impor.");return;}
    setBusy(true);
    let done=0;
    try{
      for(const line of lines){
        const [name,variant="",duration="",cost="0",price="0",supplier=""]=line.split("|").map(s=>s.trim());
        if(!name)continue;
        const r=await authFetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"product",name,variant,duration,cost:Number(cost.replace(/[^\d]/g,"")),price:Number(price.replace(/[^\d]/g,"")),supplier})});
        if(!r.ok)throw new Error("Baris "+(done+1)+" gagal. Periksa format dan coba lagi.");
        done++;
      }
      await load();setPasteOpen(false);setPasteText("");toast.success(done+" produk ditambahkan");
    }catch(e){toast.error(e instanceof Error?e.message:"Impor gagal.");await load();}
    finally{setBusy(false);}
  }

  const heading:Record<View,{title:string;sub:string}>={
    dashboard:{title:"Halo, "+displayName+" ♡",sub:"Ini ringkasan order dan toko hari ini."},
    orders:{title:"Little orders",sub:"Catat order, perbarui status, dan bagikan link progres ke buyer."},
    products:{title:"Little shelf",sub:"Daftar aplikasi, varian, harga jual, dan modal."},
    calculator:{title:"Price & refund calculator",sub:"Hitung keuntungan atau refund secara cepat."},
    warranty:{title:"Warranty & reminder",sub:"Pantau masa garansi dan ingatkan buyer tepat waktu."},
    calendar:{title:"Kalender jatuh tempo",sub:"Lihat pesanan yang akan habis dalam satu bulan."},
    logout:{title:"Pengingat logout",sub:"Pantau akhir masa sewa dan cek akun buyer yang perlu dikeluarkan."},
    suppliers:{title:"Data FH",sub:"Simpan daftar supplier dan admin yang menangani."},
    buyers:{title:"Buyer favorit",sub:"Kenali pembeli yang sering kembali."},
    profit:{title:"Profit & keuangan",sub:"Lihat penjualan, modal, refund, dan pengeluaran."},
    formats:{title:"Formats siap-kirim",sub:"Buat pesan buyer dari data order tanpa mengetik ulang."},
    promo:{title:"Promo text",sub:"Susun daftar harga siap salin dari produkmu."},
    watermark:{title:"Watermark foto",sub:"Beri tanda nama toko pada foto bukti."},
    settings:{title:"Settings",sub:"Atur nama toko, nota, format pesan, dan cadangan data."},
  };

  return <SidebarProvider style={{"--sidebar-width":"15.7rem"} as React.CSSProperties} className="soft-bg">
    <Sidebar variant="floating" collapsible="offcanvas" className="border-none bg-transparent">
      <SidebarHeader className="px-5 pb-5 pt-7"><div className="serif text-[1.85rem] leading-none">ruang order <span className="text-primary">✿</span></div><div className="mt-1 text-xs tracking-[.2em] text-muted-foreground">RESELLER TOOLS</div></SidebarHeader>
      <SidebarContent className="px-3">{navigation.map(group=><SidebarGroup key={group.title}><SidebarGroupLabel className="px-3 text-xs tracking-[.15em] text-muted-foreground">{group.title}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{group.items.map(item=><SidebarMenuItem key={item.view}><SidebarMenuButton isActive={view===item.view} onClick={()=>navigate(item.view)} className="h-10 gap-3 rounded-xl px-3 text-[.92rem] data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-md data-[active=true]:shadow-primary/20"><item.icon size={17}/><span>{item.label}</span>{item.view==="logout"&&rentAlerts.length>0&&<span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{rentAlerts.length}</span>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>)}</SidebarContent>
      <SidebarFooter className="p-4"><div className="rounded-2xl border border-border bg-card/75 p-3"><p className="truncate text-sm font-semibold">{displayName}</p><p className="mb-3 text-xs text-muted-foreground">Pengelola toko</p><button onClick={onSignOut} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><LogOut size={15}/> Keluar</button></div></SidebarFooter>
    </Sidebar>
    <SidebarInset className="min-w-0 bg-transparent">
      <header className="no-print sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-border/60 bg-card/55 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
        <SidebarTrigger className="shrink-0 md:hidden"/>
        <div className="relative hidden max-w-[370px] flex-1 md:block"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={e=>{setQuery(e.target.value);if(view!=="orders"&&view!=="products")setView("orders");}} placeholder="Cari buyer, aplikasi, invoice..." className="h-11 rounded-2xl bg-card/90 pl-11 text-sm"/></div>
        <div className="ml-auto flex items-center gap-2"><span className="hidden text-sm text-muted-foreground sm:block">{new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric"}).format(new Date(now))}</span><Link href="/cek" className="hidden rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-primary sm:inline-flex">Cek progres <ExternalLink size={14} className="ml-2"/></Link><button type="button" aria-label={`Pengingat logout, ${rentAlerts.length} perlu dilihat`} onClick={()=>navigate("logout")} className="relative flex size-10 items-center justify-center rounded-full bg-card text-primary hover:bg-accent"><Bell size={20}/>{rentAlerts.length>0&&<span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{rentAlerts.length}</span>}</button><Button variant="ghost" size="icon" aria-label="Ganti tema" onClick={()=>setDark(!dark)} className="rounded-full bg-card">{dark?<Sun size={19}/>:<Moon size={19}/>}</Button></div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-7 sm:px-7 lg:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><h1 className="serif text-[2rem] leading-tight sm:text-[2.45rem]">{heading[view].title}</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">{heading[view].sub}</p></div>{view==="orders"&&<Button onClick={()=>setEditor({kind:"order"})} className="h-11 rounded-xl px-5"><Plus size={17}/> New order</Button>}{view==="products"&&<Button onClick={()=>setEditor({kind:"product"})} className="h-11 rounded-xl px-5"><Plus size={17}/> Tambah produk</Button>}</div>
        {error&&<div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"><p>{error}</p><Button variant="link" onClick={()=>void load()} className="px-0">Coba muat ulang</Button></div>}
        {loading?<div className={card}>Memuat ruang kerja...</div>:<>
          {view==="dashboard"&&<div className="space-y-5">
            {rentAlerts.length>0&&<div role="status" className="rounded-[22px] border border-amber-300 bg-amber-50 p-5 text-amber-950"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{expired.length>0?`${expired.length} akun perlu di-logout`:`${rentAlerts.length} sewa segera habis`}</h2><p className="mt-1 text-sm">{rentAlerts.slice(0,3).map(o=>`${o.buyer} · ${o.product_name}`).join("; ")}{rentAlerts.length>3?` dan ${rentAlerts.length-3} lainnya`:""}</p></div><Button onClick={()=>navigate("logout")} className="rounded-xl"><Bell size={16}/> Lihat pengingat</Button></div></div>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
              {label:"Total orders",value:String(data.orders.length),icon:ShoppingBag,tint:"bg-pink-100 text-pink-700"},
              {label:"Sedang berjalan",value:String(active),icon:Clock3,tint:"bg-purple-100 text-purple-700"},
              {label:"Perlu pengingat logout",value:String(rentAlerts.length),icon:Bell,tint:"bg-amber-100 text-amber-800"},
              {label:"Profit bersih",value:moneyFmt(totalProfit,currency),icon:Wallet,tint:"bg-sky-100 text-sky-700"},
            ].map(s=><div key={s.label} className={card}><div className={"mb-4 flex size-10 items-center justify-center rounded-xl "+s.tint}><s.icon size={20}/></div><p className="text-sm text-muted-foreground">{s.label}</p><strong className="serif mt-1 block text-[1.6rem] font-normal">{s.value}</strong></div>)}</div>
            <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]"><div className={card}><div className="mb-5 flex items-center justify-between"><h2 className="serif text-xl">Order terbaru</h2><button onClick={()=>navigate("orders")} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Lihat semua <ArrowRight size={14}/></button></div>{data.orders.length?<div className="space-y-3">{data.orders.slice(0,5).map(o=><button key={o.id} onClick={()=>setEditor({kind:"order",item:o})} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-3 text-left hover:bg-accent"><div className="min-w-0"><p className="truncate font-semibold">{o.buyer} <span className="text-xs font-normal text-muted-foreground">{invoice(o.invoice_seq)}</span></p><p className="truncate text-sm text-muted-foreground">{[o.product_name,o.variant].filter(Boolean).join(" · ")}</p></div><span className={"status-pill status-"+o.status}>{o.status}</span></button>)}</div>:<EmptyState icon={<ReceiptText size={30}/>} text="Belum ada order masuk." action={<Button onClick={()=>setEditor({kind:"order"})} className="rounded-xl"><Plus size={16}/> Buat order pertama</Button>}/>}</div>
            <div className={card}><h2 className="serif mb-5 text-xl">Quick menu</h2><div className="grid grid-cols-2 gap-3">{[{v:"orders" as View,t:"Tambah order",i:Plus},{v:"products" as View,t:"Katalog produk",i:Package},{v:"calculator" as View,t:"Hitung harga",i:Calculator},{v:"warranty" as View,t:"Cek garansi",i:HeartHandshake}].map(a=><button key={a.t} onClick={()=>a.v==="orders"?setEditor({kind:"order"}):navigate(a.v)} className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl bg-secondary/60 p-3 text-center text-sm font-semibold transition hover:bg-primary hover:text-primary-foreground"><a.i size={23}/>{a.t}</button>)}</div></div></div>
          </div>}
          {view==="orders"&&<div className="space-y-4"><div className={card+" flex flex-wrap gap-3 p-4"}><div className="relative min-w-[210px] flex-1"><Search size={17} className="absolute left-3 top-3 text-muted-foreground"/><Input aria-label="Cari order" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buyer, aplikasi, atau invoice..." className="h-10 rounded-xl bg-card pl-10 text-sm"/></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-10 min-w-36 rounded-xl bg-card"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{["Baru","Diproses","Menunggu","Selesai","Dibatalkan"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Select value={monthFilter} onValueChange={setMonthFilter}><SelectTrigger className="h-10 min-w-36 rounded-xl bg-card"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Semua bulan</SelectItem>{months.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><Select value={appFilter} onValueChange={setAppFilter}><SelectTrigger className="h-10 min-w-36 rounded-xl bg-card"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Semua aplikasi</SelectItem>{apps.map(a=><SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
            {!orderSearch.length?<EmptyState icon={<ReceiptText size={34}/>} text={data.orders.length?"Tidak ada order yang cocok.":"Belum ada order. Tambahkan pesanan pertama untuk mulai mencatat."} action={!data.orders.length?<Button onClick={()=>setEditor({kind:"order"})} className="rounded-xl"><Plus size={16}/> New order</Button>:undefined}/>:<div className={card+" overflow-hidden p-0"}><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead className="pl-5">Invoice / buyer</TableHead><TableHead>Produk</TableHead><TableHead>Status</TableHead><TableHead>Jatuh tempo</TableHead><TableHead>Profit</TableHead><TableHead className="pr-5 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{orderSearch.map(o=><TableRow key={o.id}><TableCell className="pl-5"><p className="font-semibold">{invoice(o.invoice_seq)}</p><p className="text-sm text-muted-foreground">{o.buyer}</p></TableCell><TableCell><p className="font-semibold">{o.product_name}</p><p className="max-w-52 truncate text-sm text-muted-foreground">{[o.variant,o.duration].filter(Boolean).join(" · ")}</p></TableCell><TableCell><span className={"status-pill status-"+o.status}>{o.status}</span></TableCell><TableCell><p>{dateFmt(orderDue(o))}</p>{o.rental_end_at&&<p className="mt-1 text-sm text-muted-foreground">Sewa: {rentalEndFmt(o.rental_end_at)}</p>}</TableCell><TableCell>{moneyFmt((o.price-o.cost)*o.quantity-o.refund_amount,currency)}</TableCell><TableCell className="pr-5"><div className="flex justify-end gap-1"><ActionButton title="Edit order" onClick={()=>setEditor({kind:"order",item:o})}><SquarePen size={17}/></ActionButton><ActionButton title="Lihat nota" onClick={()=>setReceipt(o)}><FileText size={17}/></ActionButton><ActionButton title="Salin link progres" onClick={()=>void copy(trackingLink(o),"Link progres tersalin")}><Copy size={17}/></ActionButton><ActionButton title="Hapus order" onClick={()=>setDeleteTarget({kind:"order",id:o.id,label:invoice(o.invoice_seq)})}><Trash2 size={17}/></ActionButton></div></TableCell></TableRow>)}</TableBody></Table></div><div className="divide-y divide-border md:hidden">{orderSearch.map(o=><div key={o.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><strong>{invoice(o.invoice_seq)} · {o.buyer}</strong><p className="text-sm text-muted-foreground">{[o.product_name,o.variant,o.duration].filter(Boolean).join(" · ")}</p></div><span className={"status-pill status-"+o.status}>{o.status}</span></div><p className="text-sm text-muted-foreground">Jatuh tempo {dateFmt(orderDue(o))}{o.rental_end_at?" · Sewa berakhir "+rentalEndFmt(o.rental_end_at):""} · Profit {moneyFmt((o.price-o.cost)*o.quantity-o.refund_amount,currency)}</p><div className="flex gap-1"><ActionButton title="Edit order" onClick={()=>setEditor({kind:"order",item:o})}><SquarePen size={18}/></ActionButton><ActionButton title="Lihat nota" onClick={()=>setReceipt(o)}><FileText size={18}/></ActionButton><ActionButton title="Salin link progres" onClick={()=>void copy(trackingLink(o))}><Copy size={18}/></ActionButton><ActionButton title="Hapus order" onClick={()=>setDeleteTarget({kind:"order",id:o.id,label:invoice(o.invoice_seq)})}><Trash2 size={18}/></ActionButton></div></div>)}</div></div>}</div>}
          {view==="products"&&<div className="space-y-4"><div className={card+" flex flex-wrap gap-3 p-4"}><Input aria-label="Cari produk" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari aplikasi, tipe, durasi..." className="h-10 min-w-[220px] flex-1 rounded-xl bg-card"/><Button variant="outline" className="h-10 rounded-xl" onClick={()=>setPasteOpen(true)}><FileText size={16}/> Tempel daftar</Button></div>{!productSearch.length?<EmptyState icon={<Package size={34}/>} text={data.products.length?"Produk tidak ditemukan.":"Katalog masih kosong. Tambahkan produk agar harga terisi otomatis saat membuat order."} action={!data.products.length?<Button onClick={()=>setEditor({kind:"product"})} className="rounded-xl"><Plus size={16}/> Tambah produk</Button>:undefined}/>:<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{productSearch.map(p=><div key={p.id} className={card+" flex flex-col"}><div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-semibold">{p.name}</h3><p className="mt-1 text-sm text-muted-foreground">{[p.variant,p.duration].filter(Boolean).join(" · ")||"Tanpa varian"}</p></div><Package size={18} className="text-primary"/></div><div className="mt-5 space-y-2 border-t border-border pt-4 text-sm"><p className="flex justify-between"><span className="text-muted-foreground">Modal</span><span>{moneyFmt(p.cost,currency)}</span></p><p className="flex justify-between"><span className="text-muted-foreground">Harga jual</span><span>{moneyFmt(p.price,currency)}</span></p><p className="flex justify-between font-semibold text-primary"><span>Profit</span><span>{moneyFmt(p.price-p.cost,currency)}</span></p>{p.supplier&&<p className="text-muted-foreground">FH: {p.supplier}</p>}</div><div className="mt-auto flex justify-end gap-1 pt-5"><ActionButton title="Duplikat" onClick={()=>setEditor({kind:"product",item:{...p,id:""} as Product})}><Copy size={17}/></ActionButton><ActionButton title="Edit produk" onClick={()=>setEditor({kind:"product",item:p})}><SquarePen size={17}/></ActionButton><ActionButton title="Hapus produk" onClick={()=>setDeleteTarget({kind:"product",id:p.id,label:p.name})}><Trash2 size={17}/></ActionButton></div></div>)}</div>}</div>}
          {view==="logout"&&<LogoutView orders={data.orders} sellerWa={settings.seller_wa} now={now} browserAlerts={browserAlerts} enableBrowserAlerts={enableBrowserAlerts} openEditor={o=>setEditor({kind:"order",item:o})} openSettings={()=>navigate("settings")} markLogout={async(o,completed)=>{await mutate("PATCH",{kind:"logout",id:o.id,completed},completed?"Logout ditandai selesai":"Tanda logout dibatalkan");}}/>}
          {!["dashboard","orders","products","logout"].includes(view)&&<ExtraView view={view} data={data} currency={currency} mutate={mutate} openEditor={setEditor} openDelete={setDeleteTarget} openReceipt={setReceipt} copy={copy} trackingLink={trackingLink}/>}
        </>}
      </main>
    </SidebarInset>
    <Dialog open={!!editor} onOpenChange={open=>!open&&setEditor(null)}><DialogContent className="glass max-h-[90vh] overflow-y-auto rounded-[26px] border-border bg-card p-5 sm:max-w-2xl sm:p-7"><DialogHeader><DialogTitle className="serif text-2xl">{editor?.kind==="order"?(editor.item?"Edit order":"New little order"):editor?.kind==="product"?(editor.item?.id?"Edit produk":"Tambah produk"):editor?.kind==="supplier"?(editor.item?"Edit supplier":"Tambah supplier"):editor?.kind==="expense"?(editor.item?"Edit pengeluaran":"Catat pengeluaran"):"Catatan buyer"}</DialogTitle><DialogDescription>Perubahan tersimpan di ruang kerjamu.</DialogDescription></DialogHeader>{editor?.kind==="order"&&<OrderForm key={(editor.item?.id||"new-order")} initial={editor.item as Order|undefined} products={data.products} suppliers={data.suppliers} settings={data.settings} onSubmit={saveEditor} pending={busy}/>} {editor?.kind==="product"&&<ProductForm key={(editor.item?.id||"new-product")} initial={editor.item as Product|undefined} onSubmit={async v=>{if(editor.item&&!editor.item.id){await mutate("POST",{...v,kind:"product"},"Produk diduplikasi");return;}await saveEditor(v);}} pending={busy}/>} {editor&&["supplier","expense","buyer_note"].includes(editor.kind)&&<SimpleForm key={editor.item?.id||editor.kind} kind={editor.kind} item={editor.item} onSubmit={saveEditor} pending={busy}/>}</DialogContent></Dialog>
    <Dialog open={!!receipt} onOpenChange={open=>!open&&setReceipt(null)}><DialogContent className="glass max-h-[90vh] overflow-y-auto rounded-[26px] bg-card p-5 sm:max-w-lg"><DialogHeader><DialogTitle className="serif text-2xl">Nota {receipt&&invoice(receipt.invoice_seq)}</DialogTitle><DialogDescription>Salin atau cetak nota untuk buyer.</DialogDescription></DialogHeader>{receipt&&<ReceiptView order={receipt} settings={settings} copy={copy} trackingLink={trackingLink}/>}</DialogContent></Dialog>
    <Dialog open={pasteOpen} onOpenChange={setPasteOpen}><DialogContent className="glass rounded-[24px] bg-card sm:max-w-lg"><DialogHeader><DialogTitle className="serif text-2xl">Tempel daftar produk</DialogTitle><DialogDescription>Satu produk per baris: Aplikasi | Tipe | Durasi | Modal | Harga jual | Supplier. Maksimal 50 baris.</DialogDescription></DialogHeader><textarea className="min-h-44 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder="Canva | Private | 1 Bulan | 8000 | 15000 | FH Rara"/><Button disabled={busy||!pasteText.trim()} onClick={()=>void pasteProducts()} className="rounded-xl">Impor produk</Button></DialogContent></Dialog>
    <AlertDialog open={!!deleteTarget} onOpenChange={open=>!open&&setDeleteTarget(null)}><AlertDialogContent className="glass rounded-[24px] bg-card"><AlertDialogHeader><AlertDialogTitle>Hapus {deleteTarget?.label}?</AlertDialogTitle><AlertDialogDescription>Data ini akan dihapus dari ruang kerja. Order yang sudah dibuat tetap menyimpan nama produk meski produknya dihapus.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>deleteTarget&&void mutate("DELETE",{kind:deleteTarget.kind,id:deleteTarget.id},"Data dihapus")}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Toaster position="bottom-right" richColors/>
  </SidebarProvider>;
}
function ActionButton({title,onClick,children}:{title:string;onClick:()=>void;children:ReactNode}) {return <Button variant="ghost" size="icon" title={title} aria-label={title} onClick={onClick} className="rounded-lg text-muted-foreground hover:text-primary">{children}</Button>;}
function EmptyState({icon,text,action}:{icon:ReactNode;text:string;action?:ReactNode}) {return <div className={card+" flex min-h-56 flex-col items-center justify-center text-center"}><div className="mb-3 text-primary/60">{icon}</div><p className="max-w-md text-muted-foreground">{text}</p>{action&&<div className="mt-5">{action}</div>}</div>;}
