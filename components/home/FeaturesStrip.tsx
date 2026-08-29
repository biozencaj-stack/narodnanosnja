'use client';

import { Truck, ShieldCheck, RotateCcw, Headphones } from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const defaultFeatures: Feature[] = [
  {
    icon: <Truck className="w-6 h-6" />,
    title: 'Besplatna dostava',
    description: 'Za porudžbine iznad definisanog iznosa',
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: 'Sigurna kupovina',
    description: 'SSL zaštita i bezbedno plaćanje',
  },
  {
    icon: <RotateCcw className="w-6 h-6" />,
    title: 'Lako vraćanje',
    description: '30 dana za zamenu ili povraćaj',
  },
  {
    icon: <Headphones className="w-6 h-6" />,
    title: 'Podrška 24/7',
    description: 'Tu smo za sva vaša pitanja',
  },
];

interface FeaturesStripProps {
  features?: Feature[];
}

export function FeaturesStrip({ features = defaultFeatures }: FeaturesStripProps) {
  return (
    <section className="py-10 lg:py-14 bg-white border-y border-border">
      <div className="container-wide">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center mb-4 transition-colors duration-300">
                <div className="text-primary">{feature.icon}</div>
              </div>
              <h3 className="text-sm lg:text-base font-semibold text-text mb-1">
                {feature.title}
              </h3>
              <p className="text-xs lg:text-sm text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
