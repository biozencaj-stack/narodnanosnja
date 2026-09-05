import { OkvirProdavnice } from "@/components/layout/OkvirProdavnice";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <OkvirProdavnice varijanta="prodavnica">{children}</OkvirProdavnice>;
}
