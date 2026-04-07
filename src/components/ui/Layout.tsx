import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

// ─── Container ───────────────────────────────────────────────────────────────

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

const maxWidthMap = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-[90rem]',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
}

export function Container({ children, className, maxWidth = 'xl', ...props }: ContainerProps) {
    return (
        <div className={cn('w-full mx-auto px-4 sm:px-6', maxWidthMap[maxWidth], className)} {...props}>
            {children}
        </div>
    )
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

interface GridProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode
    cols?: 1 | 2 | 3 | 4 | 6
    gap?: 'sm' | 'md' | 'lg'
    responsive?: boolean
}

const colsMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
}

const gapMap = { sm: 'gap-3', md: 'gap-4', lg: 'gap-6' }

export function Grid({ children, className, cols = 3, gap = 'md', ...props }: GridProps) {
    return (
        <div className={cn('grid', colsMap[cols], gapMap[gap], className)} {...props}>
            {children}
        </div>
    )
}
