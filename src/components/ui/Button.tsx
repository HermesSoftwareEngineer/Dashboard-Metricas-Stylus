import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode
    variant?: ButtonVariant
    size?: ButtonSize
    loading?: boolean
    icon?: ReactNode
    iconPosition?: 'left' | 'right'
    fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: [
        'bg-brand-red text-white',
        'hover:bg-brand-red-light active:bg-brand-red-dark',
        'shadow-sm hover:shadow-md',
    ].join(' '),
    secondary: [
        'bg-brand-orange text-white',
        'hover:bg-brand-orange-light active:bg-brand-orange-dark',
        'shadow-sm hover:shadow-md',
    ].join(' '),
    ghost: [
        'bg-transparent text-[var(--color-text-primary)]',
        'hover:bg-[var(--color-surface-muted)]',
    ].join(' '),
    danger: [
        'bg-brand-red/10 text-brand-red border border-brand-red/30',
        'hover:bg-brand-red hover:text-white',
    ].join(' '),
    outline: [
        'bg-transparent border border-[var(--color-surface-border)] text-[var(--color-text-primary)]',
        'hover:border-brand-red hover:text-brand-red',
    ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-sm)]',
    md: 'h-10 px-4 text-sm gap-2 rounded-[var(--radius-md)]',
    lg: 'h-12 px-6 text-base gap-2.5 rounded-[var(--radius-md)]',
}

export function Button({
    children,
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    disabled,
    ...props
}: ButtonProps) {
    const isDisabled = disabled || loading

    return (
        <button
            className={cn(
                'inline-flex items-center justify-center font-sans font-medium',
                'transition-all duration-[var(--transition-fast)]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
                sizeClasses[size],
                variantClasses[variant],
                fullWidth && 'w-full',
                className
            )}
            disabled={isDisabled}
            {...props}
        >
            {loading ? (
                <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
                iconPosition === 'left' && icon
            )}
            {children}
            {!loading && iconPosition === 'right' && icon}
        </button>
    )
}
