import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function UpdatePrompt() {
  const [waiting, setWaiting] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      const check = (sw) => {
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(sw)
          }
        })
      }
      if (reg.waiting) { setWaiting(reg.waiting); return }
      if (reg.installing) check(reg.installing)
      reg.addEventListener('updatefound', () => { if (reg.installing) check(reg.installing) })
    })
    // Check for updates every 60s
    const id = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((r) => r?.update())
    }, 60000)
    return () => clearInterval(id)
  }, [])

  if (!waiting) return null

  function handleUpdate() {
    waiting.postMessage('SKIP_WAITING')
    window.location.reload()
  }

  return (
    <div className="update-banner" onClick={handleUpdate}>
      <RefreshCw size={14} className="update-spin" />
      <span>新版本可用，点击更新</span>
    </div>
  )
}
