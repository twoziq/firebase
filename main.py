from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from scipy.stats import linregress
from datetime import datetime, timedelta
import pytz
from functools import lru_cache
from typing import Optional, List, Dict, Any

app = FastAPI(title="Twoziq Finance API")

# CORS Configuration
origins = ["*"]  # In production, specify your Cloudflare Pages URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
KST = pytz.timezone('Asia/Seoul')

def get_today_str():
    return datetime.now(KST).strftime('%Y-%m-%d')

# --- Helper Functions (Ported from reference) ---

@lru_cache(maxsize=128)
def load_historical_data_cached(ticker: str, start_date: str, end_date: str):
    """
    Load historical data using yfinance. Cached via lru_cache.
    """
    try:
        # yfinance download
        df = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if df.empty:
            return None, "No data found for the given range."
        
        # Flatten MultiIndex columns if present (common in new yfinance versions)
        if isinstance(df.columns, pd.MultiIndex):
            # Keep only 'Close' for simplicity or flatten all
            # Here we specifically need 'Close' often
            if 'Close' in df.columns:
                 # If MultiIndex is (Price, Ticker), extract Close
                 pass 
        
        return df, None
    except Exception as e:
        return None, str(e)

def extract_close_series(df: pd.DataFrame) -> pd.Series:
    """Helper to safely extract Close series from yfinance result"""
    if isinstance(df.columns, pd.MultiIndex):
        # Assuming the structure is level 0 = Price Type, level 1 = Ticker
        # We try to get 'Close'
        try:
            series = df['Close'].iloc[:, 0]
        except:
             # Fallback if structure is different
             series = df.iloc[:, 0]
    elif 'Close' in df.columns:
        series = df['Close']
    else:
        series = df.iloc[:, 0] # Fallback to first column
    
    return series.dropna()

# --- Analysis Logic ---

def run_simulation_logic(ticker: str, days: int = 252, iterations: int = 1000):
    end_date = get_today_str()
    start_date = (datetime.now(KST) - timedelta(days=days*3)).strftime('%Y-%m-%d') # Enough buffer
    
    df, error = load_historical_data_cached(ticker, start_date, end_date)
    if error:
        raise HTTPException(status_code=404, detail=error)
    
    series = extract_close_series(df)
    
    if len(series) < days + 1:
        raise HTTPException(status_code=400, detail="Not enough data for simulation")

    # Rolling window returns
    returns = series.pct_change(days).dropna()
    
    # Monte Carlo
    S0 = series.iloc[-1]
    log_returns = np.log(1 + series.pct_change()).dropna()
    drift = log_returns.mean() - (0.5 * log_returns.var())
    stdev = log_returns.std()
    
    # Generate paths
    daily_returns = np.exp(drift + stdev * np.random.normal(0, 1, (days, iterations)))
    
    price_paths = np.zeros_like(daily_returns)
    price_paths[0] = S0
    for t in range(1, days):
        price_paths[t] = price_paths[t - 1] * daily_returns[t]
        
    final_prices = price_paths[-1]
    sim_returns_pct = ((final_prices - S0) / S0) * 100
    
    # Calculate stats for response
    p95 = np.percentile(price_paths, 95, axis=1).tolist()
    p50 = np.percentile(price_paths, 50, axis=1).tolist()
    p05 = np.percentile(price_paths, 5, axis=1).tolist()
    
    return {
        "ticker": ticker,
        "current_price": S0,
        "simulation_days": days,
        "paths": {
            "p95": p95,
            "p50": p50,
            "p05": p05
        },
        "final_return_distribution": sim_returns_pct.tolist(), # Heavy data
        "win_rate": float(np.mean(sim_returns_pct > 0) * 100)
    }

def run_quant_logic(ticker: str, lookback: int = 252):
    end_date = get_today_str()
    # Load enough data for lookback + buffer
    start_date = (datetime.now(KST) - timedelta(days=lookback*3)).strftime('%Y-%m-%d')
    
    df, error = load_historical_data_cached(ticker, start_date, end_date)
    if error:
        raise HTTPException(status_code=404, detail=error)
    
    series = extract_close_series(df)
    
    if len(series) < lookback + 1:
        raise HTTPException(status_code=400, detail="Not enough data")
        
    returns = series.pct_change(lookback).dropna()
    
    # Percentile
    current_return = returns.iloc[-1]
    sorted_returns = np.sort(returns.values)
    percentile = (np.searchsorted(sorted_returns, current_return) / len(sorted_returns)) * 100
    
    # Z-Score
    z_score = (returns - returns.mean()) / returns.std()
    current_z = z_score.iloc[-1]
    
    return {
        "ticker": ticker,
        "lookback_days": lookback,
        "current_return_pct": float(current_return * 100),
        "percentile_rank": float(percentile),
        "z_score": float(current_z),
        "history_z_score": z_score.tail(100).tolist(), # Last 100 days z-score for chart
        "history_dates": z_score.tail(100).index.strftime('%Y-%m-%d').tolist()
    }

def run_trend_logic(ticker: str):
    end_date = get_today_str()
    start_date = (datetime.now(KST) - timedelta(days=365*2)).strftime('%Y-%m-%d') # 2 years
    
    df, error = load_historical_data_cached(ticker, start_date, end_date)
    if error:
        raise HTTPException(status_code=404, detail=error)
    
    series = extract_close_series(df)
    
    if len(series) < 100:
        raise HTTPException(status_code=400, detail="Not enough data (need > 100 days)")
        
    log_prices = np.log(series.values)
    x = np.arange(len(series))
    
    coeffs = np.polyfit(x, log_prices, 1)
    trend_line = np.polyval(coeffs, x)
    
    residuals = log_prices - trend_line
    std_residual = np.std(residuals)
    
    upper = np.exp(trend_line + 2 * std_residual)
    middle = np.exp(trend_line)
    lower = np.exp(trend_line - 2 * std_residual)
    
    current_price = series.iloc[-1]
    band_pos = ((current_price - lower[-1]) / (upper[-1] - lower[-1])) * 100
    
    return {
        "ticker": ticker,
        "current_price": float(current_price),
        "band_position": float(band_pos),
        "trend_upper": float(upper[-1]),
        "trend_lower": float(lower[-1]),
        "dates": series.index.strftime('%Y-%m-%d').tolist(),
        "prices": series.values.tolist(),
        "trend_middle_history": middle.tolist()
    }

# --- API Endpoints ---

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Twoziq Finance API", "version": "1.0.0"}

@app.get("/api/simulation/{ticker}")
def get_simulation(ticker: str, days: int = 252):
    """Run Monte Carlo simulation."""
    return run_simulation_logic(ticker, days)

@app.get("/api/quant/{ticker}")
def get_quant_analysis(ticker: str, lookback: int = 252):
    """Get Quant stats (Percentile, Z-Score)."""
    return run_quant_logic(ticker, lookback)

@app.get("/api/trend/{ticker}")
def get_trend_analysis(ticker: str):
    """Get Log-Linear Trend analysis."""
    return run_trend_logic(ticker)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
