import { useLanguage } from "./LanguageProvider"
import { useRef } from "react"

export function LanguageToggle() {
  const { lang, setLang, isFunnyMode, setFunnyMode } = useLanguage()
  const lastClickTime = useRef(0)

  const handleKoClick = () => {
    const now = Date.now()
    if (now - lastClickTime.current < 500) { // Double click detected
      setFunnyMode(!isFunnyMode)
      lastClickTime.current = 0
    } else {
      lastClickTime.current = now
    }
    setLang("KO")
  }

  return (
    <div className="flex items-center bg-muted rounded-lg p-1 border border-border">
      <button
        onClick={handleKoClick}
        className={`px-2 py-1 text-xs font-bold rounded transition-all duration-200 ${lang === "KO" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        KO
      </button>
      <button
        onClick={() => { setLang("EN"); setFunnyMode(false); }}
        className={`px-2 py-1 text-xs font-bold rounded transition-all duration-200 ${lang === "EN" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        EN
      </button>
    </div>
  )
}
