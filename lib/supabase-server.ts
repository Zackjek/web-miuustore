// Akses Supabase REST dengan token seller: seluruh query tetap melewati RLS.
function config() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error("Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return {url,key};
}
export async function verifiedOwner(request:Request) {
  const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!token)return null;
  const {url,key}=config();
  const response=await fetch(url+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+token},cache:"no-store"});
  if(!response.ok)return null;
  const user=await response.json() as {id?:string};
  return user.id?{id:user.id,token}:null;
}
export async function rest<T>(path:string,token:string|null=null,method="GET",body?:unknown,prefer?:string):Promise<T> {
  const {url,key}=config();
  const response=await fetch(url+"/rest/v1/"+path,{
    method,headers:{apikey:key,...(token?{Authorization:"Bearer "+token}:{}),...(body!==undefined?{"Content-Type":"application/json"}:{}),...(prefer?{Prefer:prefer}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:"no-store",
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>({message:""})) as {message?:string;error?:string};
    throw new Error(detail.message||detail.error||"Database tidak dapat diakses.");
  }
  if(response.status===204)return null as T;
  const raw=await response.text();
  return (raw?JSON.parse(raw):null) as T;
}
export const filter=(values:Record<string,string>)=>"?"+new URLSearchParams(values).toString();
export const str=(value:unknown,max=300)=>String(value??"").trim().slice(0,max);
export const money=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>=0?Math.min(Math.round(n),1000000000000):0;};
export const positive=(value:unknown,fallback=1)=>{const n=Number(value);return Number.isFinite(n)&&n>=1?Math.min(Math.round(n),100000):fallback;};
export const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export const date=(value:unknown)=>{const d=str(value,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(new Date(d+"T00:00:00Z").getTime())?d:today();};
export const optionalDate=(value:unknown)=>{const d=str(value,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:"";};
export const timestamp=(value:unknown)=>{if(!value)return null;const d=new Date(String(value));return Number.isNaN(d.getTime())?null:d.toISOString();};
export const statuses=["Baru","Diproses","Menunggu","Selesai","Dibatalkan"];
export const status=(value:unknown)=>statuses.includes(str(value,30))?str(value,30):"Diproses";
export const bad=(message:string)=>Response.json({error:message},{status:400});
export const unauthorized=()=>Response.json({error:"Sesi login habis. Masuk kembali."},{status:401});
export function failed(error:unknown){console.error("Ruang Order database:",error);return Response.json({error:error instanceof Error?error.message:"Data gagal diproses."},{status:500});}
