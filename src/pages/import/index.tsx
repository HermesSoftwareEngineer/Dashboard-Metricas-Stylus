import { Card } from '@/components/ui/Card'
import { Typography } from '@/components/ui/Typography'
import { SpreadsheetUploadCard } from '@/components/upload/SpreadsheetUploadCard'

const uploads = [
  {
    type: 'contratos' as const,
    title: 'Upload - Contratos',
    description: 'Envie a planilha legada de contratos (.xls).',
  },
  {
    type: 'imoveis' as const,
    title: 'Upload - Imoveis',
    description: 'Envie a planilha legada de imoveis (.xls).',
  },
  {
    type: 'atendimentos' as const,
    title: 'Upload - Atendimentos',
    description: 'Envie a planilha legada de atendimentos (.xls).',
  },
]

export default function ImportPage() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <Typography variant="h2">Importacao de Planilhas</Typography>
        <Typography variant="body" color="secondary" className="mt-2 max-w-3xl">
          Esta etapa faz o upload e parsing dos arquivos .xls em processos separados por tipo.
          As metricas ainda nao sao calculadas aqui.
        </Typography>
      </div>

      <Card variant="default" className="bg-brand-orange-muted/50 border border-brand-orange/20">
        <Typography variant="label" color="secondary">Obrigatorio</Typography>
        <Typography variant="body" className="mt-1">
          Para habilitar o pipeline completo, importe as 3 planilhas: contratos, imoveis e atendimentos.
        </Typography>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {uploads.map(item => (
          <SpreadsheetUploadCard
            key={item.type}
            type={item.type}
            title={item.title}
            description={item.description}
          />
        ))}
      </div>
    </div>
  )
}
