import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() { return [{source: "/admin.html", destination: "/admin/dashboard?tab=loyalty", permanent: false}]; },
  async headers(){return [{source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"X-Frame-Options",value:"SAMEORIGIN"},{key:"Referrer-Policy",value:"no-referrer"}]}];},
};

export default nextConfig;
