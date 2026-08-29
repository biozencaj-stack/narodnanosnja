import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-4">
        <h1 className="font-display text-6xl lg:text-8xl text-primary mb-4">
          404
        </h1>
        <h2 className="text-2xl lg:text-3xl font-medium text-text mb-4">
          Stranica nije pronađena
        </h2>
        <p className="text-text-muted max-w-md mx-auto mb-8">
          Žao nam je, stranica koju tražite ne postoji ili je premeštena.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/">
              Početna stranica
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/contact">
              Kontaktirajte nas
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
