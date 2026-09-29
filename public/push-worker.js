self.addEventListener("push",event=>{
  let message={};
  try {message=event.data?.json()||{};} catch {message={};}
  event.waitUntil(self.registration.showNotification(
    typeof message.title==="string"?message.title:"Pengingat Miuu Store",
    {
      body:typeof message.body==="string"?message.body:"Buka Miuu Store untuk melihat pengingat logout.",
      icon:"/favicon.svg",
      badge:"/favicon.svg",
      tag:typeof message.tag==="string"?message.tag:"miuu-rental",
      data:{url:"/"},
    },
  ));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing)return existing.focus();
    return self.clients.openWindow("/");
  })());
});