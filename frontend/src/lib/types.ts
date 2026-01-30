export interface MarketValuationData {
  weighted_pe: number;
  details: {
    ticker: string;
    pe: number;
    market_cap: number;
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
}

export interface DeepAnalysisData {
  ticker: string;
  first_date: string;
  current_price: number;
  invested_days: number;
  avg_1y_return: number;
  current_1y_return: number;
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
    upper: number[];
    lower: number[];
    samples: number[][];
    actual_past: number[];
    dca_perf?: number[];
    savings_perf?: number[];
  };
}
