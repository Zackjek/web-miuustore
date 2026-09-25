"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {Search,ArrowRight,LockKeyhole} from "lucide-react";
import Workspace from "@/components/workspace";
import {currentUser,signIn,signOut,signUp,type User} from "@/lib/browser-auth";

export default function Home(){
  const [user,setUser]=useState<User|null>(null),[checking,setChecking]=useState(true),[mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{void currentUser().then(setUser).catch(()=>{}).finally(()=>setChecking(false));},[]);
  async function submit(e:FormEvent){
    e.preventDefault();setMessage("");setBusy(true);
    try{
      if(mode==="login")setUser(await signIn(email,password));
      else{const signed=await signUp(email,password);if(signed)setUser(signed);else setMessage("Akun dibuat. Buka email untuk mengonfirmasi akun, lalu masuk.");}
    }catch(error){setMessage(error instanceof Error?error.message:"Tidak dapat masuk.");}
    finally{setBusy(false);}
  }
  if(checking)return <main className="soft-bg flex min-h-screen items-center justify-center">Memeriksa sesi...</main>;
  if(user)return <Workspace displayName={user.user_metadata?.full_name||user.email?.split("@")[0]||"Seller"} onSignOut={()=>{void signOut().finally(()=>setUser(null));}}/>;
  return <main className="soft-bg flex min-h-screen items-center justify-center px-4 py-10">
    <div className="glass w-full max-w-[430px] rounded-[30px] p-7 sm:p-9">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><LockKeyhole size={24}/></div>
      <h1 className="serif mt-5 text-center text-4xl tracking-tight">ruang order <span className="text-primary">✿</span></h1>
      <p className="mt-1 text-center text-sm tracking-[.17em] text-muted-foreground">RESELLER WORKSPACE</p>
      <Link href="/cek" className="mt-8 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"><Search size={17}/> Cek progres pesanan</Link>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/><span>UNTUK PENGELOLA</span><span className="h-px flex-1 bg-border"/></div>
      <form onSubmit={e=>void submit(e)} className="space-y-3">
        <label className="block text-sm font-semibold" htmlFor="auth-email">Email</label><input id="auth-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3"/>
        <label className="block text-sm font-semibold" htmlFor="auth-password">Password</label><input id="auth-password" type="password" required minLength={6} autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3"/>
        {message&&<p role="alert" className="rounded-xl bg-secondary p-3 text-sm">{message}</p>}
        <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold shadow-sm hover:bg-accent disabled:opacity-60">{busy?"Memproses...":mode==="login"?"Masuk":"Buat akun"}<ArrowRight size={17}/></button>
      </form>
      <button className="mt-5 w-full text-center text-sm text-primary hover:underline" onClick={()=>{setMode(mode==="login"?"signup":"login");setMessage("");}}>{mode==="login"?"Belum punya akun? Daftar":"Sudah punya akun? Masuk"}</button>
      <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">Catat order, hitung keuntungan, dan pantau masa sewa dari satu tempat.</p>
    </div>
  </main>;
}
