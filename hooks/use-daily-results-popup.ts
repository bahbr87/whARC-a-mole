import { useState, useEffect } from "react"
import { getTodayDayId, checkResultsAvailable } from "@/lib/days"

/**
 * Hook to manage daily results popup
 * Shows popup when results from yesterday are available
 * Only shows once per day (tracked in localStorage)
 */
export function useDailyResultsPopup() {
  const [showPopup, setShowPopup] = useState(false)
  const [yesterdayDayId, setYesterdayDayId] = useState<number | null>(null)

  useEffect(() => {
    const todayDayId = getTodayDayId()
    const lastPopupDay = localStorage.getItem("lastPopupDay")
    const yesterday = todayDayId - 1

    // Se o pop-up ainda não foi mostrado hoje
    if (lastPopupDay !== todayDayId.toString()) {
      checkResultsAvailable(yesterday).then((hasResults) => {
        if (hasResults) {
          setYesterdayDayId(yesterday)
          setShowPopup(true)
        }
      })
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem("lastPopupDay", getTodayDayId().toString())
    setShowPopup(false)
  }

  return { showPopup, handleClose, yesterdayDayId }
}


