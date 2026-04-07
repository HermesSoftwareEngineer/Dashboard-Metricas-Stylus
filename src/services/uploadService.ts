export type SpreadsheetType = 'contratos' | 'imoveis' | 'atendimentos'

export interface UploadMetadata {
  type: SpreadsheetType
  filename: string
  rows: number
  columns: number
  originalColumns: string[]
  normalizedColumns: string[]
}

export interface UploadResponse {
  success: boolean
  metadata: UploadMetadata
  preview: Array<Record<string, unknown>>
  records: Array<Record<string, unknown>>
}

export async function uploadSpreadsheet(file: File, type: SpreadsheetType): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', type)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.detail ?? `Falha no upload (${response.status})`)
  }

  return payload as UploadResponse
}
