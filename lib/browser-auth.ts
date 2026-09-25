export type User={id:string;email:string;user_metadata?:{full_name?:string}};
type Session={access_token:string;refresh_token:string;expires_at:number;user?:User};
const storageKey="ruang-order-supabase-session";
let refreshPromise:Promise<Session|null>|null=null;
const config=()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error("Koneksi Supabase belum diatur. Isi .env.local terlebih dahulu.");
  return {url,key};
};
function saved():Session|null{
  try{const x=JSON.parse(localStorage.getItem(storageKey)||"null") as Session;return x?.refresh_token?x:null;}catch{return null;}
}
function store(x:Session|null){if(x)localStorage.setItem(storageKey,JSON.stringify(x));else localStorage.removeItem(storageKey);}
async function auth(path:string,method:string,body?:unknown,token?:string){
  const {url,key}=config();
  const response=await fetch(url+"/auth/v1/"+path,{method,headers:{apikey:key,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(result.msg||result.error_description||result.error||"Login gagal."));
  return result;
}
function setFromAuth(result:Record<string,unknown>):Session|null{
  if(!result.access_token||!result.refresh_token)return null;
  const session:Session={access_token:String(result.access_token),refresh_token:String(result.refresh_token),expires_at:Date.now()+Number(result.expires_in||3600)*1000,user:result.user as User|undefined};
  store(session);return session;
}
export async function signIn(email:string,password:string){
  const result=await auth("token?grant_type=password","POST",{email,password});
  const session=setFromAuth(result);if(!session)throw new Error("Login belum berhasil.");
  return session.user||await currentUser();
}
export async function signUp(email:string,password:string){
  const result=await auth("signup","POST",{email,password});
  const session=setFromAuth(result);return session?.user||null;
}
async function refresh(){
  const current=saved();if(!current)return null;
  try{const result=await auth("token?grant_type=refresh_token","POST",{refresh_token:current.refresh_token});return setFromAuth(result);}catch{store(null);return null;}
}
export async function accessToken(force=false){
  const session=saved();if(!session)return null;
  if(!force&&session.expires_at>Date.now()+60_000)return session.access_token;
  if(!refreshPromise)refreshPromise=refresh().finally(()=>{refreshPromise=null;});
  return (await refreshPromise)?.access_token||null;
}
export async function currentUser():Promise<User|null>{
  let token=await accessToken();if(!token)return null;
  try{
    const result=await auth("user","GET",undefined,token);
    if(result.id)return result as User;
  }catch{
    token=await accessToken(true);
    if(token){try{const result=await auth("user","GET",undefined,token);if(result.id)return result as User;}catch{}}
  }
  store(null);return null;
}
export async function signOut(){const token=await accessToken();store(null);if(token)try{await auth("logout","POST",{},token);}catch{}}
export async function authFetch(path:string,init:RequestInit={}){
  const token=await accessToken();
  if(!token)return new Response(JSON.stringify({error:"Sesi habis. Silakan muat ulang dan masuk kembali."}),{status:401});
  return fetch(path,{...init,headers:{...(init.headers||{}),Authorization:"Bearer "+token}});
}
