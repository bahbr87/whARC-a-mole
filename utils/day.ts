/**
 * 🎯 FUNÇÃO ÚNICA DE CÁLCULO DE DAY (EPOCH-DAY)
 * 
 * Esta é a ÚNICA forma permitida de calcular day em TODO o código.
 * 
 * ✅ SEMPRE usa meia-noite UTC para garantir consistência entre frontend e backend
 * ✅ Funciona corretamente em qualquer fuso horário
 * 
 * @param date - Date object (defaults to current date)
 * @returns Number of days since January 1, 1970 00:00:00 UTC
 * 
 * @example
 * getDayId(new Date('2025-12-16')) // Returns 20443
 * getDayId() // Returns today's day (UTC)
 */
export function getDayId(date: Date = new Date()): number {
  // Use meia-noite UTC para garantir consistência
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  )
  return Math.floor(utc / 86400000)
}



