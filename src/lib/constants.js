export const OPEN_HOUR = 6
export const CLOSE_HOUR = 23

export function isOpenNow() {
  const h = new Date().getHours()
  return h >= OPEN_HOUR && h < CLOSE_HOUR
}

export const SLOT_TEXT = {
  allday: '全天',
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
}

export const AVATAR_FALLBACK = (seed) => `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`

export const getLocalDate = () => new Date().toLocaleDateString('sv-SE')

export function currentGrades() {
  const y = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => String(y - i))
}
