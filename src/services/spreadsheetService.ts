/**
 * spreadsheetService.ts
 * Mocked Google Sheets / spreadsheet data.
 * Replace with Google Sheets API or imported CSV logic when configured.
 */

export interface SpreadsheetRow {
    [key: string]: string | number | boolean | null
}

export interface SpreadsheetData {
    sheetName: string
    headers: string[]
    rows: SpreadsheetRow[]
    lastSync: string
}

const MOCK_DELAY = 500

function delay<T>(value: T, ms = MOCK_DELAY): Promise<T> {
    return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

export const spreadsheetService = {
    getSheet: (sheetName: string): Promise<SpreadsheetData> =>
        delay({
            sheetName,
            headers: ['Mês', 'Receita', 'Despesas', 'Lucro'],
            lastSync: new Date().toISOString(),
            rows: [
                { Mês: 'Janeiro', Receita: 128000, Despesas: 85000, Lucro: 43000 },
                { Mês: 'Fevereiro', Receita: 142000, Despesas: 91000, Lucro: 51000 },
                { Mês: 'Março', Receita: 136000, Despesas: 88000, Lucro: 48000 },
            ],
        }),

    listSheets: (): Promise<string[]> =>
        delay(['Financeiro', 'Vendas', 'Operacional', 'Marketing']),
}
