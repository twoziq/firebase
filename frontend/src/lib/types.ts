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
  current_return: number;
  trend: {
    dates: string[];
    prices: number[];
    upper: number[];
    middle: number[];
    lower: number[];
  };
  quant: {
    mean: number;
    std: number;
    current_z: number;
    z_history: number[];
    z_dates: string[];
    bins: number[];
    counts: number[];
  };
  simulation: {
    p50: number[];
    samples: number[][];
    actual_past: number[];
  };
}