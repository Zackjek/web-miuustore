import {bad,failed,rest,unauthorized,verifiedOwner} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: {p256dh?: unknown;auth?: unknown};
};

function validEndpoint(value: unknown): value is string {
  if(typeof value !== "string" || value.length > 2048)return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password &&
      (!url.port || url.port === "443") &&
      (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
        host.endsWith(".push.apple.com"));
  } catch {return false;}
}

function validKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const owner = await verifiedOwner(request);
    if(!owner)return unauthorized();
    const raw = await request.text();
    if(raw.length > 4096)return bad("Data perangkat terlalu panjang.");
    let body: SubscriptionBody;
    try {body = JSON.parse(raw) as SubscriptionBody;}
    catch {return bad("Data perangkat tidak valid.");}
    if(!validEndpoint(body.endpoint) || !validKey(body.keys?.p256dh) || !validKey(body.keys?.auth))
      return bad("Langganan notifikasi tidak valid.");
    await rest("push_subscriptions?on_conflict=endpoint",owner.token,"POST",{
      owner_id:owner.id,endpoint:body.endpoint,p256dh:body.keys.p256dh,auth:body.keys.auth,
    },"resolution=merge-duplicates,return=minimal");
    return new Response(null,{status:204});
  } catch(error) {return failed(error);}
}

export async function DELETE(request: Request) {
  try {
    const owner = await verifiedOwner(request);
    if(!owner)return unauthorized();
    let body: {endpoint?: unknown};
    try {body = await request.json() as {endpoint?: unknown};}
    catch {return bad("Data perangkat tidak valid.");}
    if(!validEndpoint(body.endpoint))return bad("Perangkat tidak valid.");
    const query = new URLSearchParams({endpoint:`eq.${body.endpoint}`,owner_id:`eq.${owner.id}`});
    await rest(`push_subscriptions?${query}`,owner.token,"DELETE",undefined,"return=minimal");
    return new Response(null,{status:204});
  } catch(error) {return failed(error);}
}