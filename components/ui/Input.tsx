import { forwardRef, type InputHTMLAttributes, useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      helperText,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const generatedId = useId();
    const inputId = id || (typeof props.name === 'string' ? props.name : generatedId);
    const descriptionId = `${inputId}-description`;
    const describedBy = [
      ariaDescribedBy,
      error || helperText ? descriptionId : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium mb-2 transition-colors',
              error ? 'text-error' : isFocused ? 'text-primary' : 'text-text-muted'
            )}
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={describedBy}
          className={cn(
            'flex h-12 w-full rounded-md border bg-background px-4 py-3 text-base font-body',
            'transition-all duration-200',
            'placeholder:text-text-light',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-error focus:border-error focus:ring-error/20'
              : 'border-border focus:border-primary focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background-alt',
            className
          )}
          ref={ref}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        {(error || helperText) && (
          <p
            id={descriptionId}
            className={cn(
              'mt-1.5 text-sm',
              error ? 'text-error' : 'text-text-muted'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
