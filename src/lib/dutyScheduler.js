/**
 * 值日排班算法 — 贪心 + 局部优化
 *
 * @param {Object} params
 * @param {Array<{userId:string, name:string, startDate:string, endDate:string}>} params.members
 * @param {string} params.rangeStart  YYYY-MM-DD
 * @param {string} params.rangeEnd    YYYY-MM-DD
 * @param {number} params.minPerDay
 * @param {number} params.maxPerDay
 * @returns {Array<{date:string, userIds:string[]}>}
 */
export function generateSchedule({ members, rangeStart, rangeEnd, minPerDay, maxPerDay }) {
  const dates = []
  for (let d = new Date(rangeStart); d <= new Date(rangeEnd); d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  if (!dates.length || !members.length) return []

  // 1. 日-人关系
  const dayMembers = new Map()
  for (const date of dates) {
    const available = members.filter(m => m.startDate <= date && m.endDate >= date)
    dayMembers.set(date, available.map(m => m.userId))
  }

  // 2. 每人在岗天数 & 目标值
  const presentDays = new Map()
  for (const m of members) presentDays.set(m.userId, 0)
  for (const [, ids] of dayMembers) {
    for (const id of ids) presentDays.set(id, (presentDays.get(id) || 0) + 1)
  }

  const totalPresent = [...presentDays.values()].reduce((a, b) => a + b, 0)
  const minTotal = dates.length * minPerDay
  const maxTotal = dates.length * maxPerDay
  const avgTotal = (minTotal + maxTotal) / 2
  let idealRate = totalPresent > 0 ? avgTotal / totalPresent : 0.3
  idealRate = Math.max(0.15, Math.min(0.55, idealRate))

  const target = new Map()
  for (const m of members) {
    target.set(m.userId, Math.round((presentDays.get(m.userId) || 0) * idealRate))
  }

  // 3. 分配每日人数
  const dayCount = new Map()
  let remaining = avgTotal - dates.length * minPerDay
  for (const date of dates) dayCount.set(date, minPerDay)

  if (remaining > 0) {
    const sortedDates = [...dates].sort((a, b) => {
      const da = dayMembers.get(a).length, db = dayMembers.get(b).length
      return (db - dayCount.get(b)) - (da - dayCount.get(a)) || db - da
    })
    for (const date of sortedDates) {
      if (remaining <= 0) break
      const avail = dayMembers.get(date).length
      const cur = dayCount.get(date)
      if (cur < maxPerDay && cur < avail) {
        dayCount.set(date, cur + 1)
        remaining--
      }
    }
  }

  // 4. 贪心排人
  const assigned = new Map()
  for (const m of members) assigned.set(m.userId, 0)

  const schedule = new Map()
  const remainingDaysFor = new Map()
  for (const m of members) remainingDaysFor.set(m.userId, presentDays.get(m.userId))

  for (const date of dates) {
    const available = dayMembers.get(date)
    const need = dayCount.get(date)

    const sorted = [...available].sort((a, b) => {
      const ra = remainingDaysFor.get(a) || 1, rb = remainingDaysFor.get(b) || 1
      const urgA = (target.get(a) - assigned.get(a)) / ra
      const urgB = (target.get(b) - assigned.get(b)) / rb
      if (urgB !== urgA) return urgB - urgA
      const debtA = target.get(a) - assigned.get(a), debtB = target.get(b) - assigned.get(b)
      if (debtB !== debtA) return debtB - debtA
      return assigned.get(a) - assigned.get(b)
    })

    const picked = sorted.slice(0, Math.min(need, available.length))
    schedule.set(date, picked)
    for (const id of picked) assigned.set(id, (assigned.get(id) || 0) + 1)
    for (const id of available) remainingDaysFor.set(id, (remainingDaysFor.get(id) || 0) - 1)
  }

  // 5. 局部优化: 超额者与欠额者交换
  for (let round = 0; round < 50; round++) {
    let improved = false
    for (const [date, picked] of schedule) {
      const available = dayMembers.get(date)
      for (let i = 0; i < picked.length; i++) {
        const over = picked[i]
        const overExcess = assigned.get(over) - target.get(over)
        if (overExcess <= 0) continue

        for (const candidate of available) {
          if (picked.includes(candidate)) continue
          const candDeficit = target.get(candidate) - assigned.get(candidate)
          if (candDeficit <= 0) continue

          // swap reduces total error
          picked[i] = candidate
          assigned.set(over, assigned.get(over) - 1)
          assigned.set(candidate, assigned.get(candidate) + 1)
          improved = true
          break
        }
        if (improved) break
      }
      if (improved) break
    }
    if (!improved) break
  }

  return dates.map(date => ({ date, userIds: schedule.get(date) || [] }))
}

export function computeStats(schedule, members) {
  const counts = new Map()
  for (const m of members) counts.set(m.userId, 0)
  for (const { userIds } of schedule) {
    for (const id of userIds) counts.set(id, (counts.get(id) || 0) + 1)
  }
  const vals = [...counts.values()]
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const variance = vals.length ? vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length : 0
  return {
    perMember: members.map(m => ({ userId: m.userId, name: m.name, count: counts.get(m.userId) || 0 })),
    avg: avg.toFixed(1),
    stddev: Math.sqrt(variance).toFixed(2),
  }
}
