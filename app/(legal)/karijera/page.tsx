import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JobForm } from '@/components/job/JobForm';
import { storeCapabilities } from '@/lib/config/capabilities';
import { getStoreIdentity } from '@/lib/config/store-settings';

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreIdentity();
  return {
    title: 'Postani deo tima',
    description: `Pridruži se ${name} timu - karijera i zapošljavanje.`,
  };
}

/**
 * Podnožje je vezu ka ovoj stranici već krilo kad je `careers` ugašen, ali sama
 * stranica nije imala nikakvu proveru — bila je dostupna direktnom adresom i
 * ušla bi u mapu sajta. Skrivena veza nije ovlašćenje; ista provera stoji i na
 * `/prodajna-mesta` i na `/placanje-karticama`.
 */
export default function KarijeraPage() {
  if (!storeCapabilities.careers) notFound();
  return <JobForm />;
}
