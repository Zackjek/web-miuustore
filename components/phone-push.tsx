"use client";

import {useEffect,useState} from "react";
import {Bell,Check} from "lucide-react";
import {Button} from "@/components/ui/button";
import {authFetch} from "@/lib/browser-auth";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function applicationKey(key: string) {
  const base64 = key.replace(/-/g,"+").replace(/_/g,"/");
  const decoded = atob(base64.padEnd(Math.ceil(base64.length/4)*4,"="));
  return Uint8Array.from(decoded,char=>char.charCodeAt(0));
}

async function save(subscription: PushSubscription) {
  const response = await authFetch("/api/push",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(subscription.toJSON()),
  });
  if(!response.ok){
    const body = await response.json().catch(()=>({})) as {error?:string};
    throw new Error(body.error||"Perangkat belum bisa didaftarkan.");
  }
}

export function PhonePush() {
  const [supported,setSupported] = useState(true);
  const [active,setActive] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  useEffect(()=>{
    if(!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)){
      setSupported(false);return;
    }
    let alive = true;
    void navigator.serviceWorker.register("/push-worker.js",{scope:"/"})
      .then(registration=>registration.pushManager.getSubscription())
      .then(async subscription=>{
        if(subscription){await save(subscription);if(alive)setActive(true);}
      })
      .catch(()=>{if(alive)setError("Belum bisa memeriksa notifikasi perangkat ini.");});
    return ()=>{alive=false;};
  },[]);

  async function enable() {
    if(!publicKey){setError("Kunci push belum diatur di Netlify.");return;}
    setBusy(true);setError("");
    try {
      const permission = await Notification.requestPermission();
      if(permission!=="granted")throw new Error("Izinkan notifikasi untuk Miuu Store di pengaturan HP.");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if(!subscription)subscription = await registration.pushManager.subscribe({
        userVisibleOnly:true,applicationServerKey:applicationKey(publicKey),
      });
      await save(subscription);
      setActive(true);
    } catch(e) {setError(e instanceof Error?e.message:"Notifikasi belum bisa diaktifkan.");}
    finally {setBusy(false);}
  }

  async function disable() {
    setBusy(true);setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if(subscription){
        const response = await authFetch("/api/push",{
          method:"DELETE",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({endpoint:subscription.endpoint}),
        });
        if(!response.ok)throw new Error("Perangkat belum bisa dinonaktifkan.");
        await subscription.unsubscribe();
      }
      setActive(false);
    } catch(e) {setError(e instanceof Error?e.message:"Gagal menonaktifkan notifikasi.");}
    finally {setBusy(false);}
  }

  return <div className="glass rounded-[22px] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="font-semibold">Notifikasi ke HP</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pengingat dikirim sekitar 3 hari sebelum masa sewa habis dan setelah waktunya logout, meski web sedang ditutup.
          Aktifkan dari HP yang ingin menerima notifikasi.
        </p>
      </div>
      {supported&&publicKey&&(active
        ? <Button variant="outline" disabled={busy} onClick={()=>void disable()} className="rounded-xl"><Check size={16}/> {busy?"Memproses...":"Aktif di perangkat ini · Matikan"}</Button>
        : <Button disabled={busy} onClick={()=>void enable()} className="rounded-xl"><Bell size={16}/> {busy?"Memproses...":"Aktifkan di HP ini"}</Button>)}
    </div>
    {!supported&&<p className="mt-3 text-sm text-amber-700">Browser ini belum mendukung push di tab biasa. Jika memakai iPhone, buka Miuu Store dari ikon di Layar Utama, lalu coba lagi.</p>}
    {!publicKey&&<p className="mt-3 text-sm text-amber-700">Notifikasi HP belum disiapkan di Netlify.</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <p className="mt-3 text-xs text-muted-foreground">Di iPhone: Safari → Bagikan → Tambah ke Layar Utama. Buka ikon Miuu Store, masuk, lalu aktifkan notifikasi. Pengaturan ini berlaku per perangkat.</p>
  </div>;
}