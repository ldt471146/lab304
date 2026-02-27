export const SLOTS = [
  { key: 'morning', label: '上午', time: '08:00 - 12:00', start: 8, end: 12 },
  { key: 'afternoon', label: '下午', time: '14:00 - 18:00', start: 14, end: 18 },
  { key: 'evening', label: '晚上', time: '19:00 - 22:00', start: 19, end: 22 },
]

export const SLOT_LABEL = { morning: '上午', afternoon: '下午', evening: '晚上' }

export const AVATAR_FALLBACK = (seed) => `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`

export const getLocalDate = () => new Date().toLocaleDateString('sv-SE')

export function currentGrades() {
  const y = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => String(y - i))
}
