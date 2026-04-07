import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'

interface NavItem {
    to: string
    label: string
    icon: string
}

const navItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/locacao', label: 'Locacao', icon: '🏢' },
    { to: '/import', label: 'Importacao', icon: '📥' },
    // Future items:
    // { to: '/trello',       label: 'Tarefas',   icon: '📋' },
    // { to: '/imoview',     label: 'Imóveis',   icon: '🏠' },
    // { to: '/financeiro',  label: 'Financeiro',icon: '💰' },
    // { to: '/relatorios',  label: 'Relatórios',icon: '📈' },
]

export function Sidebar() {
    const { pathname } = useLocation()

    return (
        <aside
            className={cn(
                'flex flex-col h-full w-64 flex-shrink-0',
                'bg-brand-dark shadow-[var(--shadow-sidebar)]',
                'transition-all duration-[var(--transition-base)]'
            )}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
                <div className="flex items-center justify-center size-9 rounded-[var(--radius-md)] bg-brand-red shadow-md flex-shrink-0">
                    <span className="text-white font-display font-black text-lg leading-none">S</span>
                </div>
                <div>
                    <p className="font-display font-bold text-base text-white leading-tight">Stylus</p>
                    <p className="text-[10px] text-white/40 font-sans uppercase tracking-widest leading-tight">
                        Dashboard
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <p className="text-[10px] font-sans font-semibold uppercase tracking-widest text-white/30 px-3 mb-3">
                    Menu
                </p>
                {navItems.map(item => {
                    const isActive = pathname === item.to
                    return (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)]',
                                'font-sans text-sm font-medium',
                                'transition-all duration-[var(--transition-fast)]',
                                'group relative',
                                isActive
                                    ? 'bg-brand-red text-white shadow-md'
                                    : 'text-white/60 hover:text-white hover:bg-white/8'
                            )}
                        >
                            {/* Active indicator bar */}
                            {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                            )}
                            <span className="text-base flex-shrink-0" aria-hidden="true">
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10">
                <p className="text-[10px] text-white/25 font-sans text-center">
                    © {new Date().getFullYear()} Stylus
                </p>
            </div>
        </aside>
    )
}
