import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode
    variant?: 'default' | 'bordered' | 'elevated'
    padding?: 'sm' | 'md' | 'lg'
}

const paddingMap = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
}

const variantMap = {
    default: 'bg-[var(--color-surface-card)] shadow-[var(--shadow-card)]',
    bordered: 'bg-[var(--color-surface-card)] border border-[var(--color-surface-border)]',
    elevated: 'bg-[var(--color-surface-card)] shadow-[var(--shadow-card-hover)]',
}

export function Card({
    children,
    className,
    variant = 'default',
    padding = 'md',
    ...props
}: CardProps) {
    return (
        <div
            className={cn(
                'rounded-[var(--radius-lg)] transition-shadow duration-[var(--transition-base)]',
                'hover:shadow-[var(--shadow-card-hover)]',
                variantMap[variant],
                paddingMap[padding],
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
}
