// Sistema de logging de peticiones global para HubInspection
// Registra cada consulta, clic, y respuesta con timestamps

const STORAGE_KEY = 'hubinspection-diag-log-enabled'
const MAX_LOGS = 300
const MAX_BODY_CHARS = 5000

const SENSITIVE_KEYS = new Set([
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'token',
  'password',
  'secret',
  'service_role',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'id_token',
])

function sanitizeObject(obj: unknown): unknown {
  if (obj == null) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeObject)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lower)) {
      out[key] = typeof value === 'string' ? value.slice(0, 6) + '…' : '***'
    } else {
      out[key] = sanitizeObject(value)
    }
  }
  return out
}

function truncateBody(body: unknown): unknown {
  if (body == null) return body
  const str = typeof body === 'string' ? body : JSON.stringify(body)
  if (str.length > MAX_BODY_CHARS) {
    return str.slice(0, MAX_BODY_CHARS) + ' …[body omitido por tamaño]'
  }
  return body
}

export type LogType = 'api' | 'click' | 'db' | 'error' | 'ui' | 'method' | 'page' | 'modal' | 'poll'

export interface LogEntry {
  id: string
  traceId: string
  parentTraceId?: string
  timestamp: string
  type: LogType
  action: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'pending' | 'success' | 'error'
  request?: unknown
  response?: unknown
  error?: string
  metadata?: Record<string, unknown>
  pathname?: string
  sessionCallCount?: number
  isDuplicate?: boolean
}

type EnabledListener = (enabled: boolean) => void

export interface LogSession {
  route: string
  startedAt: string
  endedAt?: string
  durationMs?: number
  eventCount: number
  methodCount: number
  apiCount: number
  dbCount: number
  errorCount: number
  slowCount: number
  duplicateCount: number
}

class RequestLogger {
  private logs: LogEntry[] = []
  private maxLogs = MAX_LOGS
  private listeners: ((logs: LogEntry[]) => void)[] = []
  private enabledListeners: EnabledListener[] = []
  private enabled: boolean

  /** Sesión actual por ruta */
  private session: LogSession | null = null
  /** Contador de llamadas por acción dentro de la sesión actual */
  private sessionCallMap = new Map<string, number>()
  /** TraceId de la sesión actual */
  private sessionTraceId = ''

  constructor() {
    this.enabled = this.readEnabledFromStorage()
  }

  private readEnabledFromStorage(): boolean {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  }

  private writeEnabledToStorage(enabled: boolean) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // ignore
    }
  }

  getEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return
    this.enabled = enabled
    this.writeEnabledToStorage(enabled)
    this.enabledListeners.forEach((fn) => fn(enabled))
  }

  subscribeEnabled(fn: EnabledListener): () => void {
    this.enabledListeners.push(fn)
    return () => {
      this.enabledListeners = this.enabledListeners.filter((l) => l !== fn)
    }
  }

  enable() {
    this.setEnabled(true)
  }

  disable() {
    this.setEnabled(false)
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  createTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
  }

  getSessionTraceId(): string {
    return this.sessionTraceId
  }

  /** Inicia una nueva sesión de diagnóstico para la ruta dada. Limpia logs previos. */
  startPageSession(route: string) {
    this.endPageSession()
    this.clear()
    this.sessionTraceId = this.createTraceId()
    this.sessionCallMap.clear()
    this.session = {
      route,
      startedAt: new Date().toISOString(),
      eventCount: 0,
      methodCount: 0,
      apiCount: 0,
      dbCount: 0,
      errorCount: 0,
      slowCount: 0,
      duplicateCount: 0,
    }
    const id = this.generateId()
    const entry: LogEntry = {
      id,
      traceId: this.sessionTraceId,
      timestamp: new Date().toISOString(),
      type: 'page',
      action: 'page_enter',
      startTime: performance.now(),
      status: 'success',
      pathname: route,
      metadata: { route },
    }
    this.logs.unshift(entry)
    this.notify()
  }

  /** Cierra la sesión actual y registra page_leave. */
  endPageSession() {
    if (!this.session) return
    const now = new Date().toISOString()
    const start = new Date(this.session.startedAt).getTime()
    this.session.endedAt = now
    this.session.durationMs = Date.now() - start
    const id = this.generateId()
    const entry: LogEntry = {
      id,
      traceId: this.sessionTraceId,
      timestamp: now,
      type: 'page',
      action: 'page_leave',
      startTime: performance.now(),
      status: 'success',
      pathname: this.session.route,
      metadata: { ...this.session },
    }
    this.logs.unshift(entry)
    this.session = null
    this.sessionTraceId = ''
    this.notify()
  }

  getSession(): LogSession | null {
    return this.session ? { ...this.session } : null
  }

  private notify() {
    this.listeners.forEach((fn) => fn([...this.logs]))
  }

  subscribe(fn: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(fn)
    fn([...this.logs])
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn)
    }
  }

  private currentPathname(): string | undefined {
    if (typeof window === 'undefined') return undefined
    return window.location.pathname
  }

  startLog(
    type: LogEntry['type'],
    action: string,
    request?: unknown,
    metadata?: Record<string, unknown>,
    parentTraceId?: string,
  ): string {
    if (!this.enabled) return ''

    const id = this.generateId()
    const traceId = this.sessionTraceId || this.createTraceId()

    // Conteo de duplicados por sesión
    const prevCount = this.sessionCallMap.get(action) || 0
    const callCount = prevCount + 1
    this.sessionCallMap.set(action, callCount)

    // Actualizar contadores de sesión
    if (this.session) {
      this.session.eventCount += 1
      if (type === 'method' || type === 'click' || type === 'modal' || type === 'poll') this.session.methodCount += 1
      if (type === 'api') this.session.apiCount += 1
      if (type === 'db') this.session.dbCount += 1
      if (callCount > 1) this.session.duplicateCount += 1
    }

    const entry: LogEntry = {
      id,
      traceId,
      parentTraceId,
      timestamp: new Date().toISOString(),
      type,
      action,
      startTime: performance.now(),
      status: 'pending',
      request: truncateBody(sanitizeObject(request)),
      metadata: sanitizeObject(metadata) as Record<string, unknown> | undefined,
      pathname: this.currentPathname(),
      sessionCallCount: callCount,
      isDuplicate: callCount > 1,
    }

    this.logs.unshift(entry)

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    this.notify()

    return id
  }

  endLog(id: string, status: 'success' | 'error', response?: unknown, error?: string) {
    if (!this.enabled || !id) return

    const entry = this.logs.find((l) => l.id === id)
    if (!entry) return

    entry.endTime = performance.now()
    entry.duration = entry.endTime - entry.startTime
    entry.status = status
    entry.response = truncateBody(sanitizeObject(response))
    entry.error = error

    // Actualizar contadores de sesión
    if (this.session && entry.duration !== undefined) {
      if (status === 'error') this.session.errorCount += 1
      if (entry.duration > 2000) this.session.slowCount += 1
    }

    this.notify()
  }

  logClick(buttonName: string, metadata?: Record<string, unknown>) {
    const id = this.startLog('click', buttonName, undefined, metadata)
    this.endLog(id, 'success')
  }

  logUI(message: string, metadata?: Record<string, unknown>) {
    const id = this.startLog('ui', message, undefined, metadata)
    this.endLog(id, 'success')
  }

  logError(action: string, error: string, metadata?: Record<string, unknown>) {
    const id = this.startLog('error', action, undefined, metadata)
    this.endLog(id, 'error', undefined, error)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  getLogsByType(type: LogEntry['type']): LogEntry[] {
    return this.logs.filter((l) => l.type === type)
  }

  getPendingLogs(): LogEntry[] {
    return this.logs.filter((l) => l.status === 'pending')
  }

  clear() {
    this.logs = []
    this.notify()
  }

  exportToJSON(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /** Exporta la sesión actual con resumen estructurado. */
  exportSessionToJSON(): string {
    const session = this.session
    const events = [...this.logs].reverse()

    const methodMap: Record<string, { count: number; totalMs: number; errors: number }> = {}
    const apiMap: Record<string, { count: number; totalMs: number; errors: number }> = {}
    const dbMap: Record<string, { count: number; totalMs: number; errors: number }> = {}

    for (const e of events) {
      const target = e.type === 'api' ? apiMap : e.type === 'db' ? dbMap : methodMap
      const prev = target[e.action] || { count: 0, totalMs: 0, errors: 0 }
      target[e.action] = {
        count: prev.count + 1,
        totalMs: prev.totalMs + (e.duration || 0),
        errors: prev.errors + (e.status === 'error' ? 1 : 0),
      }
    }

    const payload = {
      session: session
        ? {
            route: session.route,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationMs: session.durationMs,
          }
        : null,
      summary: {
        events: events.length,
        methods: Object.keys(methodMap).length,
        apiCalls: Object.keys(apiMap).length,
        dbCalls: Object.keys(dbMap).length,
        errors: events.filter((e) => e.status === 'error').length,
        slowCalls: events.filter((e) => (e.duration || 0) > 2000).length,
        duplicates: events.filter((e) => e.isDuplicate).length,
      },
      events,
      methodMap,
      apiMap,
      dbMap,
    }

    return JSON.stringify(payload, null, 2)
  }

  /** Trazar una función síncrona. */
  traceMethod<T>(
    action: string,
    fn: () => T,
    metadata?: Record<string, unknown>,
    parentTraceId?: string,
  ): T {
    const id = this.startLog('method', action, undefined, metadata, parentTraceId)
    try {
      const result = fn()
      this.endLog(id, 'success', result)
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.endLog(id, 'error', undefined, msg)
      throw err
    }
  }

  /** Trazar una función asíncrona. */
  async traceAsyncMethod<T>(
    action: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
    parentTraceId?: string,
  ): Promise<T> {
    const id = this.startLog('method', action, undefined, metadata, parentTraceId)
    try {
      const result = await fn()
      this.endLog(id, 'success', result)
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.endLog(id, 'error', undefined, msg)
      throw err
    }
  }
}

export const requestLogger = new RequestLogger()

// Helper para envolver funciones async con logging
export async function withLogging<T>(
  type: LogEntry['type'],
  action: string,
  fn: () => Promise<T>,
  request?: unknown,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const id = requestLogger.startLog(type, action, request, metadata, requestLogger.getSessionTraceId())

  try {
    const result = await fn()
    const r = result as Record<string, unknown> | null
    const isControlledError = r && typeof r === 'object' && 'ok' in r && r.ok === false && 'error' in r
    if (isControlledError) {
      const errMsg = String(r.error ?? 'Error controlado')
      requestLogger.endLog(id, 'error', result, errMsg)
    } else {
      requestLogger.endLog(id, 'success', result)
    }
    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    requestLogger.endLog(id, 'error', undefined, errorMsg)
    throw error
  }
}

// Interceptor global de fetch para capturar llamadas HTTP NO cubiertas por wrappers explicitos
const EXCLUDED_FETCH_PREFIXES = ['/api/retail-scrapping']
const EXCLUDED_FETCH_PATTERNS = [/_rsc=/]
let originalFetch: typeof fetch | null = null
function shouldInterceptFetch(url: string): boolean {
  if (EXCLUDED_FETCH_PREFIXES.some((p) => url.startsWith(p))) return false
  if (EXCLUDED_FETCH_PATTERNS.some((re) => re.test(url))) return false
  return true
}
function createFetchInterceptor() {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!shouldInterceptFetch(url)) {
      return (originalFetch as typeof fetch)(input, init)
    }
    const method = init?.method ?? 'GET'
    const logId = requestLogger.startLog('api', `${method} ${url}`, { url, method })

    const start = performance.now()
    try {
      const res = await (originalFetch as typeof fetch)(input, init)
      const duration = performance.now() - start
      let bodyData: unknown = null
      if (res.ok) {
        try {
          const ct = res.headers.get('content-type') ?? ''
          if (ct.includes('application/json')) {
            const clone = res.clone()
            bodyData = await clone.json()
          }
        } catch {
          // ignorar si no es JSON legible
        }
      }
      const isControlledError =
        bodyData && typeof bodyData === 'object' && 'ok' in (bodyData as Record<string, unknown>) &&
        (bodyData as Record<string, unknown>).ok === false
      if (isControlledError) {
        const errMsg = String((bodyData as Record<string, unknown>).error ?? 'Error controlado')
        requestLogger.endLog(
          logId,
          'error',
          { status: res.status, duration: Math.round(duration), body: truncateBody(sanitizeObject(bodyData)) },
          errMsg,
        )
      } else {
        requestLogger.endLog(
          logId,
          res.ok ? 'success' : 'error',
          { status: res.status, duration: Math.round(duration), body: bodyData ? truncateBody(sanitizeObject(bodyData)) : undefined },
        )
      }
      return res
    } catch (err) {
      const duration = performance.now() - start
      requestLogger.endLog(logId, 'error', { duration: Math.round(duration) }, err instanceof Error ? err.message : String(err))
      throw err
    }
  }
}

export function installFetchInterceptor() {
  if (typeof window === 'undefined') return
  if (originalFetch) return // ya instalado
  originalFetch = window.fetch.bind(window)
  window.fetch = createFetchInterceptor()
}

export function uninstallFetchInterceptor() {
  if (typeof window === 'undefined') return
  if (originalFetch) {
    window.fetch = originalFetch
    originalFetch = null
  }
}
