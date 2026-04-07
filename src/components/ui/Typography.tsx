import { type ReactNode, type HTMLAttributes, type JSX } from 'react'
import { cn } from '@/utils/cn'

// ─── Typography variants ─────────────────────────────────────────────────────

type TypographyVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyLg' | 'caption' | 'label'
type TypographyColor = 'primary' | 'secondary' | 'muted' | 'brand' | 'inherit'

interface TypographyProps extends HTMLAttributes<HTMLElement> {
    children: ReactNode
    variant?: TypographyVariant
    color?: TypographyColor
    as?: keyof JSX.IntrinsicElements
}

const elementMap: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    body: 'p',
    bodyLg: 'p',
    caption: 'span',
    label: 'span',
}

const variantClasses: Record<TypographyVariant, string> = {
    h1: 'text-3xl font-bold font-display tracking-tight',
    h2: 'text-2xl font-bold font-display tracking-tight',
    h3: 'text-xl font-semibold font-display',
    h4: 'text-base font-semibold font-display',
    body: 'text-sm font-sans leading-relaxed',
    bodyLg: 'text-base font-sans leading-relaxed',
    caption: 'text-xs font-sans',
    label: 'text-xs font-sans font-semibold uppercase tracking-wider',
}

const colorClasses: Record<TypographyColor, string> = {
    primary: 'text-[var(--color-text-primary)]',
    secondary: 'text-[var(--color-text-secondary)]',
    muted: 'text-[var(--color-text-muted)]',
    brand: 'text-brand-red',
    inherit: 'text-inherit',
}

export function Typography({
    children,
    className,
    variant = 'body',
    color = 'primary',
    as,
    ...props
}: TypographyProps) {
    const Tag = (as ?? elementMap[variant]) as React.ElementType
    return (
        <Tag
            className={cn(variantClasses[variant], colorClasses[color], className)}
            {...props}
        >
            {children}
        </Tag>
    )
}
