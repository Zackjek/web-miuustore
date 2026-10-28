export type PriceVariant = { label: string; price: number };
export type Category = { id: string; name: string; sort_order: number };
export type CatalogFields = {
  reference_url?: string;
  description?: string;
  image_url?: string;
  category_id?: string | null;
  available?: boolean;
  is_published?: boolean;
  variants?: PriceVariant[];
  package_notes?: Record<string, string>;
  terms?: string;
};
export type PublicProduct = CatalogFields & {
  id: string;
  name: string;
  price: number;
  variant: string;
  duration: string;
  sort_order: number;
};
export type StorefrontSettings = {
  slug: string;
  shop_name: string;
  tagline: string;
  header_text: string;
  footer_text: string;
  logo_url: string;
  is_public: boolean;
  voucher_valid_days: number;
  canva_invite_url: string;
  loyalty_program: "miuu8" | "classic10";
  discount_label: string;
  free_app_label: string;
};
export const storefrontDefaults: StorefrontSettings = {
  slug: "miuu",
  shop_name: "Miuu Store",
  tagline: "a little happiness, in every order ♡",
  header_text: "Temukan aplikasi favorit dan paket yang pas untukmu.",
  footer_text: "Terima kasih sudah mendukung toko kecil kami. ♡",
  logo_url: "",
  is_public: true,
  voucher_valid_days: 30,
  canva_invite_url: "",
  loyalty_program: "miuu8",
  discount_label: "Voucher diskon 10% (maks. Rp15.000)",
  free_app_label: "Gratis 1 aplikasi",
};
export type LoyaltyMember = {
  id: string;
  member_id: string;
  name: string;
  phone: string;
  program: "miuu8" | "classic10";
  total_stamps: number;
  stamps: number;
  joined_at: string;
};
export type Voucher = {
  id: string;
  member_id: string;
  code: string;
  discount_pct: number;
  max_amount: number;
  expires_at: string | null;
  used_at: string | null;
  status: "available" | "used" | "expired" | "revoked";
  label: string;
  reward_type: "discount" | "free_app";
  cycle?: number;
};
export type StampLog = {
  id: string;
  member_id: string;
  order_id: string | null;
  delta: number;
  reason: string;
  created_at: string;
};
export type WarrantyClaim = {
  id: string;
  member_id: string;
  order_id: string;
  message: string;
  status: string;
  created_at: string;
};
export type CanvaTeam = { id: string; name: string; invite_url: string };
export type CanvaSubscription = {
  id: string;
  order_id: string;
  team_id: string | null;
  email: string;
  months: number;
  renewal_index: number;
};
export type RenewalLog = {
  id: string;
  subscription_id: string;
  renewal_index: number;
  created_at: string;
};
export type MemberOrder = {
  id: string;
  invoice_seq: number;
  product_name: string;
  variant: string;
  duration: string;
  price: number;
  quantity: number;
  refund_amount: number;
  order_date: string;
  due_date: string;
  warranty_days: number;
  rental_end_at: string | null;
  status: string;
  public_note: string;
};
export type MemberProfile = {
  customer: LoyaltyMember;
  orders: MemberOrder[];
  vouchers: Voucher[];
  claims: WarrantyClaim[];
  logs: StampLog[];
};
