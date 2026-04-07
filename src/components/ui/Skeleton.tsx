import { cn } from '@/utils/cn'

interface SkeletonProps {
    className?: string
    variant?: 'text' | 'rect' | 'circle'
    width?: string
    height?: string
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
    return (
        <div
            style={{ width, height }}
            className={cn(
                'animate-pulse bg-[var(--color-surface-muted)]',
                variant === 'circle' && 'rounded-full',
                variant === 'text' && 'rounded-[var(--radius-sm)] h-4',
                variant === 'rect' && 'rounded-[var(--radius-md)]',
                className
            )}
        />
    )
}

/** Pre-built KPI card skeleton */
export function KPICardSkeleton() {
    return (
        <div className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton variant="circle" className="size-8" />
            </div>
            <Skeleton className="h-8 w-24 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-3 w-20" />
        </div>
    )
}
