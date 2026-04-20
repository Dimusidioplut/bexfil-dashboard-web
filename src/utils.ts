export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatMonthLabel(value: string): string {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatWeekLabel(value: string): string {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

export function formatIsoDate(value: string): string {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function clampRange<T>(items: T[], startIndex: number, endIndex: number): T[] {
  if (items.length === 0) {
    return []
  }
  const safeStart = Math.max(0, Math.min(startIndex, items.length - 1))
  const safeEnd = Math.max(safeStart, Math.min(endIndex, items.length - 1))
  return items.slice(safeStart, safeEnd + 1)
}
