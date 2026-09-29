import type {Config} from "@netlify/functions";
import webpush from "web-push";

export const config: Config = {schedule:"* * * * *"};

type Order = {id:string;owner_id:string;invoice_seq:number;rental_end_at:string;status:string};
type Device = {id:string;owner_id:string;endpoint:string;p256dh:string;auth:string};
type Delivery = {order_id:string;subscription_id:string;phase:"soon"|"expired";rental_end_at:string};

async function supabase<T>(path:string,method="GET",body?:unknown,prefer?:string):Promise<T> {
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!base||!key)throw new Error("Supabase URL/secret key belum disiapkan untuk pengingat.");
  const response=await fetch(`${base}/rest/v1/${path}`,{
    method,
    headers:{apikey:key,
      ...(body!==undefined?{"Content-Type":"application/json"}:{}),
      ...(prefer?{Prefer:prefer}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
    cache:"no-store",
  });
  if(!response.ok)throw new Error(`Supabase ${method} gagal (${response.status}): ${await response.text()}`);
  if(response.status===204)return null as T;
  const text=await response.text();
  return (text?JSON.parse(text):null) as T;
}

const deliveryKey=(entry:Delivery)=>
  `${entry.order_id}|${entry.subscription_id}|${entry.phase}|${new Date(entry.rental_end_at).getTime()}`;

export default async function sendRentalReminders() {
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  if(!publicKey||!privateKey)throw new Error("Kunci VAPID untuk pengingat belum disiapkan.");
  webpush.setVapidDetails("https://miuu-store.netlify.app",publicKey,privateKey);

  const now=Date.now();
  const filters=new URLSearchParams({
    select:"id,owner_id,invoice_seq,rental_end_at,status",
    logged_out_at:"is.null",status:"neq.Dibatalkan",
    order:"rental_end_at.asc",limit:"200",
  });
  filters.append("rental_end_at",`gte.${new Date(now-30*86400000).toISOString()}`);
  filters.append("rental_end_at",`lte.${new Date(now+3*86400000).toISOString()}`);
  const orders=await supabase<Order[]>(`orders?${filters}`);
  if(!orders.length)return;

  const ownerIds=[...new Set(orders.map(order=>order.owner_id))];
  const orderIds=orders.map(order=>order.id);
  const deviceQuery=new URLSearchParams({
    select:"id,owner_id,endpoint,p256dh,auth",
    owner_id:`in.(${ownerIds.join(",")})`,limit:"500",
  });
  const devices=await supabase<Device[]>(`push_subscriptions?${deviceQuery}`);
  if(!devices.length)return;

  const logQuery=new URLSearchParams({
    select:"order_id,subscription_id,phase,rental_end_at",
    order_id:`in.(${orderIds.join(",")})`,limit:"5000",
  });
  const delivered=await supabase<Delivery[]>(`push_delivery_log?${logQuery}`);
  const sent=new Set(delivered.map(deliveryKey));
  const jobs:{order:Order;device:Device;phase:"soon"|"expired"}[]=[];
  for(const order of orders){
    const end=new Date(order.rental_end_at).getTime();
    if(!Number.isFinite(end))continue;
    const phase=end<=now?"expired":"soon";
    for(const device of devices){
      if(device.owner_id!==order.owner_id)continue;
      if(!sent.has(deliveryKey({order_id:order.id,subscription_id:device.id,phase,rental_end_at:order.rental_end_at})))
        jobs.push({order,device,phase});
    }
  }

  // Satu eksekusi Netlify dibatasi 30 detik. Sisa pekerjaan dicoba pada menit berikutnya.
  const pending=jobs.slice(0,60);
  await Promise.all(Array.from({length:Math.min(6,pending.length)},async()=>{
    while(pending.length){
      const job=pending.shift();
      if(!job)break;
      const {order,device,phase}=job;
      const payload=JSON.stringify({
        title:phase==="expired"?"Waktunya cek logout":"Masa sewa segera habis",
        body:phase==="expired"
          ? `INV-${String(order.invoice_seq).padStart(5,"0")} perlu dicek. Buka Miuu Store untuk melihat detail.`
          : `INV-${String(order.invoice_seq).padStart(5,"0")} akan habis dalam 3 hari. Buka Miuu Store untuk melihat detail.`,
        tag:`miuu-${order.id}-${phase}-${new Date(order.rental_end_at).getTime()}`,
      });
      try {
        await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},payload,{TTL:86400});
        await supabase("push_delivery_log?on_conflict=order_id,subscription_id,phase,rental_end_at","POST",{
          order_id:order.id,subscription_id:device.id,phase,rental_end_at:order.rental_end_at,
        },"resolution=ignore-duplicates,return=minimal");
      } catch(error) {
        const status=(error as {statusCode?:number}).statusCode;
        if(status===404||status===410){
          const query=new URLSearchParams({id:`eq.${device.id}`});
          try {await supabase(`push_subscriptions?${query}`,"DELETE");}
          catch(cleanupError){console.error("Gagal menghapus perangkat lama:",cleanupError);}
        } else console.error("Pengingat belum terkirim:",error);
      }
    }
  }));
  console.log(`Pengingat: ${Math.min(jobs.length,60)} dicoba, ${Math.max(0,jobs.length-60)} menunggu.`);
}