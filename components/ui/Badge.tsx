import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white',
        secondary: 'bg-background-alt text-text border border-border',
        success: 'bg-success-light text-success',
        warning: 'bg-warning-light text-warning',
        error: 'bg-error-light text-error',
        sale: 'bg-black text-white font-bold',
        discount1: 'bg-red-500 text-white font-bold', // Akcijski popust
        discount2: 'bg-red-800 text-white font-bold', // Sezonsko sniženje
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
