import { OkvirProdavnice } from "@/components/layout/OkvirProdavnice";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <OkvirProdavnice varijanta="pravno">{children}</OkvirProdavnice>;
}
