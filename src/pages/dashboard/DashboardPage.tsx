import { useDashboard } from '@/hooks/useDashboard'
import { Card } from '@/components/ui/Card'
import { Grid } from '@/components/ui/Layout'
import { Typography } from '@/components/ui/Typography'
import { KPICardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/States'
import { Badge } from '@/components/ui/Badge'
import { getFormattedDate } from '@/utils/cn'
import type { KPICard as KPICardType } from '@/types/dashboard.types'

const categoryColors: Record<KPICardType['category'], { badge: Parameters<typeof Badge>[0]['variant']; accent: string }> = {
    trello: { badge: 'info', accent: 'bg-blue-500/10 text-blue-500' },
    imoview: { badge: 'success', accent: 'bg-brand-green-muted text-brand-green' },
    spreadsheet: { badge: 'warning', accent: 'bg-brand-orange-muted text-brand-orange-dark' },
    general: { badge: 'neutral', accent: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]' },
}

const categoryLabels: Record<KPICardType['category'], string> = {
    trello: 'Trello',
    imoview: 'Imoview',
    spreadsheet: 'Planilhas',
    general: 'Geral',
}

function KPICardItem({ card }: { card: KPICardType }) {
    const cat = categoryColors[card.category]
    return (
        <Card className="flex flex-col gap-3 group cursor-default" variant="default">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <Typography variant="label" color="muted">{card.title}</Typography>
                <Badge variant={cat.badge} size="sm">{categoryLabels[card.category]}</Badge>
            </div>

            {/* Value – placeholder */}
            <div className="flex items-baseline gap-1">
                {card.unit && (
                    <Typography variant="caption" color="muted" className="text-[10px]">
                        {card.unit}
                    </Typography>
                )}
                <Typography
                    variant="h2"
                    color="primary"
                    className="text-[2rem] font-black leading-none tabular-nums"
                >
                    —
                </Typography>
            </div>

            {/* Change indicator placeholder */}
            <div className="flex items-center gap-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${cat.accent}`}>
                    Aguardando dados
                </span>
            </div>
        </Card>
    )
}

export function DashboardPage() {
    const { data, loading, error, refetch } = useDashboard()

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <Typography variant="h2" color="primary">
                        Painel de Métricas
                    </Typography>
                    <Typography variant="caption" color="muted" className="mt-1 capitalize text-xs">
                        {getFormattedDate()}
                    </Typography>
                </div>

                <Badge variant="neutral" dot>
                    {loading ? 'Carregando…' : error ? 'Erro' : 'Pronto para dados'}
                </Badge>
            </div>

            {/* Error state */}
            {error && !loading && (
                <Card variant="bordered">
                    <EmptyState
                        icon="⚠️"
                        title="Erro ao carregar dashboard"
                        description={error}
                        action={{ label: 'Tentar novamente', onClick: refetch }}
                    />
                </Card>
            )}

            {/* Sections */}
            {!error && (
                <>
                    {loading ? (
                        // Loading skeletons
                        <div className="space-y-8">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="space-y-3">
                                    <div className="h-4 w-48 bg-[var(--color-surface-muted)] rounded animate-pulse" />
                                    <Grid cols={3} gap="md">
                                        {[1, 2, 3].map(j => <KPICardSkeleton key={j} />)}
                                    </Grid>
                                </div>
                            ))}
                        </div>
                    ) : data ? (
                        // Real sections
                        <div className="space-y-8">
                            {data.sections.map(section => (
                                <section key={section.id} aria-labelledby={`section-${section.id}`}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <Typography
                                            variant="h4"
                                            color="primary"
                                            id={`section-${section.id}`}
                                        >
                                            {section.title}
                                        </Typography>
                                        <div className="flex-1 h-px bg-[var(--color-surface-border)]" />
                                        <Typography variant="caption" color="muted">
                                            {section.cards.length} indicadores
                                        </Typography>
                                    </div>

                                    <Grid cols={3} gap="md">
                                        {section.cards.map(card => (
                                            <KPICardItem key={card.id} card={card} />
                                        ))}
                                    </Grid>
                                </section>
                            ))}

                            {/* Future widgets area */}
                            <section aria-label="Área de gráficos">
                                <div className="flex items-center gap-3 mb-4">
                                    <Typography variant="h4" color="primary">
                                        Visualizações
                                    </Typography>
                                    <div className="flex-1 h-px bg-[var(--color-surface-border)]" />
                                </div>
                                <Card variant="bordered" padding="lg">
                                    <EmptyState
                                        icon="📈"
                                        title="Gráficos em breve"
                                        description="Esta área será preenchida com gráficos e visualizações após a integração com as APIs."
                                    />
                                </Card>
                            </section>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    )
}
