import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Typography } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'

type FaseItem = {
  fase: string
  quantidade: number
  percentual: number
}

type MotivoItem = {
  motivo: string
  quantidade: number
  valor: number
}

type LocacaoMetricsResponse = {
  success: boolean
  periodo: {
    inicio: string
    fim: string
  }
  metrics: {
    novos_imoveis_captados: {
      id: string
      valor: number
    }
    taxa_churn_rescisao: {
      id: string
      volume: {
        rescindidos: number
        ativos: number
        taxa: number | null
        taxa_percentual: number | null
      }
      valor: {
        rescindidos: number
        ativos: number
        taxa: number | null
        taxa_percentual: number | null
      }
    }
    churn_por_motivo: {
      id: string
      categorias: MotivoItem[]
    }
    prazo_medio_permanencia_ltv: {
      id: string
      meses: number | null
    }
    taxa_cada_fase: {
      id: string
      total_atendimentos: number
      fases: FaseItem[]
    }
    tempo_medio_vacancia: {
      id: string
      dias: number | null
    }
  }
  warnings: string[]
}

type LocacaoMetric = {
  id: string
  metrica: string
  setor: string
  pagina: string
  fonte: string
  metodologia: string
}

const locacaoMetrics: LocacaoMetric[] = [
  {
    id: '1',
    metrica: 'Novos imoveis captados',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'Planilha de Imoveis',
    metodologia:
      'Considerar como novo imovel captado todo registro cuja coluna DataCadastro esteja dentro do periodo filtrado, ou seja, maior ou igual a data inicial e menor ou igual a data final do filtro, retornando a contagem total de imoveis cadastrados nesse intervalo.',
  },
  {
    id: '2',
    metrica: 'Taxa de Churn (Rescisao)',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'Planilha de Contratos',
    metodologia:
      'Calcular churn em volume e valor considerando, primeiro, como contratos ativos no periodo todos aqueles cujo intervalo entre DataInicio e DataRescisao (ou data atual, se nulo) tenha intersecao com o periodo filtrado (DataInicio <= DataFinalFiltro e DataRescisao nulo ou >= DataInicialFiltro), depois identificar contratos rescindidos com DataRescisao dentro do periodo filtrado, e por fim dividir a quantidade e o valor dos contratos rescindidos pela quantidade e valor dos contratos ativos no mesmo periodo.',
  },
  {
    id: '2.1',
    metrica: 'Churn por Motivo (Categorizacao)',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'Planilha de Contratos',
    metodologia:
      'Filtrar os contratos com status de rescindido cuja DataRescisao esteja dentro do periodo selecionado e agrupar os resultados pela coluna MotivoRescisao, calculando para cada categoria tanto a quantidade de contratos quanto a soma dos valores correspondentes.',
  },
  {
    id: '3',
    metrica: 'Prazo Medio de Permanencia (LTV - Lifetime Value)',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'Planilha de Contratos',
    metodologia:
      'Considerar apenas contratos com Situacao = "Rescindido", calcular individualmente o tempo de permanencia como a diferenca entre DataRescisao e DataInicio, converter esse tempo para meses (dias divididos por 30) e retornar a media desses valores, desconsiderando contratos que nao estejam com status de rescindido para evitar distorcoes.',
  },
  {
    id: '4',
    metrica: 'Taxa de cada fase',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'Planilha de Atendimentos',
    metodologia:
      'Considerar todos os atendimentos dentro do periodo filtrado, agrupar pela coluna Fase e calcular, para cada fase, a proporcao em relacao ao total de atendimentos, dividindo a quantidade de registros da fase pelo total geral e retornando o percentual de participacao de cada etapa no funil.',
  },
  {
    id: '6',
    metrica: 'Tempo Medio de Vacancia (Vago)',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'Planilha de Imoveis',
    metodologia:
      'Identificar imoveis que possuem dataVagoDesde, definir o inicio da vacancia por essa data e o fim como a data em que o imovel foi marcado como alugado (ultima mudanca de status) ou a data atual caso ainda esteja vago, calcular o tempo de vacancia como a diferenca entre essas datas e retornar a media desse tempo em dias.',
  },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function startOfMonthISO(): string {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return first.toISOString().slice(0, 10)
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-'
  return `${value.toFixed(2)}%`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}

function HorizontalBarChart({
  title,
  items,
  valueKey,
}: {
  title: string
  items: Array<{ label: string; value: number; subtitle?: string }>
  valueKey: 'percent' | 'number'
}) {
  const max = useMemo(() => {
    if (!items.length) return 1
    return Math.max(...items.map(item => item.value), 1)
  }, [items])

  return (
    <Card variant="bordered" className="space-y-3">
      <Typography variant="h4">{title}</Typography>

      {!items.length ? (
        <Typography variant="body" color="muted">Sem dados no periodo.</Typography>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const width = `${Math.max((item.value / max) * 100, 2)}%`
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Typography variant="caption" className="truncate max-w-[68%]">{item.label}</Typography>
                  <Typography variant="caption" color="secondary">
                    {valueKey === 'percent' ? `${item.value.toFixed(2)}%` : formatNumber(item.value)}
                  </Typography>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)] overflow-hidden">
                  <div className="h-full rounded-full bg-brand-red" style={{ width }} />
                </div>
                {item.subtitle && (
                  <Typography variant="caption" color="muted">{item.subtitle}</Typography>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function MetricCard({ item }: { item: LocacaoMetric }) {
  return (
    <Card variant="bordered" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Typography variant="h4">{item.metrica}</Typography>
        <span className="text-xs font-semibold px-2 py-1 rounded-[var(--radius-full)] bg-brand-red-muted text-brand-red">
          ID {item.id}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div>
          <Typography variant="caption" color="muted">Setor</Typography>
          <Typography variant="body">{item.setor}</Typography>
        </div>
        <div>
          <Typography variant="caption" color="muted">Pagina</Typography>
          <Typography variant="body">{item.pagina}</Typography>
        </div>
        <div>
          <Typography variant="caption" color="muted">Fonte</Typography>
          <Typography variant="body">{item.fonte}</Typography>
        </div>
        <div>
          <Typography variant="caption" color="muted">Status</Typography>
          <Typography variant="body">Definicao inicial concluida</Typography>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3">
        <Typography variant="label" color="muted">Metodologia</Typography>
        <Typography variant="body" className="mt-1">
          {item.metodologia}
        </Typography>
      </div>
    </Card>
  )
}

export function LocacaoPage() {
  const [startDate, setStartDate] = useState<string>(startOfMonthISO())
  const [endDate, setEndDate] = useState<string>(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LocacaoMetricsResponse | null>(null)

  const fetchMetrics = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      })

      const response = await fetch(`/api/locacao/metrics?${params.toString()}`)
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.detail ?? payload?.error ?? `Falha na consulta (${response.status})`)
      }

      setData(payload as LocacaoMetricsResponse)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao consultar metricas.')
    } finally {
      setLoading(false)
    }
  }

  const faseChartData = useMemo(() => {
    const fases = data?.metrics.taxa_cada_fase.fases ?? []
    return fases.map(item => ({
      label: item.fase,
      value: item.percentual,
      subtitle: `${item.quantidade} atendimentos`,
    }))
  }, [data])

  const motivoChartData = useMemo(() => {
    const motivos = data?.metrics.churn_por_motivo.categorias ?? []
    return motivos.map(item => ({
      label: item.motivo,
      value: item.quantidade,
      subtitle: formatCurrency(item.valor),
    }))
  }, [data])

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <Typography variant="h2">Setor de Locacao</Typography>
        <Typography variant="body" color="secondary" className="mt-1 max-w-4xl">
          Pagina base com as metricas iniciais de Locacao. Nesta etapa, o foco e estruturar
          escopo, fonte e metodologia de cada indicador.
        </Typography>
      </div>

      <Card variant="bordered" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Typography variant="h4">Filtro de periodo</Typography>
          {loading && <Typography variant="caption" color="muted">Calculando metricas...</Typography>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <Typography variant="caption" color="muted">Data inicial</Typography>
            <input
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
              className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-card)]"
            />
          </label>

          <label className="space-y-1">
            <Typography variant="caption" color="muted">Data final</Typography>
            <input
              type="date"
              value={endDate}
              onChange={event => setEndDate(event.target.value)}
              className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-card)]"
            />
          </label>

          <div className="flex items-end">
            <Button onClick={fetchMetrics} loading={loading} fullWidth>
              Calcular metricas
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-[var(--radius-md)] border border-brand-red/30 bg-brand-red/5 px-3 py-2">
            <Typography variant="caption" className="text-brand-red">{error}</Typography>
          </div>
        )}
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card>
              <Typography variant="caption" color="muted">ID 1 • Novos imoveis captados</Typography>
              <Typography variant="h2" className="mt-1">{formatNumber(data.metrics.novos_imoveis_captados.valor)}</Typography>
            </Card>

            <Card>
              <Typography variant="caption" color="muted">ID 2 • Churn (volume)</Typography>
              <Typography variant="h2" className="mt-1">{formatPercent(data.metrics.taxa_churn_rescisao.volume.taxa_percentual)}</Typography>
              <Typography variant="caption" color="secondary" className="mt-1 block">
                {data.metrics.taxa_churn_rescisao.volume.rescindidos} rescindidos / {data.metrics.taxa_churn_rescisao.volume.ativos} ativos
              </Typography>
            </Card>

            <Card>
              <Typography variant="caption" color="muted">ID 2 • Churn (valor)</Typography>
              <Typography variant="h2" className="mt-1">{formatPercent(data.metrics.taxa_churn_rescisao.valor.taxa_percentual)}</Typography>
              <Typography variant="caption" color="secondary" className="mt-1 block">
                {formatCurrency(data.metrics.taxa_churn_rescisao.valor.rescindidos)} / {formatCurrency(data.metrics.taxa_churn_rescisao.valor.ativos)}
              </Typography>
            </Card>

            <Card>
              <Typography variant="caption" color="muted">ID 3 • Prazo medio de permanencia</Typography>
              <Typography variant="h2" className="mt-1">{formatNumber(data.metrics.prazo_medio_permanencia_ltv.meses)}</Typography>
              <Typography variant="caption" color="secondary" className="mt-1 block">meses</Typography>
            </Card>

            <Card>
              <Typography variant="caption" color="muted">ID 4 • Total de atendimentos</Typography>
              <Typography variant="h2" className="mt-1">{formatNumber(data.metrics.taxa_cada_fase.total_atendimentos)}</Typography>
            </Card>

            <Card>
              <Typography variant="caption" color="muted">ID 6 • Tempo medio de vacancia</Typography>
              <Typography variant="h2" className="mt-1">{formatNumber(data.metrics.tempo_medio_vacancia.dias)}</Typography>
              <Typography variant="caption" color="secondary" className="mt-1 block">dias</Typography>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <HorizontalBarChart title="ID 4 • Taxa de cada fase" items={faseChartData} valueKey="percent" />
            <HorizontalBarChart title="ID 2.1 • Churn por motivo" items={motivoChartData} valueKey="number" />
          </div>

          {!!data.warnings.length && (
            <Card className="border border-brand-orange/25 bg-brand-orange-muted/40">
              <Typography variant="label" color="secondary">Avisos de dados</Typography>
              <div className="mt-2 space-y-1">
                {data.warnings.map(warning => (
                  <Typography key={warning} variant="caption" color="secondary" className="block">- {warning}</Typography>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="bg-brand-orange-muted/40 border border-brand-orange/20">
        <Typography variant="label" color="secondary">Escopo Inicial</Typography>
        <Typography variant="body" className="mt-1">
          Total de metricas mapeadas: {locacaoMetrics.length}
        </Typography>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {locacaoMetrics.map(metric => (
          <MetricCard key={metric.id} item={metric} />
        ))}
      </div>
    </div>
  )
}
