import {rest,failed} from "@/lib/supabase-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  const code=new URL(request.url).searchParams.get("code")?.trim().toUpperCase()??"";
  if(!/^RO-[0-9A-F]{20}$/.test(code))return Response.json({error:"Kode order tidak ditemukan."},{status:404});
  try {
    const result=await rest<unknown>("rpc/lookup_progress",null,"POST",{p_code:code});
    if(!result)return Response.json({error:"Kode order tidak ditemukan."},{status:404});
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch(error){return failed(error);}
}
