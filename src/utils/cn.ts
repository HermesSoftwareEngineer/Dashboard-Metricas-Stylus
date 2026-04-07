import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/** Format number as Brazilian currency */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

/** Format number with locale thousand separators */
export function formatNumber(value: number): string {
    return new Intl.NumberFormat('pt-BR').format(value)
}

/** Get current Brazilian date string */
export function getFormattedDate(): string {
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date())
}
