/**
 * 🎯 FUNÇÃO ÚNICA DE CÁLCULO DE DAY (EPOCH-DAY)
 * 
 * Esta é a ÚNICA forma permitida de calcular day em TODO o código.
 * 
 * @param date - Date object (defaults to current date)
 * @returns Number of days since January 1, 1970 00:00:00 UTC
 * 
 * @example
 * getDayId(new Date('2025-12-16')) // Returns 20443
 * getDayId() // Returns today's day
 */
export function getDayId(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 86400000)
}



