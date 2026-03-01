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

export function formatMinutes(m) {
  if (m == null || m <= 0) return '0 分钟'
  if (m < 60) return `${m} 分钟`
  return `${(m / 60).toFixed(1)} 小时`
}

export function formatPoints(points) {
  const n = Number(points ?? 0)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

export function currentGrades() {
  const y = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => String(y - i))
}

export const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
]

export function formatGender(v) {
  const found = GENDER_OPTIONS.find(g => g.value === v)
  return found?.label || '--'
}
