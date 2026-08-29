import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-3 whitespace-nowrap font-bold tracking-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary !text-white shadow-md hover:bg-primary-hover hover:shadow-lg active:scale-[0.98]',
        secondary:
          'bg-white text-text border-2 border-border shadow-sm hover:bg-background-alt hover:border-primary/30 active:scale-[0.98]',
        outline:
          'border-2 border-primary !text-primary bg-white/90 backdrop-blur-sm hover:bg-primary hover:!text-white active:scale-[0.98] shadow-sm',
        ghost:
          'text-text hover:bg-background-alt active:scale-[0.98]',
        link:
          'text-primary underline underline-offset-4 hover:text-primary-hover p-0 h-auto font-medium',
        danger:
          'bg-error !text-white shadow-md hover:bg-red-700 hover:shadow-lg active:scale-[0.98]',
      },
      size: {
        default: 'h-12 px-8 py-3 text-[15px] rounded-full',
        sm: 'h-10 px-6 py-2.5 text-sm rounded-full',
        lg: 'h-16 px-16 py-4 text-[16px] rounded-full',
        xl: 'h-16 px-20 py-5 text-lg rounded-full',
        icon: 'h-12 w-12 rounded-full',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, isLoading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Učitavanje...</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
