import { useState, useEffect, useCallback, useRef } from 'react'
import type { FetchState } from '@/types/api.types'

type Fetcher<T> = () => Promise<T>

/**
 * useFetch – generic data fetch hook.
 * Returns { data, loading, error, refetch }.
 */
export function useFetch<T>(fetcher: Fetcher<T>): FetchState<T> & { refetch: () => void } {
    const [state, setState] = useState<FetchState<T>>({
        data: null,
        loading: true,
        error: null,
    })

    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    const execute = useCallback(() => {
        setState(prev => ({ ...prev, loading: true, error: null }))
        fetcherRef.current()
            .then(data => setState({ data, loading: false, error: null }))
            .catch((err: unknown) =>
                setState({
                    data: null,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Unknown error',
                })
            )
    }, [])

    useEffect(() => {
        execute()
    }, [execute])

    return { ...state, refetch: execute }
}
