import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/utils/cn'

export function Header() {
    const { isDark, toggleTheme } = useTheme()

    return (
        <header
            className={cn(
                'h-16 flex items-center justify-between px-6',
                'bg-[var(--color-surface-card)] border-b border-[var(--color-surface-border)]',
                'transition-colors duration-[var(--transition-base)]',
                'z-10 flex-shrink-0'
            )}
        >
            {/* Left – future breadcrumb / filters */}
            <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                    {/* Placeholder – search / filter will go here */}
                    <div
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm',
                            'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
                            'w-52 cursor-text'
                        )}
                    >
                        <span aria-hidden="true">🔍</span>
                        <span className="text-xs">Pesquisar...</span>
                    </div>
                </div>
            </div>

            {/* Right – actions */}
            <div className="flex items-center gap-2 ml-auto">
                {/* Theme toggle */}
                <button
                    id="theme-toggle"
                    onClick={toggleTheme}
                    aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
                    title={isDark ? 'Modo claro' : 'Modo escuro'}
                    className={cn(
                        'size-9 rounded-[var(--radius-md)]',
                        'flex items-center justify-center text-base',
                        'bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-border)]',
                        'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                        'transition-all duration-[var(--transition-fast)]',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red'
                    )}
                >
                    <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-[var(--color-surface-border)] mx-1" />

                {/* Avatar placeholder */}
                <div
                    className={cn(
                        'size-9 rounded-full flex items-center justify-center text-sm font-semibold',
                        'bg-brand-red text-white cursor-pointer',
                        'hover:bg-brand-red-light transition-colors duration-[var(--transition-fast)]'
                    )}
                    title="Perfil"
                >
                    S
                </div>
            </div>
        </header>
    )
}
