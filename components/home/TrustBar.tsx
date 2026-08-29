import { CheckCircle, Truck, RefreshCw, Award } from 'lucide-react';

interface TrustItem {
  icon: React.ReactNode;
  text: string;
}

interface TrustBarProps {
  items?: TrustItem[];
}

const defaultItems: TrustItem[] = [
  {
    icon: <Award className="w-5 h-5 text-primary" />,
    text: 'Garantovan kvalitet',
  },
  {
    icon: <Truck className="w-5 h-5 text-primary" />,
    text: 'Brza dostava',
  },
  {
    icon: <RefreshCw className="w-5 h-5 text-primary" />,
    text: '30 dana za zamenu',
  },
];

export function TrustBar({ items = defaultItems }: TrustBarProps) {
  return (
    <section className="bg-background-alt border-y border-border">
      <div className="container-wide py-4 lg:py-5">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 lg:gap-12">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 text-sm lg:text-base text-text"
            >
              <span className="flex-shrink-0">
                {item.icon}
              </span>
              <span className="font-medium whitespace-nowrap">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TrustBar;
