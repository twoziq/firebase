import { useLanguage } from "./LanguageProvider"

export function LanguageToggle() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="flex items-center bg-muted rounded-lg p-1 border border-border">
      <button
        onClick={() => setLang("KO")}
        className={`px-2 py-1 text-xs font-bold rounded ${lang === "KO" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        KO
      </button>
      <button
        onClick={() => setLang("EN")}
        className={`px-2 py-1 text-xs font-bold rounded ${lang === "EN" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        EN
      </button>
    </div>
  )
}
