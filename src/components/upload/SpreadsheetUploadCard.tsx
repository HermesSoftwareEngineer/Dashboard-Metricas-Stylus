import { useMemo, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Typography } from '@/components/ui/Typography'
import { uploadSpreadsheet, type UploadResponse, type SpreadsheetType } from '@/services/uploadService'

type UploadState = 'idle' | 'selected' | 'uploading' | 'success' | 'error'

interface SpreadsheetUploadCardProps {
  type: SpreadsheetType
  title: string
  description: string
}

const statusLabel: Record<UploadState, string> = {
  idle: 'Aguardando arquivo',
  selected: 'Arquivo selecionado',
  uploading: 'Processando',
  success: 'Importado com sucesso',
  error: 'Falha no processamento',
}

const statusClass: Record<UploadState, string> = {
  idle: 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]',
  selected: 'bg-brand-orange-muted text-brand-orange-dark',
  uploading: 'bg-blue-500/10 text-blue-500',
  success: 'bg-brand-green-muted text-brand-green',
  error: 'bg-brand-red-muted text-brand-red',
}

function prettyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

export function SpreadsheetUploadCard({ type, title, description }: SpreadsheetUploadCardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResponse | null>(null)

  const previewColumns = useMemo(() => {
    if (!result?.preview.length) return []
    return Object.keys(result.preview[0]).slice(0, 8)
  }, [result])

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setResult(null)
    setErrorMessage(null)
    setStatus(file ? 'selected' : 'idle')
  }

  const onUpload = async () => {
    if (!selectedFile) {
      setStatus('error')
      setErrorMessage('Selecione um arquivo .xls antes de enviar.')
      return
    }

    setStatus('uploading')
    setErrorMessage(null)

    try {
      const payload = await uploadSpreadsheet(selectedFile, type)
      setResult(payload)
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setResult(null)
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido no upload.')
    }
  }

  return (
    <Card variant="bordered" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Typography variant="h4">{title}</Typography>
          <Typography variant="caption" color="muted" className="mt-1 block">
            {description}
          </Typography>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass[status]}`}>
          {statusLabel[status]}
        </span>
      </div>

      <div className="space-y-2">
        <input
          type="file"
          accept=".xls,application/vnd.ms-excel"
          onChange={onFileChange}
          className="w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--color-surface-muted)] file:text-[var(--color-text-primary)]"
        />
        {selectedFile && (
          <Typography variant="caption" color="muted">
            Arquivo: {selectedFile.name}
          </Typography>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={onUpload} loading={status === 'uploading'} disabled={!selectedFile}>
          Upload
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-[var(--radius-md)] border border-brand-red/30 bg-brand-red/5 px-3 py-2">
          <Typography variant="caption" className="text-brand-red">
            {errorMessage}
          </Typography>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-2">
              <Typography variant="caption" color="muted">Linhas</Typography>
              <Typography variant="h4">{result.metadata.rows}</Typography>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-2">
              <Typography variant="caption" color="muted">Colunas</Typography>
              <Typography variant="h4">{result.metadata.columns}</Typography>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-2">
              <Typography variant="caption" color="muted">Tipo</Typography>
              <Typography variant="h4" className="capitalize">{result.metadata.type}</Typography>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-2">
              <Typography variant="caption" color="muted">Preview</Typography>
              <Typography variant="h4">{result.preview.length}</Typography>
            </div>
          </div>

          <div className="overflow-auto border border-[var(--color-surface-border)] rounded-[var(--radius-md)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--color-surface-muted)]">
                <tr>
                  {previewColumns.map(column => (
                    <th key={column} className="text-left px-3 py-2 font-semibold text-[var(--color-text-secondary)]">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.preview.map((row, rowIndex) => (
                  <tr key={`${type}-row-${rowIndex}`} className="border-t border-[var(--color-surface-border)]">
                    {previewColumns.map(column => (
                      <td key={`${type}-${rowIndex}-${column}`} className="px-3 py-2 text-[var(--color-text-primary)] align-top">
                        {prettyValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}
