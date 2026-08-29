'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { validateEmailAddress } from '@/lib/utils/validation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Mail, Sparkles, Gift, Bell } from 'lucide-react';

const perks = [
  { icon: Gift, text: 'Ekskluzivni popusti' },
  { icon: Sparkles, text: 'Nove kolekcije prve' },
  { icon: Bell, text: 'Obaveštenja o akcijama' },
];

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);

  const [formStartTime, setFormStartTime] = useState<number | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);

  const handleInteraction = () => {
    if (!userInteracted) setUserInteracted(true);
    if (!formStartTime) setFormStartTime(Date.now());
  };

  const openModal = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setStatus('error');
      setMessage('Unesite email adresu');
      return;
    }

    if (!validateEmailAddress(email)) {
      setStatus('error');
      setMessage('Email adresa nije validna!');
      return;
    }

    setConfirmationModalOpen(true);
  };

  const handleSubmit = async () => {
    setConfirmationModalOpen(false);

    const timeTaken = formStartTime ? Date.now() - formStartTime : 0;
    if (timeTaken < 3000) {
      setStatus('error');
      setMessage('Molimo sačekajte pre slanja.');
      return;
    }

    if (!userInteracted) {
      setStatus('error');
      setMessage('Došlo je do greške. Pokušajte ponovo.');
      return;
    }

    if (honeypot) {
      setStatus('success');
      setMessage('Uspešno ste se pretplatili!');
      setEmail('');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Uspešno ste se pretplatili!');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Došlo je do greške');
      }
    } catch {
      setStatus('error');
      setMessage('Došlo je do greške. Pokušajte ponovo.');
    }
  };

  return (
    <section
      className="relative bg-text overflow-hidden"
      onMouseMove={handleInteraction}
      onClick={handleInteraction}
    >
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary-dark/15 rounded-full blur-3xl" />

      <div className="container-wide relative z-10 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Content */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Mail className="h-4 w-4 text-primary-light" />
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Newsletter</span>
            </div>

            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-white leading-tight mb-5">
              Budite u toku sa{' '}
              <span className="text-primary-light">najnovijim</span>{' '}
              ponudama
            </h2>

            <p className="text-base text-white/60 leading-relaxed mb-8 max-w-lg">
              Prijavite se i prvi saznajte o novim kolekcijama, ekskluzivnim popustima
              i specijalnim akcijama rezervisanim samo za pretplatnike.
            </p>

            {/* Perks */}
            <div className="flex flex-wrap gap-4">
              {perks.map((perk) => (
                <div key={perk.text} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <perk.icon className="h-4 w-4 text-primary-light" />
                  </div>
                  <span className="text-sm text-white/70">{perk.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form card */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 lg:p-10">
            {status === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg className="w-8 h-8 text-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Hvala vam!</h3>
                <p className="text-white/60 text-sm">
                  Uspešno ste se prijavili na naš newsletter. Očekujte uskoro prvi email.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white mb-2">Prijavite se besplatno</h3>
                <p className="text-sm text-white/50 mb-6">Bez spama. Odjava u bilo kom trenutku.</p>

                <form onSubmit={openModal} className="space-y-4">
                  <input
                    type="text"
                    name="honeypot"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    style={{ display: 'none' }}
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  <div>
                    <label htmlFor="newsletter-email" className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                      Email adresa
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                      <input
                        id="newsletter-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (status !== 'idle') setStatus('idle');
                        }}
                        placeholder="vas@email.com"
                        className={cn(
                          'w-full h-13 pl-12 pr-5 bg-white/5 border border-white/10 rounded-xl',
                          'text-white placeholder:text-white/30',
                          'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40',
                          'transition-all'
                        )}
                        disabled={status === 'loading'}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className={cn(
                      'w-full h-13 bg-primary text-white rounded-xl font-semibold text-sm',
                      'hover:bg-primary-hover transition-all duration-200',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center justify-center gap-2',
                      'shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30'
                    )}
                  >
                    {status === 'loading' ? (
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Prijavite se
                      </>
                    )}
                  </button>

                  {/* Error message */}
                  {status === 'error' && (
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-error/10 text-error border border-error/20">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {message}
                    </div>
                  )}
                </form>

                <p className="mt-5 text-xs text-white/30 text-center">
                  Prijavom prihvatate našu{' '}
                  <a href="/politika-privatnosti" className="text-white/50 hover:text-white/70 underline transition-colors">
                    politiku privatnosti
                  </a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmationModalOpen} onOpenChange={setConfirmationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potvrda pretplate</DialogTitle>
            <DialogDescription>
              Prihvatanjem, bićete obaveštavani o novostima vezano za naš
              webshop. Da li želite da nastavite?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button onClick={handleSubmit}>
              Da, prihvatam
            </Button>
            <Button variant="outline" onClick={() => setConfirmationModalOpen(false)}>
              Ne, otkaži
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
