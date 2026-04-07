/**
 * apiClient.ts
 * Base HTTP client — structured for easy swap to Axios or any real API.
 * Currently uses the browser Fetch API with typed responses.
 */

import type { ApiResponse } from '@/types/api.types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.stylus.com.br'

async function request<T>(
    endpoint: string,
    options?: RequestInit
): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    })

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    return res.json() as Promise<ApiResponse<T>>
}

export const apiClient = {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
    post: <T>(endpoint: string, body: unknown) =>
        request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(endpoint: string, body: unknown) =>
        request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
}
