import { useEffect, useMemo, useRef, useState } from 'react'
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

type TrelloCategoriaItem = {
  categoria: string
  quantidade: number
  media_horas: number
  media_dias: number
}

type CanceladosFilterMode = 'exclude' | 'include' | 'only'

type LocacaoMetricsResponse = {
  success: boolean
  periodo: {
    inicio: string
    fim: string
  }
  integrations?: {
    imoview?: {
      authenticated?: boolean | null
      codigoacesso_disponivel?: boolean | null
      codigousuario?: number | null
      nomeusuario?: string | null
      deferred?: boolean
    }
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
    tempo_medio_resposta_quarta_interacao_imoview: {
      id: string
      atendimentos_analisados: number
      atendimentos_com_4_interacoes: number
      tempo_medio_dias: number | null
      tempo_medio_horas: number | null
      tempo_medio_minutos: number | null
    }
    tempo_medio_vacancia: {
      id: string
      dias: number | null
    }
    tempo_medio_processo_trello: {
      id: string
      cards_total: number
      processos_concluidos: number
      processos_no_periodo: number
      media_geral_horas: number | null
      media_geral_dias: number | null
      tags_filtradas: string[]
      cancelados_filter: CanceladosFilterMode
      available_tags: string[]
      categorias: TrelloCategoriaItem[]
    }
    tempo_medio_intervalo_interacoes_imoview: {
      id: string
      atendimentos_analisados: number
      atendimentos_com_2_interacoes: number
      intervalos_consolidados: number
      tempo_medio_dias: number | null
      tempo_medio_horas: number | null
      tempo_medio_minutos: number | null
    }
  }
  warnings: string[]
}

type ImoviewMetricsEndpointResponse = {
  success: boolean
  periodo: {
    inicio: string
    fim: string
  }
  integrations: {
    imoview: {
      authenticated: boolean
      codigoacesso_disponivel: boolean
      codigousuario: number | null
      nomeusuario: string | null
    }
  }
  metrics: {
    tempo_medio_resposta_quarta_interacao_imoview: LocacaoMetricsResponse['metrics']['tempo_medio_resposta_quarta_interacao_imoview']
    tempo_medio_intervalo_interacoes_imoview: LocacaoMetricsResponse['metrics']['tempo_medio_intervalo_interacoes_imoview']
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
    id: '5',
    metrica: 'Tempo medio de resposta (1a ate 4a interacao)',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'API do Imoview',
    metodologia:
      'Obter os atendimentos no Imoview, ordenar as interacoes de cada atendimento por data, considerar apenas os atendimentos com pelo menos quatro interacoes, calcular o tempo como diferenca entre a primeira e a quarta interacao e retornar a media desse intervalo.',
  },
  {
    id: '6',
    metrica: 'Tempo Medio de Vacancia (Vago)',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'Planilha de Imoveis',
    metodologia:
      'Identificar imoveis que possuem dataVagoDesde, definir o fim da vacancia como a data em que o imovel foi marcado como alugado (ultima mudanca de status) ou a data atual caso ainda esteja vago, aplicar o filtro de periodo sobre essa data de fim e calcular a media da diferenca em dias entre fim e inicio da vacancia.',
  },
  {
    id: '7',
    metrica: 'Tempo Medio de Processo (Trello)',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'API do Trello',
    metodologia:
      'Buscar os cards do Trello considerando cada card como um processo, filtrar apenas os que possuem dateCreated e dateCompleted validos, calcular o tempo de cada processo como a diferenca entre conclusao e criacao e retornar a media geral e a media agrupada por categorias de labels.',
  },
  {
    id: '8',
    metrica: 'Tempo medio entre interacoes por atendimento',
    setor: 'Locacao',
    pagina: 'Setor de Locacao',
    fonte: 'API do Imoview',
    metodologia:
      'Para cada atendimento com pelo menos quatro interacoes, ordenar cronologicamente as interacoes, desconsiderar os dois primeiros intervalos automaticos do sistema e calcular os intervalos consecutivos a partir da terceira interacao, consolidando todos os intervalos gerados e retornando a media geral desses tempos como indicador de frequencia de contato.',
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

type CompactKpi = {
  id: string
  label: string
  value: string
  supporting?: string
}

function CompactKpiCard({ item }: { item: CompactKpi }) {
  return (
    <Card
      variant="bordered"
      padding="sm"
      className="relative overflow-hidden border-[var(--color-surface-border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(245,245,248,0.88))] dark:bg-[linear-gradient(145deg,rgba(39,40,50,0.96),rgba(28,29,36,0.9))]"
    >
      <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-brand-red/10 dark:bg-brand-red/20" />
      <Typography variant="caption" color="muted" className="block truncate">
        {item.id} • {item.label}
      </Typography>
      <Typography variant="h3" className="mt-1 leading-none">
        {item.value}
      </Typography>
      {item.supporting && (
        <Typography variant="caption" color="secondary" className="mt-1 block truncate">
          {item.supporting}
        </Typography>
      )}
    </Card>
  )
}

function DonutBreakdownChart({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: Array<{ label: string; value: number; auxiliary?: string }>
}) {
  const chartItems = items.filter(item => item.value > 0)
  const total = chartItems.reduce((sum, item) => sum + item.value, 0)
  const radius = 66
  const circumference = 2 * Math.PI * radius
  const colors = ['#C61A26', '#FF9F1C', '#4F734A', '#3B82F6', '#8B5CF6', '#0F766E']
  let accumulated = 0

  return (
    <Card variant="bordered" className="space-y-4">
      <div>
        <Typography variant="h4">{title}</Typography>
        <Typography variant="caption" color="secondary" className="mt-1 block">
          {subtitle}
        </Typography>
      </div>

      {!chartItems.length ? (
        <Typography variant="body" color="muted">
          Sem dados no periodo.
        </Typography>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr] sm:items-center">
          <div className="relative mx-auto h-[180px] w-[180px]">
            <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
              <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--color-surface-border)" strokeWidth="18" />
              {chartItems.map((item, index) => {
                const segment = total > 0 ? (item.value / total) * circumference : 0
                const dashArray = `${segment} ${Math.max(circumference - segment, 0)}`
                const dashOffset = -accumulated
                accumulated += segment

                return (
                  <circle
                    key={`${item.label}-${index}`}
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke={colors[index % colors.length]}
                    strokeWidth="18"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                  />
                )
              })}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Typography variant="caption" color="muted">
                Total
              </Typography>
              <Typography variant="h2" className="leading-none">
                {formatNumber(total)}
              </Typography>
            </div>
          </div>

          <div className="space-y-2">
            {chartItems.map((item, index) => {
              const percent = total > 0 ? (item.value / total) * 100 : 0
              return (
                <div key={`${item.label}-${index}`} className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-card)]/70 p-2.5 dark:bg-[var(--color-surface-muted)]/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <Typography variant="caption" className="truncate max-w-[180px]">
                        {item.label}
                      </Typography>
                    </div>
                    <Typography variant="caption" color="secondary">
                      {percent.toFixed(1)}%
                    </Typography>
                  </div>
                  <Typography variant="caption" color="secondary" className="mt-1 block">
                    {formatNumber(item.value)} {item.auxiliary ? `• ${item.auxiliary}` : ''}
                  </Typography>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

function SweepGauge({
  value,
  title,
  display,
  detail,
  colors,
  size = 140,
}: {
  value: number
  title: string
  display: string
  detail?: string
  colors: [string, string]
  size?: number
}) {
  const safeValue = Math.min(Math.max(value, 0), 100)
  const ringStyle = {
    background: `conic-gradient(${colors[0]} 0%, ${colors[1]} ${safeValue}%, rgba(128, 128, 128, 0.2) ${safeValue}% 100%)`,
  }

  return (
    <div className="space-y-2 text-center">
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <div className="h-full w-full rounded-full" style={ringStyle} />
        <div className="absolute inset-[16%] flex flex-col items-center justify-center rounded-full bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-card)]">
          <Typography variant="caption" color="muted">{title}</Typography>
          <Typography variant="h3" className="leading-none">{display}</Typography>
        </div>
      </div>
      {detail && (
        <Typography variant="caption" color="secondary" className="block">
          {detail}
        </Typography>
      )}
    </div>
  )
}

function SweepListChart({
  title,
  subtitle,
  items,
  mode,
  formatValue,
}: {
  title: string
  subtitle?: string
  items: Array<{ label: string; value: number; subtitle?: string }>
  mode: 'share' | 'relative'
  formatValue: (value: number) => string
}) {
  const normalizedItems = items.filter(item => item.value > 0)
  const max = normalizedItems.length ? Math.max(...normalizedItems.map(item => item.value), 1) : 1
  const total = normalizedItems.reduce((sum, item) => sum + item.value, 0)
  const colors: Array<[string, string]> = [
    ['#C61A26', '#E8323F'],
    ['#FF9F1C', '#FFC66B'],
    ['#4F734A', '#6A9B63'],
    ['#2563EB', '#60A5FA'],
    ['#7C3AED', '#A78BFA'],
    ['#0F766E', '#2DD4BF'],
  ]

  return (
    <Card variant="bordered" className="space-y-4">
      <div>
        <Typography variant="h4">{title}</Typography>
        {subtitle && (
          <Typography variant="caption" color="secondary" className="mt-1 block">
            {subtitle}
          </Typography>
        )}
      </div>

      {!normalizedItems.length ? (
        <Typography variant="body" color="muted">Sem dados no periodo.</Typography>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {normalizedItems.map((item, index) => {
            const percent = mode === 'share'
              ? (total > 0 ? (item.value / total) * 100 : 0)
              : (max > 0 ? (item.value / max) * 100 : 0)

            return (
              <div key={item.label} className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-card)]/70 p-3 dark:bg-[var(--color-surface-muted)]/35">
                <div className="flex items-center gap-3">
                  <div
                    className="relative h-14 w-14 rounded-full"
                    style={{
                      background: `conic-gradient(${colors[index % colors.length][0]} 0%, ${colors[index % colors.length][1]} ${percent}%, rgba(128,128,128,0.2) ${percent}% 100%)`,
                    }}
                  >
                    <div className="absolute inset-[18%] flex items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[11px] font-semibold text-[var(--color-text-secondary)] dark:bg-[var(--color-surface-card)]">
                      {percent.toFixed(0)}%
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Typography variant="caption" className="block truncate">{item.label}</Typography>
                    <Typography variant="h4" className="mt-0.5 leading-none">{formatValue(item.value)}</Typography>
                    {item.subtitle && (
                      <Typography variant="caption" color="secondary" className="mt-1 block truncate">
                        {item.subtitle}
                      </Typography>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function ImoviewLoadingCircle({ message }: { message: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="relative inline-flex h-8 w-8">
        <span className="absolute inset-0 rounded-full border-2 border-[var(--color-surface-border)]" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-red border-r-brand-orange animate-spin" />
      </span>
      <Typography variant="caption" color="secondary">{message}</Typography>
    </div>
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
  const [selectedProcessTags, setSelectedProcessTags] = useState<string[]>([])
  const [canceladosFilter, setCanceladosFilter] = useState<CanceladosFilterMode>('exclude')
  const [loading, setLoading] = useState(false)
  const [imoviewLoading, setImoviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LocacaoMetricsResponse | null>(null)
  const requestRef = useRef(0)

  const fetchMetrics = async () => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setImoviewLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      })

      if (selectedProcessTags.length) {
        params.set('process_tags', selectedProcessTags.join(','))
      }
      params.set('cancelados_filter', canceladosFilter)

      const response = await fetch(`/api/locacao/metrics?${params.toString()}`)
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.detail ?? payload?.error ?? `Falha na consulta (${response.status})`)
      }

      if (requestRef.current !== requestId) return

      setData(payload as LocacaoMetricsResponse)
      setLoading(false)

      try {
        const imoviewResponse = await fetch(`/api/locacao/metrics/imoview?${new URLSearchParams({
          start_date: startDate,
          end_date: endDate,
        }).toString()}`)
        const imoviewPayload = await imoviewResponse.json().catch(() => ({}))

        if (!imoviewResponse.ok) {
          throw new Error(imoviewPayload?.detail ?? imoviewPayload?.error ?? `Falha Imoview (${imoviewResponse.status})`)
        }

        if (requestRef.current !== requestId) return

        const typedPayload = imoviewPayload as ImoviewMetricsEndpointResponse
        setData(current => {
          if (!current) return current

          return {
            ...current,
            integrations: {
              ...current.integrations,
              imoview: typedPayload.integrations.imoview,
            },
            metrics: {
              ...current.metrics,
              tempo_medio_resposta_quarta_interacao_imoview: typedPayload.metrics.tempo_medio_resposta_quarta_interacao_imoview,
              tempo_medio_intervalo_interacoes_imoview: typedPayload.metrics.tempo_medio_intervalo_interacoes_imoview,
            },
            warnings: Array.from(new Set([...(current.warnings ?? []), ...(typedPayload.warnings ?? [])])),
          }
        })
      } catch (imoviewErr) {
        if (requestRef.current !== requestId) return

        const warning = imoviewErr instanceof Error
          ? `KPI Imoview pendente: ${imoviewErr.message}`
          : 'KPI Imoview pendente: erro desconhecido.'

        setData(current => {
          if (!current) return current
          return {
            ...current,
            warnings: Array.from(new Set([...(current.warnings ?? []), warning])),
          }
        })
      } finally {
        if (requestRef.current === requestId) {
          setImoviewLoading(false)
        }
      }
    } catch (err) {
      if (requestRef.current !== requestId) return

      setData(null)
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao consultar metricas.')
      setImoviewLoading(false)
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }

  const availableProcessTags = useMemo(() => {
    return data?.metrics.tempo_medio_processo_trello.available_tags ?? []
  }, [data])

  useEffect(() => {
    if (!availableProcessTags.length || !selectedProcessTags.length) return

    const tagSet = new Set(availableProcessTags)
    setSelectedProcessTags(current => current.filter(tag => tagSet.has(tag)))
  }, [availableProcessTags, selectedProcessTags.length])

  const toggleProcessTag = (tag: string) => {
    setSelectedProcessTags(current =>
      current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag]
    )
  }

  const motivoChartData = useMemo(() => {
    const motivos = data?.metrics.churn_por_motivo.categorias ?? []
    return motivos.map(item => ({
      label: item.motivo,
      value: item.quantidade,
      subtitle: formatCurrency(item.valor),
    }))
  }, [data])

  const trelloCategoriaChartData = useMemo(() => {
    const categorias = data?.metrics.tempo_medio_processo_trello.categorias ?? []
    return categorias.map(item => ({
      label: item.categoria,
      value: item.media_dias,
      subtitle: `${item.quantidade} processos`,
    }))
  }, [data])

  const compactKpis = useMemo<CompactKpi[]>(() => {
    if (!data) return []

    return [
      {
        id: 'ID 1',
        label: 'Novos imoveis captados',
        value: formatNumber(data.metrics.novos_imoveis_captados.valor),
      },
      {
        id: 'ID 2V',
        label: 'Churn em volume',
        value: formatPercent(data.metrics.taxa_churn_rescisao.volume.taxa_percentual),
        supporting: `${data.metrics.taxa_churn_rescisao.volume.rescindidos} rescindidos`,
      },
      {
        id: 'ID 2R$',
        label: 'Churn em valor',
        value: formatPercent(data.metrics.taxa_churn_rescisao.valor.taxa_percentual),
        supporting: formatCurrency(data.metrics.taxa_churn_rescisao.valor.rescindidos),
      },
      {
        id: 'ID 3',
        label: 'Permanencia media (LTV)',
        value: `${formatNumber(data.metrics.prazo_medio_permanencia_ltv.meses)} meses`,
      },
      {
        id: 'ID 6',
        label: 'Vacancia media',
        value: `${formatNumber(data.metrics.tempo_medio_vacancia.dias)} dias`,
      },
      {
        id: 'ID 7',
        label: 'Processo medio Trello',
        value: `${formatNumber(data.metrics.tempo_medio_processo_trello.media_geral_dias)} dias`,
        supporting: `${data.metrics.tempo_medio_processo_trello.processos_no_periodo} processos`,
      },
      {
        id: 'ID 5',
        label: 'Resposta 1a-4a Imoview',
        value: imoviewLoading
          ? '...'
          : `${formatNumber(data.metrics.tempo_medio_resposta_quarta_interacao_imoview.tempo_medio_dias)} dias`,
      },
      {
        id: 'ID 8',
        label: 'Intervalo entre interacoes',
        value: imoviewLoading
          ? '...'
          : `${formatNumber(data.metrics.tempo_medio_intervalo_interacoes_imoview.tempo_medio_dias)} dias`,
      },
    ]
  }, [data, imoviewLoading])

  return (
    <div className="relative mx-auto max-w-[1400px] space-y-6 pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[340px] bg-[radial-gradient(circle_at_top_right,rgba(198,26,38,0.18),transparent_52%),radial-gradient(circle_at_top_left,rgba(255,159,28,0.16),transparent_48%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(198,26,38,0.22),transparent_55%),radial-gradient(circle_at_top_left,rgba(255,159,28,0.12),transparent_50%)]" />

      <Card
        variant="elevated"
        className="overflow-hidden border border-[var(--color-surface-border)] bg-[linear-gradient(125deg,rgba(255,255,255,0.95),rgba(246,246,248,0.9))] dark:bg-[linear-gradient(125deg,rgba(32,33,40,0.96),rgba(24,25,31,0.92))]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Typography variant="label" color="secondary">Dashboard Executivo</Typography>
            <Typography variant="h1" className="mt-2">Locacao</Typography>
            <Typography variant="body" color="secondary" className="mt-2 max-w-3xl">
              Visao analitica com foco em funil, churn e produtividade operacional. Os KPIs numericos foram comprimidos em blocos compactos para ampliar o protagonismo dos graficos e da leitura comparativa.
            </Typography>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-white/70 px-4 py-3 dark:bg-[var(--color-surface-muted)]/55">
            <Typography variant="caption" color="muted">Periodo atual</Typography>
            <Typography variant="h4" className="mt-1">
              {startDate} ate {endDate}
            </Typography>
          </div>
        </div>
      </Card>

      <Card variant="bordered" className="space-y-4 border-[var(--color-surface-border)] backdrop-blur-sm bg-white/80 dark:bg-[var(--color-surface-card)]/75">
        <div className="flex items-center justify-between gap-2">
          <Typography variant="h4">Filtros</Typography>
          {(loading || imoviewLoading) && (
            <Typography variant="caption" color="muted">
              {loading ? 'Calculando metricas gerais...' : 'Carregando KPI Imoview...'}
            </Typography>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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

          <label className="space-y-1">
            <Typography variant="caption" color="muted">Filtro tag CANCELADOS</Typography>
            <select
              value={canceladosFilter}
              onChange={event => setCanceladosFilter(event.target.value as CanceladosFilterMode)}
              className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-card)]"
            >
              <option value="exclude">Nao mostrar cancelados</option>
              <option value="include">Mostrar cancelados</option>
              <option value="only">Apenas cancelados</option>
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Typography variant="caption" color="muted">Tipos de processo (tags do Trello)</Typography>
            {!!selectedProcessTags.length && (
              <button
                type="button"
                className="text-xs text-brand-red hover:underline dark:text-[#FF8E96]"
                onClick={() => setSelectedProcessTags([])}
              >
                Limpar selecao
              </button>
            )}
          </div>

          {!availableProcessTags.length ? (
            <Typography variant="caption" color="secondary">
              Carregue as metricas para listar as tags disponiveis.
            </Typography>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableProcessTags.map(tag => {
                const active = selectedProcessTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleProcessTag(tag)}
                    className={[
                      'px-3 py-1.5 rounded-[var(--radius-full)] border text-xs font-medium transition-colors',
                      active
                        ? 'border-brand-red bg-brand-red text-white'
                        : 'border-[var(--color-surface-border)] bg-[var(--color-surface-card)] hover:border-brand-red hover:text-brand-red',
                    ].join(' ')}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-[var(--radius-md)] border border-brand-red/30 bg-brand-red/5 px-3 py-2">
            <Typography variant="caption" className="text-brand-red">{error}</Typography>
          </div>
        )}
      </Card>

      {data && (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Typography variant="h4">KPIs Essenciais</Typography>
              <Typography variant="caption" color="secondary">
                Cartoes compactos para leitura rapida
              </Typography>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
              {compactKpis.map(item => (
                <CompactKpiCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DonutBreakdownChart
              title="Funil de atendimento por fase"
              subtitle={`Base: ${formatNumber(data.metrics.taxa_cada_fase.total_atendimentos)} atendimentos no periodo`}
              items={(data.metrics.taxa_cada_fase.fases ?? []).map(item => ({
                label: item.fase,
                value: item.quantidade,
                auxiliary: `${item.percentual.toFixed(2)}%`,
              }))}
            />

            <Card variant="bordered" className="space-y-4">
              <div>
                <Typography variant="h4">Churn em contexto</Typography>
                <Typography variant="caption" color="secondary" className="mt-1 block">
                  Comparacao entre volume e impacto financeiro no periodo selecionado
                </Typography>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SweepGauge
                  title="Volume"
                  value={data.metrics.taxa_churn_rescisao.volume.taxa_percentual ?? 0}
                  display={formatPercent(data.metrics.taxa_churn_rescisao.volume.taxa_percentual)}
                  detail={`${data.metrics.taxa_churn_rescisao.volume.rescindidos} rescindidos / ${data.metrics.taxa_churn_rescisao.volume.ativos} ativos`}
                  colors={['#C61A26', '#E8323F']}
                />

                <SweepGauge
                  title="Valor financeiro"
                  value={data.metrics.taxa_churn_rescisao.valor.taxa_percentual ?? 0}
                  display={formatPercent(data.metrics.taxa_churn_rescisao.valor.taxa_percentual)}
                  detail={`${formatCurrency(data.metrics.taxa_churn_rescisao.valor.rescindidos)} / ${formatCurrency(data.metrics.taxa_churn_rescisao.valor.ativos)}`}
                  colors={['#FF9F1C', '#FFC66B']}
                />

                <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3">
                  <Typography variant="caption" color="secondary" className="block">
                    Processos Trello no periodo: {data.metrics.tempo_medio_processo_trello.processos_no_periodo}
                  </Typography>
                  <Typography variant="caption" color="secondary" className="block">
                    Cancelados: {
                      data.metrics.tempo_medio_processo_trello.cancelados_filter === 'exclude'
                        ? 'Nao mostrar'
                        : data.metrics.tempo_medio_processo_trello.cancelados_filter === 'include'
                          ? 'Mostrar'
                          : 'Apenas cancelados'
                    }
                  </Typography>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SweepListChart
              title="Churn por motivo"
              subtitle="Leitura radial da participacao de cada causa no total de rescisoes"
              items={motivoChartData}
              mode="share"
              formatValue={value => `${formatNumber(value)} contratos`}
            />
            <SweepListChart
              title="Tempo medio por categoria (Trello)"
              subtitle="Leitura radial da intensidade por categoria, em dias medios"
              items={trelloCategoriaChartData}
              mode="relative"
              formatValue={value => `${formatNumber(value)} dias`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card variant="bordered" className="xl:col-span-1">
              <Typography variant="caption" color="muted">ID 5 • Imoview</Typography>
              {imoviewLoading ? (
                <>
                  <ImoviewLoadingCircle message="Carregando dados do endpoint Imoview..." />
                  <Typography variant="caption" color="secondary" className="mt-2 block">
                    Aguardando tempo medio de resposta (1a a 4a interacao).
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h3" className="mt-1">
                    {`${formatNumber(data.metrics.tempo_medio_resposta_quarta_interacao_imoview.tempo_medio_dias)} dias`}
                  </Typography>
                  <Typography variant="caption" color="secondary" className="mt-1 block">
                    Atendimentos com 4+ interacoes: {data.metrics.tempo_medio_resposta_quarta_interacao_imoview.atendimentos_com_4_interacoes}
                  </Typography>
                </>
              )}
            </Card>

            <Card variant="bordered" className="xl:col-span-1">
              <Typography variant="caption" color="muted">ID 8 • Imoview</Typography>
              {imoviewLoading ? (
                <>
                  <ImoviewLoadingCircle message="Consultando frequencia entre interacoes..." />
                  <Typography variant="caption" color="secondary" className="mt-2 block">
                    Sincronizando intervalos consolidados do Imoview.
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h3" className="mt-1">
                    {`${formatNumber(data.metrics.tempo_medio_intervalo_interacoes_imoview.tempo_medio_dias)} dias`}
                  </Typography>
                  <Typography variant="caption" color="secondary" className="mt-1 block">
                    Intervalos consolidados: {data.metrics.tempo_medio_intervalo_interacoes_imoview.intervalos_consolidados}
                  </Typography>
                </>
              )}
            </Card>

            <Card variant="bordered" className="xl:col-span-1">
              <Typography variant="caption" color="muted">Filtro aplicado em Trello</Typography>
              <Typography variant="h4" className="mt-1">
                {data.metrics.tempo_medio_processo_trello.tags_filtradas.length
                  ? data.metrics.tempo_medio_processo_trello.tags_filtradas.join(', ')
                  : 'Todas as tags'}
              </Typography>
              <Typography variant="caption" color="secondary" className="mt-1 block">
                Cards avaliados: {data.metrics.tempo_medio_processo_trello.cards_total}
              </Typography>
            </Card>
          </div>

          {!!data.warnings.length && (
            <Card className="border border-brand-orange/25 bg-brand-orange-muted/40 dark:border-brand-orange/35 dark:bg-brand-orange/10">
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

      <Card className="border border-brand-orange/20 bg-brand-orange-muted/40 dark:border-brand-orange/35 dark:bg-brand-orange/10">
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
