'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface BannerCard {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  link: string;
  imagePosition: string;
}

const bannerCards: BannerCard[] = [
  {
    id: 'nova-kolekcija',
    title: 'Nova Kolekcija',
    subtitle: 'Otkrijte najnovije modele',
    badge: 'PREMIJERA',
    image: '/images/banners/torbe-banner.jpg',
    link: '/catalog?novo=true',
    imagePosition: 'center 70%',
  },
  {
    id: 'katalog',
    title: 'Svi proizvodi',
    subtitle: 'Kompletna ponuda na jednom mestu',
    badge: 'KOLEKCIJA',
    image: '/images/banners/catalog-banner.jpg',
    link: '/catalog',
    imagePosition: 'center 30%',
  },
  {
    id: 'akcija',
    title: 'Akcija',
    subtitle: 'Najbolje cene za vas',
    badge: 'UŠTEDITE DO 50%',
    image: '/images/banners/akcija-banner.jpg',
    link: '/catalog?sale=true',
    imagePosition: 'center 70%',
  },
];

export function CategoryBanners() {
  return (
    <section className="w-full min-h-[400px] md:min-h-[450px] lg:min-h-[500px] xl:min-h-[550px] 2xl:min-h-[600px]">
      <div className="grid grid-cols-1 md:grid-cols-3">
        {bannerCards.map((card) => (
          <Link
            key={card.id}
            href={card.link}
            className="group relative h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] 2xl:h-[600px] overflow-hidden w-full"
          >
            <Image
              src={card.image}
              alt={card.title}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              style={{ objectPosition: card.imagePosition }}
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 33vw, 600px"
              quality={70}
              loading="lazy"
            />

            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/25 to-black/10 group-hover:from-black/70 transition-colors duration-300" />

            <div className="absolute inset-0 flex flex-col items-center justify-end text-white p-8 pb-12">
              <span className="text-[10px] tracking-[0.25em] font-semibold mb-3 opacity-80 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full">
                {card.badge}
              </span>

              <h3 className="font-display text-2xl md:text-3xl lg:text-4xl text-center mb-2 tracking-wide">
                {card.title}
              </h3>

              <p className="text-sm text-white/70 mb-5 tracking-wide">
                {card.subtitle}
              </p>

              <span className="inline-flex items-center gap-2 text-xs tracking-[0.15em] font-semibold uppercase
                             bg-white/15 backdrop-blur-sm px-5 py-2.5 rounded-full
                             group-hover:bg-white group-hover:text-text transition-all duration-300">
                Pogledaj
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
