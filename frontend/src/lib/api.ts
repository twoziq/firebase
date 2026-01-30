import axios from 'axios';

// Cloud Run URL
const API_URL = 'https://firebase-683518334177.asia-northeast3.run.app';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds for complex calculations
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface TrendData {
  ticker: string;
  current_price: number;
  band_position: number;
  trend_upper: number;
  trend_lower: number;
  dates: string[];
  prices: number[];
  trend_middle_history: number[];
}

export interface SimulationData {
  ticker: string;
  current_price: number;
  simulation_days: number;
  paths: {
    p95: number[];
    p50: number[];
    p05: number[];
  };
  win_rate: number;
}

export interface QuantData {
  ticker: string;
  lookback_days: number;
  current_return_pct: number;
  percentile_rank: number;
  z_score: number;
  history_z_score: number[];
  history_dates: string[];
}
