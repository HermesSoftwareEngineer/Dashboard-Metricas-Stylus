import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    children: ReactNode
    variant?: BadgeVariant
    size?: BadgeSize
    dot?: boolean
}

const variantMap: Record<BadgeVariant, string> = {
    default: 'bg-brand-red-muted text-brand-red',
    success: 'bg-brand-green-muted text-brand-green',
    warning: 'bg-brand-orange-muted text-brand-orange-dark',
    error: 'bg-brand-red-muted text-brand-red',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]',
}

const dotMap: Record<BadgeVariant, string> = {
    default: 'bg-brand-red',
    success: 'bg-brand-green',
    warning: 'bg-brand-orange',
    error: 'bg-brand-red',
    info: 'bg-blue-500',
    neutral: 'bg-[var(--color-text-muted)]',
}

const sizeMap: Record<BadgeSize, string> = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
}

export function Badge({
    children,
    className,
    variant = 'default',
    size = 'md',
    dot = false,
    ...props
}: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center font-sans font-semibold rounded-[var(--radius-full)]',
                sizeMap[size],
                variantMap[variant],
                className
            )}
            {...props}
        >
            {dot && (
                <span className={cn('size-1.5 rounded-full flex-shrink-0', dotMap[variant])} />
            )}
            {children}
        </span>
    )
}
