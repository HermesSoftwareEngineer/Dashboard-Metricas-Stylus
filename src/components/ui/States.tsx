import { Button } from './Button'

interface EmptyStateProps {
    title?: string
    description?: string
    icon?: string
    action?: {
        label: string
        onClick: () => void
    }
}

export function EmptyState({
    title = 'Nenhum dado encontrado',
    description = 'Aguardando integração com a fonte de dados.',
    icon = '📊',
    action,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-4">
            <div className="text-5xl select-none" aria-hidden="true">{icon}</div>
            <div className="space-y-1">
                <p className="font-display font-semibold text-base text-[var(--color-text-primary)]">
                    {title}
                </p>
                <p className="text-sm text-[var(--color-text-muted)] max-w-xs mx-auto">
                    {description}
                </p>
            </div>
            {action && (
                <Button variant="outline" size="sm" onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    )
}

interface ErrorStateProps {
    title?: string
    description?: string
    onRetry?: () => void
}

export function ErrorState({
    title = 'Erro ao carregar dados',
    description = 'Ocorreu um problema ao buscar as informações. Tente novamente.',
    onRetry,
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-4">
            <div
                className="size-14 rounded-full bg-brand-red-muted flex items-center justify-center text-2xl select-none"
                aria-hidden="true"
            >
                ⚠️
            </div>
            <div className="space-y-1">
                <p className="font-display font-semibold text-base text-[var(--color-text-primary)]">
                    {title}
                </p>
                <p className="text-sm text-[var(--color-text-muted)] max-w-xs mx-auto">
                    {description}
                </p>
            </div>
            {onRetry && (
                <Button variant="danger" size="sm" onClick={onRetry}>
                    Tentar novamente
                </Button>
            )}
        </div>
    )
}
