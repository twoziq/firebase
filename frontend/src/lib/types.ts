export interface MarketValuationData {
  weighted_pe: number;
  total_market_cap: number;
  top_8_tickers: string[];
  details: {
    ticker: string;
    pe: number;
    market_cap: number;
    earnings: number;
  }[];
}

export interface DcaData {
  ticker: string;
  total_invested: number;
  final_value: number;
  return_pct: number;
  dates: string[];
  invested_curve: number[];
  valuation_curve: number[];
}

export interface RiskReturnData {
  ticker: string;
  return: number;
  risk: number;
  current_price: number;
}

export interface DeepAnalysisData {
  ticker: string;
  current_price: number;
  trend: {
    dates: string[];
    prices: number[];
    upper: number[];
    middle: number[];
    lower: number[];
  };
  quant: {
    current_z: number;
    z_history: number[];
    z_dates: string[];
    distribution: {
      bins: number[];
      counts: number[];
    };
  };
  simulation: {
    days: number;
    p95: number[];
    p50: number[];
    p05: number[];
  };
}
