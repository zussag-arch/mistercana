/** stagione dell'asta dalla data: da luglio in poi è la stagione che comincia (agosto 2027 → 2027/28) */
export function seasonOf(date: Date): string {
  const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`
}
