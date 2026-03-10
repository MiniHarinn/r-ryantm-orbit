import * as React from "react"

const STORAGE_KEY = "r-ryantm-orbit:time-display"

const readStoredPreference = () => {
  if (typeof window === "undefined") return true
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === null) return true
  return stored === "local"
}

export function useTimeDisplay() {
  const [showLocalTime, setShowLocalTimeState] = React.useState(
    readStoredPreference
  )

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      setShowLocalTimeState(event.newValue === "local")
    }
    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>
      if (typeof customEvent.detail !== "boolean") return
      setShowLocalTimeState(customEvent.detail)
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("time-display-change", handleCustomEvent)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("time-display-change", handleCustomEvent)
    }
  }, [])

  const setShowLocalTime = React.useCallback((next: boolean) => {
    setShowLocalTimeState(next)
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, next ? "local" : "utc")
    window.dispatchEvent(new CustomEvent("time-display-change", { detail: next }))
  }, [])

  return { showLocalTime, setShowLocalTime }
}
