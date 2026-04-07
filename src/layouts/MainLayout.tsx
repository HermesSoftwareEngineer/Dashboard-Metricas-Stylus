import { type ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

interface MainLayoutProps {
    children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
    return (
        <div className="flex h-screen overflow-hidden bg-[var(--color-surface-bg)]">
            {/* Sidebar */}
            <Sidebar />

            {/* Main area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header />

                {/* Scrollable content */}
                <main
                    id="main-content"
                    className="flex-1 overflow-y-auto p-6"
                >
                    {children}
                </main>
            </div>
        </div>
    )
}
