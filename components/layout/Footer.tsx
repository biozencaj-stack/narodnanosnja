import Link from 'next/link';
import { Mail, Phone, MapPin, Clock, Facebook, Instagram, ArrowUpRight } from 'lucide-react';
import { Logo } from './Logo';
import { Traka } from '@/components/ukras';
import { complaintFormUrl, storeCapabilities } from '@/lib/config/capabilities';
import { getStoreSettings } from '@/lib/config/store-settings';

const mapsEmbedUrl = process.env.NEXT_PUBLIC_MAPS_EMBED_URL || '';

const footerLinks = {
  shop: {
    title: 'Prodavnica',
    links: [
      { label: 'Svi proizvodi', href: '/catalog' },
      { label: 'Novi proizvodi', href: '/catalog?novo=true' },
      { label: 'Akcije i sniženja', href: '/catalog?sale=true' },
      ...(storeCapabilities.storeLocations ? [{ label: 'Prodajna mesta', href: '/prodajna-mesta' }] : []),
    ],
  },
  kupovina: {
    title: 'Kupovina',
    links: [
      { label: 'Kako kupiti', href: '/uputstvo' },
      { label: 'Način plaćanja', href: '/nacin-placanja' },
      ...(storeCapabilities.cardPayments ? [{ label: 'Plaćanje karticama', href: '/placanje-karticama' }] : []),
      { label: 'Uslovi isporuke', href: '/uslovi-isporuke' },
      { label: 'Zamena proizvoda', href: '/zamena-proizvoda' },
      { label: 'Reklamacije', href: '/reklamacije' },
    ],
  },
  kompanija: {
    title: 'Kompanija',
    links: [
      { label: 'O nama', href: '/o-nama' },
      { label: 'Kontakt', href: '/contact' },
      { label: 'Blog', href: '/blog' },
      ...(storeCapabilities.careers ? [{ label: 'Karijera', href: '/karijera' }] : []),
    ],
  },
  pravno: {
    title: 'Pravne informacije',
    links: [
      { label: 'Uslovi korišćenja', href: '/uslovi-koriscenja' },
      { label: 'Politika privatnosti', href: '/politika-privatnosti' },
      { label: 'Pravo na odustajanje', href: '/pravo-na-odustanak' },
      { label: 'Povraćaj sredstava', href: '/povracaj-sredstava' },
      ...(complaintFormUrl ? [{ label: 'Obrazac za reklamaciju', href: complaintFormUrl, external: true }] : []),
    ],
  },
};

const paymentLogos = [
  { name: 'Visa', src: '/images/payment-logos/visa-logo.png' },
  { name: 'Mastercard', src: '/images/payment-logos/mastercard-logo.png' },
  { name: 'Maestro', src: '/images/payment-logos/maestro-logo.png' },
  { name: 'DinaCard', src: '/images/payment-logos/dinacard.png' },
  { name: 'American Express', src: '/images/payment-logos/american-express.png' },
];

const securityBadges = [
  {
    name: 'Mastercard Secure',
    src: '/images/payment-logos/mastercard-secure.png',
    link: 'https://www.mastercard.com/rs/consumer/credit-cards.html',
  },
  {
    name: 'Visa Secure',
    src: '/images/payment-logos/visa-secure.png',
    link: 'https://rs.visa.com/pay-with-visa/security-and-assistance/protected-everywhere.html',
  },
  {
    name: 'Banca Intesa',
    src: '/images/payment-logos/banca-intesa.png',
    link: 'https://www.bancaintesa.rs',
  },
];

export async function Footer() {
  const settings = await getStoreSettings();
  const storeName = settings['store.name'];
  const storeTagline = settings['store.tagline'];
  const storePhone = settings['contact.phone'];
  const storeEmail = settings['contact.email'];
  const storeAddress = settings['contact.address'];
  const storeCity = settings['contact.city'];
  const storeDescription = settings['store.description'];
  const instagramUrl = settings['social.instagram'];
  const facebookUrl = settings['social.facebook'];
  const businessHours = settings['business.hours'];

  return (
    <footer className="bg-text text-white">
      {/* Tkana traka razdvaja podnožje od sadržaja iznad */}
      <Traka boja="var(--color-zlatna)" bojaDruga="var(--color-primary)" visina={20} />

      {/* Top section: Brand + Contact + Map */}
      <div className="container-wide pt-14 pb-10 lg:pt-16 lg:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12">
          {/* Brand & Contact info */}
          <div className={mapsEmbedUrl ? "lg:col-span-2" : "lg:col-span-5"}>
            <Logo varijanta="tamna" className="mb-5" ime={storeName} slogan={storeTagline} />
            <p className="text-sm text-white/60 mb-8 leading-relaxed max-w-sm">
              {storeDescription}
            </p>

            <div className="space-y-4 mb-8">
              {storeAddress && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-primary-light mt-0.5 shrink-0" />
                  <span className="text-white/70">{storeAddress}{storeCity ? `, ${storeCity}` : ''}</span>
                </div>
              )}
              {storePhone && (
                <a
                  href={`tel:${storePhone.replace(/\s/g, '')}`}
                  className="flex items-center gap-3 text-sm text-white/70 hover:text-white transition-colors"
                >
                  <Phone className="h-4 w-4 text-primary-light shrink-0" />
                  {storePhone}
                </a>
              )}
              <a
                href={`mailto:${storeEmail}`}
                className="flex items-center gap-3 text-sm text-white/70 hover:text-white transition-colors"
              >
                <Mail className="h-4 w-4 text-primary-light shrink-0" />
                {storeEmail}
              </a>
              {businessHours && (
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <Clock className="h-4 w-4 text-primary-light shrink-0" />
                  {businessHours}
                </div>
              )}
            </div>

            {/* Social */}
            <div className="flex items-center gap-3">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/70
                             hover:bg-primary hover:text-white transition-all"
                  aria-label="Instagram"
                >
                  <Instagram className="h-[18px] w-[18px]" />
                </a>
              )}
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/70
                             hover:bg-primary hover:text-white transition-all"
                  aria-label="Facebook"
                >
                  <Facebook className="h-[18px] w-[18px]" />
                </a>
              )}
            </div>
          </div>

          {/* Google Maps embed */}
          {mapsEmbedUrl && <div className="lg:col-span-3">
            <div className="rounded-2xl overflow-hidden h-[280px] lg:h-full lg:min-h-[300px] bg-white/5 border border-white/10">
              {mapsEmbedUrl ? (
                <iframe
                  src={mapsEmbedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0, minHeight: '280px' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Lokacija prodavnice"
                />
              ) : null}
            </div>
          </div>}
        </div>
      </div>

      {/* Divider */}
      <div className="container-wide">
        <div className="h-px bg-white/10" />
      </div>

      {/* Link columns */}
      <div className="container-wide py-10 lg:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors"
                      >
                        {link.label}
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-white/60 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="container-wide">
        <div className="h-px bg-white/10" />
      </div>

      {/* Payment & Security section */}
      {storeCapabilities.cardPayments && <div className="container-wide py-10 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Security info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">Sigurno plaćanje</h3>
            </div>
            <p className="text-xs text-white/50 leading-relaxed mb-5">
              Prilikom unošenja podataka o platnoj kartici, poverljive informacije se prenose putem javne mreže u
              zaštićenoj (kriptovanoj) formi upotrebom SSL protokola i PKI sistema.
              Sigurnost podataka prilikom kupovine garantuje procesor platnih kartica.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {securityBadges.map((badge) => (
                <a
                  key={badge.name}
                  href={badge.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity bg-white rounded-lg px-3 py-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badge.src}
                    alt={badge.name}
                    className="h-7 w-auto object-contain"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Payment methods */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-4">
              Prihvatamo
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {paymentLogos.map((logo) => (
                <div
                  key={logo.name}
                  className="flex items-center justify-center px-3 py-2 bg-white rounded-lg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className="h-5 w-auto object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-white/50 mb-4">
              Visa, MasterCard, Maestro, Dina i American Express
            </p>
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-white/40 leading-relaxed">
                <span className="font-medium text-white/60">Izjava o konverziji:</span> Sva plaćanja biće izvršena u lokalnoj valuti Republike Srbije – dinar (RSD).
                Iznos za koji će biti zadužena vaša platna kartica biće izražen u vašoj lokalnoj valuti kroz konverziju u istu,
                po kursu koji koriste kartičarske organizacije.
              </p>
            </div>
          </div>
        </div>
      </div>}

      {/* Bottom bar */}
      <div className="border-t border-white/10 bg-black/20">
        <div className="container-wide py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
            <p>&copy; {new Date().getFullYear()} {storeName}. Sva prava zadržana.</p>
            <div className="flex items-center gap-4">
              <Link href="/uslovi-koriscenja" className="hover:text-white/70 transition-colors">
                Uslovi
              </Link>
              <Link href="/politika-privatnosti" className="hover:text-white/70 transition-colors">
                Privatnost
              </Link>
              <Link href="/contact" className="hover:text-white/70 transition-colors">
                Kontakt
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
