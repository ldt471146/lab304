import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'

function isNative() {
  return Boolean(globalThis?.window?.Capacitor?.isNativePlatform?.())
}

export default function NativeUpdateChecker() {
  const [manifest, setManifest] = useState(null)
  const [errorCount, setErrorCount] = useState(0)
  const updateManifestUrl = import.meta.env.VITE_UPDATE_MANIFEST_URL

  const currentVersion = useMemo(() => {
    return import.meta.env.VITE_APP_BUILD_VERSION || 'dev'
  }, [])

  useEffect(() => {
    if (!isNative()) return
    if (!updateManifestUrl) return

    let stop = false
    const check = async () => {
      try {
        const res = await fetch(`${updateManifestUrl}?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!stop) {
          setManifest(data)
          setErrorCount(0)
        }
      } catch {
        if (!stop) setErrorCount((x) => x + 1)
      }
    }

    check()
    const id = setInterval(check, 60000)
    const onVisible = () => {
      if (!document.hidden) check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stop = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [updateManifestUrl])

  if (!isNative()) return null
  if (!updateManifestUrl) return null
  if (!manifest?.version || !manifest?.apkUrl) return null
  if (manifest.version === currentVersion) return null

  return (
    <div className="update-banner" onClick={() => window.open(manifest.apkUrl, '_blank')}>
      <Download size={14} className="update-spin" />
      <span>
        发现新版本 {manifest.version}，点击下载安装（当前 {currentVersion}）
      </span>
      {errorCount > 3 ? <span>（网络波动，已自动重试）</span> : null}
    </div>
  )
}
