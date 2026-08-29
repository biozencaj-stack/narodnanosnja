import type { Metadata } from 'next';
import { JobForm } from '@/components/job/JobForm';
import { getStoreIdentity } from '@/lib/config/store-settings';

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreIdentity();
  return {
    title: 'Postani deo tima',
    description: `Pridruži se ${name} timu - karijera i zapošljavanje.`,
  };
}

export default function KarijeraPage() {
  return <JobForm />;
}
