/**
 * Convert a Date to days since epoch (UTC, start of day)
 * This is the format used by the PrizePool contract
 * 
 * 🎯 REGRA DE OURO: Use EXATAMENTE esta função em TODOS os lugares
 * (backend, frontend, scripts, admin)
 * 
 * @param date - Date object
 * @returns Number of days since January 1, 1970 00:00:00 UTC
 * 
 * @example
 * getDaysSinceEpochUTC(new Date('2025-12-16')) // Returns 20073
 */
export function getDayUTC(date = new Date()): number {
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24))
}

// Alias for backward compatibility
export function getDaysSinceEpochUTC(date: Date): number {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  )
  return Math.floor(utc / (1000 * 60 * 60 * 24))
}

// Alias for backward compatibility
export const toDaysSinceEpochUTC = getDaysSinceEpochUTC

/**
 * Get UTC day start timestamp (00:00:00.000 UTC)
 * @param date - Date object
 * @returns Timestamp in milliseconds for the start of the day in UTC
 */
export function getUTCDayStart(date: Date): number {
  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ))
  return utcDate.getTime()
}

/**
 * Get UTC day end timestamp (23:59:59.999 UTC)
 * @param date - Date object
 * @returns Timestamp in milliseconds for the end of the day in UTC
 */
export function getUTCDayEnd(date: Date): number {
  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23, 59, 59, 999
  ))
  return utcDate.getTime()
}

