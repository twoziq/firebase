import React, { createContext, useContext, useState, useEffect } from "react"

type Language = "KO" | "EN"

type LanguageProviderProps = {
  children: React.ReactNode
}

type LanguageProviderState = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  KO: {
    market: "시장 가치 평가",
    dca: "적립식 시뮬레이터",
    risk: "위험/수익 맵",
    deep: "심층 퀀트 분석",
    analyze: "분석하기",
    ticker_placeholder: "티커 입력 (예: AAPL)",
    current_price: "현재가",
    total_invested: "총 투자 원금",
    final_value: "최종 평가 금액",
    return_pct: "수익률",
    simulation: "시뮬레이션",
    prob_dist: "수익률 확률 분포",
    z_flow: "Z-Score 흐름",
    trend_channel: "로그-선형 추세 채널",
    start_date: "시작일",
    end_date: "종료일",
    amount: "투자금",
    freq: "투자 주기",
    daily: "매일",
    weekly: "매주",
    monthly: "매월"
  },
  EN: {
    market: "Market Valuation",
    dca: "DCA Simulator",
    risk: "Risk/Return Map",
    deep: "Deep Quant Analysis",
    analyze: "Analyze",
    ticker_placeholder: "Enter symbol (e.g., AAPL)",
    current_price: "Current Price",
    total_invested: "Total Invested",
    final_value: "Final Value",
    return_pct: "Return %",
    simulation: "Simulation",
    prob_dist: "Probability Distribution",
    z_flow: "Z-Score Flow",
    trend_channel: "Log-Linear Trend Channel",
    start_date: "Start Date",
    end_date: "End Date",
    amount: "Amount",
    freq: "Frequency",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly"
  }
}

const LanguageContext = createContext<LanguageProviderState | undefined>(undefined)

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem("twoziq-lang") as Language) || "KO")

  useEffect(() => {
    localStorage.setItem("twoziq-lang", lang)
  }, [lang])

  const t = (key: string) => translations[lang][key] || key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}
