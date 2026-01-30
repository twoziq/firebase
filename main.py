from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import pytz
from functools import lru_cache
from typing import List, Dict, Optional

app = FastAPI(title="Twoziq Finance API")

# CORS
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KST = pytz.timezone('Asia/Seoul')
TOP_8_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO']

def get_today_str():
    return datetime.now(KST).strftime('%Y-%m-%d')

# --- Helper Functions ---

@lru_cache(maxsize=128)
def get_historical_data(ticker: str, period: str = "2y"):
    """Fetch historical data with caching."""
    try:
        # yfinance download
        df = yf.download(ticker, period=period, progress=False)
        if df.empty:
            return None
        
        # Handle MultiIndex columns (common in new yfinance)
        if isinstance(df.columns, pd.MultiIndex):
            if 'Close' in df.columns:
                try:
                    return df['Close'].iloc[:, 0]
                except:
                    return df.iloc[:, 0]
        elif 'Close' in df.columns:
             return df['Close']
        else:
             return df.iloc[:, 0]
        
        return df['Close'] if 'Close' in df.columns else df.iloc[:, 0]
    except:
        return None

def get_info_cached(ticker_symbol: str):
    """Fetch ticker info with basic error handling."""
    try:
        return yf.Ticker(ticker_symbol).info
    except:
        return {}

# --- Core Logic ---

@app.get("/api/market/valuation")
def get_market_valuation():
    """
    Calculate Weighted PER for Top 8 Tech Stocks.
    Formula: Sum(Market Cap) / Sum(Net Income)
    Since Net Income = Market Cap / PE, we can derive it.
    """
    total_market_cap = 0
    total_earnings = 0
    details = []

    for ticker in TOP_8_TICKERS:
        info = get_info_cached(ticker)
        mkt_cap = info.get('marketCap', 0)
        trailing_pe = info.get('trailingPE', 0)
        
        if mkt_cap and trailing_pe:
            earnings = mkt_cap / trailing_pe
            total_market_cap += mkt_cap
            total_earnings += earnings
            
            details.append({
                "ticker": ticker,
                "pe": trailing_pe,
                "market_cap": mkt_cap,
                "earnings": earnings
            })
    
    if total_earnings == 0:
        raise HTTPException(status_code=500, detail="Failed to fetch market data")

    weighted_pe = total_market_cap / total_earnings

    return {
        "weighted_pe": weighted_pe,
        "total_market_cap": total_market_cap,
        "top_8_tickers": TOP_8_TICKERS,
        "details": sorted(details, key=lambda x: x['market_cap'], reverse=True)
    }

@app.get("/api/dca")
def run_dca_simulation(ticker: str, months: int = 36, monthly_amount: float = 1000):
    """
    Dollar Cost Averaging Simulator.
    Buys 'monthly_amount' worth of stock at the start of each month.
    """
    end_date = datetime.now(KST)
    start_date = end_date - relativedelta(months=months + 1) # Buffer
    
    series = get_historical_data(ticker, period=f"{int(months/12)+2}y")
    if series is None or series.empty:
        raise HTTPException(status_code=404, detail="Data not found")
        
    # Trim to start date
    series = series[series.index >= pd.Timestamp(start_date.date()).tz_localize(None)]
    
    total_invested = 0
    total_shares = 0
    history = []
    
    # Simulate monthly buys
    current_sim_date = start_date
    
    # We iterate through the actual price series to build a daily valuation chart
    invested_curve = []
    valuation_curve = []
    dates = []
    
    # Pre-calculate buy dates (1st of each month or closest)
    buy_dates = []
    temp_date = start_date
    while temp_date < end_date:
        buy_dates.append(temp_date.strftime('%Y-%m'))
        temp_date += relativedelta(months=1)
        
    last_buy_month = ""
    
    for date, price in series.items():
        date_str = date.strftime('%Y-%m-%d')
        month_str = date.strftime('%Y-%m')
        
        # Buy logic: if new month and haven't bought yet this month
        if month_str in buy_dates and month_str != last_buy_month:
            shares_bought = monthly_amount / price
            total_shares += shares_bought
            total_invested += monthly_amount
            last_buy_month = month_str
            
        current_value = total_shares * price
        
        dates.append(date_str)
        invested_curve.append(total_invested)
        valuation_curve.append(current_value)

    final_return = ((valuation_curve[-1] - invested_curve[-1]) / invested_curve[-1]) * 100 if invested_curve[-1] > 0 else 0
    
    return {
        "ticker": ticker,
        "total_invested": total_invested,
        "final_value": valuation_curve[-1],
        "return_pct": final_return,
        "dates": dates,
        "invested_curve": invested_curve,
        "valuation_curve": valuation_curve
    }

@app.get("/api/risk-return")
def get_risk_return_map(tickers: str):
    """
    Calculate Annualized Return vs Annualized Volatility (Risk) for a list of tickers (1 Year).
    Input: comma separated tickers (e.g. "AAPL,TSLA,NVDA")
    """
    ticker_list = [t.strip().upper() for t in tickers.split(',')]
    result = []
    
    for t in ticker_list:
        series = get_historical_data(t, period="1y")
        if series is None or len(series) < 200:
            continue
            
        # Daily returns
        daily_ret = series.pct_change().dropna()
        
        # Annualize
        ann_return = daily_ret.mean() * 252 * 100
        ann_volatility = daily_ret.std() * np.sqrt(252) * 100
        
        result.append({
            "ticker": t,
            "return": ann_return,
            "risk": ann_volatility,
            "current_price": float(series.iloc[-1])
        })
        
    return result

@app.get("/api/deep-analysis/{ticker}")
def get_deep_analysis(ticker: str):
    """
    Combined Deep Analysis:
    1. Trend (Log-Linear + Bands)
    2. Simulation (Monte Carlo)
    3. Quant Stats (Z-Score, Histograms)
    """
    # 1. Load Data (2 Years for Trend/Quant)
    series = get_historical_data(ticker, period="5y") # More data for better trend
    if series is None or len(series) < 100:
        raise HTTPException(status_code=404, detail="Not enough data")

    current_price = float(series.iloc[-1])
    
    # --- Logic A: Trend (Log-Linear) ---
    # Use last 2 years for trend fitting to be responsive but stable
    trend_series = series[-504:] 
    log_prices = np.log(trend_series.values)
    x = np.arange(len(trend_series))
    coeffs = np.polyfit(x, log_prices, 1)
    trend_line = np.polyval(coeffs, x)
    residuals = log_prices - trend_line
    std_residual = np.std(residuals)
    
    # Bands
    upper_band = np.exp(trend_line + 2 * std_residual)
    lower_band = np.exp(trend_line - 2 * std_residual)
    middle_line = np.exp(trend_line)
    
    # --- Logic B: Quant Stats ---
    returns_1y = series[-252:].pct_change().dropna()
    z_score_history = (returns_1y - returns_1y.mean()) / returns_1y.std()
    current_z = float(z_score_history.iloc[-1])
    
    # Histogram data (Return Distribution)
    hist_values, bin_edges = np.histogram(returns_1y.values * 100, bins=20)
    
    # --- Logic C: Monte Carlo (Future) ---
    # Parameters from last 1 year
    log_returns = np.log(1 + series[-252:].pct_change().dropna())
    drift = log_returns.mean() - (0.5 * log_returns.var())
    stdev = log_returns.std()
    
    days = 120 # 6 months projection
    iterations = 500
    
    daily_returns_sim = np.exp(drift + stdev * np.random.normal(0, 1, (days, iterations)))
    price_paths = np.zeros_like(daily_returns_sim)
    price_paths[0] = current_price
    for t in range(1, days):
        price_paths[t] = price_paths[t - 1] * daily_returns_sim[t]
        
    # Percentiles
    p95 = np.percentile(price_paths, 95, axis=1).tolist()
    p50 = np.percentile(price_paths, 50, axis=1).tolist()
    p05 = np.percentile(price_paths, 5, axis=1).tolist()
    
    return {
        "ticker": ticker,
        "current_price": current_price,
        "trend": {
            "dates": trend_series.index.strftime('%Y-%m-%d').tolist(),
            "prices": trend_series.values.tolist(),
            "upper": upper_band.tolist(),
            "middle": middle_line.tolist(),
            "lower": lower_band.tolist()
        },
        "quant": {
            "current_z": current_z,
            "z_history": z_score_history.tail(60).tolist(), # Last 60 days
            "z_dates": z_score_history.tail(60).index.strftime('%Y-%m-%d').tolist(),
            "distribution": {
                "bins": [float(b) for b in bin_edges[:-1]], # Start of bin
                "counts": hist_values.tolist()
            }
        },
        "simulation": {
            "days": days,
            "p95": p95,
            "p50": p50,
            "p05": p05
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)