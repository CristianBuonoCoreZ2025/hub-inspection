'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { requestLogger, type LogEntry } from '@/lib/request-logger'
import { useMounted } from '@/hooks/use-mounted'
import { X, Trash2, Download, Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RequestLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isOpen, setIsOpen] = useState(true)
  const [view, setView] = useState<'chronological' | 'methods' | 'duplicates' | 'slow' | 'errors'>('chronological')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [session, setSession] = useState(requestLogger.getSession())
  const mounted = useMounted()

  useEffect(() => {
    const unsubscribe = requestLogger.subscribe((newLogs) => {
      setLogs(newLogs)
      setSession(requestLogger.getSession())
      if (autoScroll && scrollRef.current) {
        scrollRef.current.scrollTop = 0
      }
    })
    return unsubscribe
  }, [autoScroll])

  const filteredLogs = (() => {
    switch (view) {
      case 'chronological': return logs
      case 'methods': return logs.filter(l => l.type === 'method' || l.type === 'click' || l.type === 'modal' || l.type === 'poll' || l.type === 'ui')
      case 'duplicates': return logs.filter(l => l.isDuplicate)
      case 'slow': return logs.filter(l => (l.duration || 0) > 1000)
      case 'errors': return logs.filter(l => l.status === 'error')
    }
  })()

  const getStatusIcon = (status: LogEntry['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-3 w-3 text-green-500" />
      case 'error': return <AlertCircle className="h-3 w-3 text-red-500" />
      case 'pending': return <Loader2 className="h-3 w-3 text-yellow-500 animate-spin" />
    }
  }

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'api': return 'bg-blue-200 text-blue-900'
      case 'db': return 'bg-purple-200 text-purple-900'
      case 'click': return 'bg-orange-200 text-orange-900'
      case 'error': return 'bg-red-200 text-red-900'
      case 'ui': return 'bg-gray-200 text-gray-900'
      case 'method': return 'bg-emerald-200 text-emerald-900'
      case 'page': return 'bg-yellow-200 text-yellow-900'
      case 'modal': return 'bg-pink-200 text-pink-900'
      case 'poll': return 'bg-cyan-200 text-cyan-900'
    }
  }

  const downloadLogs = () => {
    const route = session?.route?.replace(/^\//, '').replace(/\//g, '_') || 'global'
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const blob = new Blob([requestLogger.exportSessionToJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diagnostic-log__${route}__${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = {
    total: logs.length,
    pending: logs.filter(l => l.status === 'pending').length,
    success: logs.filter(l => l.status === 'success').length,
    error: logs.filter(l => l.status === 'error').length,
    avgDuration: logs.filter(l => l.duration).reduce((acc, l) => acc + (l.duration || 0), 0) / logs.filter(l => l.duration).length || 0
  }

  const panel = !isOpen ? (
    <Button
        variant="outline"
        size="sm"
        className="fixed right-4 top-4 z-[9999] gap-2"
        onClick={() => setIsOpen(true)}
      >
        <Clock className="h-4 w-4" />
        Logs ({stats.total})
        {stats.pending > 0 && (
          <span className="h-5 min-w-5 px-1 rounded bg-gray-200 text-xs">
            {stats.pending}
          </span>
        )}
        {stats.error > 0 && (
          <span className="h-5 min-w-5 px-1 rounded bg-red-500 text-white text-xs">
            {stats.error}
          </span>
        )}
      </Button>
  ) : (
    <div className="fixed right-4 top-4 z-[9999] w-[380px] max-h-[600px] bg-slate-50 border border-slate-300 rounded-lg shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-white rounded-t-lg shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="font-semibold text-sm truncate">Log de diagnostico</span>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-gray-200">{stats.total}</span>
            <span className="px-1.5 py-0.5 rounded border text-yellow-600">{stats.pending}</span>
            <span className="px-1.5 py-0.5 rounded border text-green-600">{stats.success}</span>
            <span className="px-1.5 py-0.5 rounded bg-red-500 text-white">{stats.error}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button onClick={downloadLogs} className="btn-cancel">
            <Download className="h-3 w-3" />
            Descargar
          </Button>
          <Button onClick={() => requestLogger.clear()} className="btn-cancel">
            <Trash2 className="h-3 w-3" />
            Eliminar
          </Button>
          <Button onClick={() => setIsOpen(false)} className="btn-icon">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 p-2 border-b bg-slate-100">
        {([
          { key: 'chronological' as const, label: 'Cronologico' },
          { key: 'methods' as const, label: 'Metodos' },
          { key: 'duplicates' as const, label: 'Dup' },
          { key: 'slow' as const, label: 'Lentos' },
          { key: 'errors' as const, label: 'Errores' },
        ]).map((v) => (
          <Button
            key={v.key}
            variant={view === v.key ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-[10px] capitalize px-1.5"
            onClick={() => setView(v.key)}
          >
            {v.label}
          </Button>
        ))}
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-[10px] cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          Auto
        </label>
      </div>
      {session && (
        <div className="px-2 py-1 text-[10px] bg-slate-200 text-slate-700 border-b truncate" title={session.route}>
          {session.route} &middot; {session.eventCount} eventos &middot; {session.errorCount} errores &middot; {session.slowCount} lentos &middot; {session.duplicateCount} dup
        </div>
      )}

      {/* Log List */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="divide-y">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No hay logs registrados aun
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  'p-2 text-xs hover:bg-white transition-colors border-b border-slate-200',
                  log.status === 'error' && 'bg-red-50',
                  log.status === 'pending' && 'bg-amber-50'
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 mt-0.5">
                    {getStatusIcon(log.status)}
                    <span className={cn('px-1 rounded text-[9px] font-medium', getTypeColor(log.type))}>
                      {log.type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{log.action}</div>
                    {log.duration !== undefined && (
                      <div className="text-[10px] text-gray-500">{Math.round(log.duration)}ms</div>
                    )}
                    {log.pathname && (
                      <div className="text-[10px] text-gray-400 truncate">{log.pathname}</div>
                    )}
                    {log.error && (
                      <div className="text-[10px] text-red-600 truncate">{log.error}</div>
                    )}
                    {log.isDuplicate && (
                      <span className="inline-block mt-0.5 px-1 rounded bg-amber-100 text-amber-800 text-[9px]">
                        dup x{log.sessionCallCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )

  if (!mounted) return null

  return createPortal(panel, document.body)
}
