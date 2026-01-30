from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import pytz
from functools import lru_cache
from typing import List, Dict, Optional, Any

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

@lru_cache(maxsize=128)
def get_historical_data(ticker: str, period: str = "2y", start: str = None, end: str = None):
    try:
        if start and end:
            df = yf.download(ticker, start=start, end=end, progress=False)
        else:
            df = yf.download(ticker, period=period, progress=False)
            
        if df.empty: return None
        if isinstance(df.columns, pd.MultiIndex):
            return df['Close'].iloc[:, 0] if 'Close' in df.columns else df.iloc[:, 0]
        return df['Close'] if 'Close' in df.columns else df.iloc[:, 0]
    except:
        return None

def get_info_cached(ticker_symbol: str):
    try: return yf.Ticker(ticker_symbol).info
    except: return {}

# --- Endpoints ---

@app.get("/api/market/valuation")
def get_market_valuation():
    total_market_cap = 0
    total_earnings = 0
    details = []
    for ticker in TOP_8_TICKERS:
        info = get_info_cached(ticker)
        mkt_cap = info.get('marketCap', 0)
        pe = info.get('trailingPE', 0)
        if mkt_cap and pe:
            earnings = mkt_cap / pe
            total_market_cap += mkt_cap
            total_earnings += earnings
            details.append({"ticker": ticker, "pe": pe, "market_cap": mkt_cap, "earnings": earnings})
    if total_earnings == 0: raise HTTPException(status_code=500)
    return {"weighted_pe": total_market_cap / total_earnings, "total_market_cap": total_market_cap, "details": sorted(details, key=lambda x: x['market_cap'], reverse=True)}

@app.get("/api/dca")
def run_dca_simulation(ticker: str, start_date: str, end_date: str, amount: float, frequency: str = "monthly"):
    series = get_historical_data(ticker, start=start_date, end=end_date)
    if series is None or series.empty: raise HTTPException(status_code=404)
    
    total_invested = 0
    total_shares = 0
    dates, invested_curve, valuation_curve = [], [], []
    
    # Frequency mapping
    freq_map = {"daily": "D", "weekly": "W-MON", "monthly": "MS"}
    buy_dates = pd.date_index(start=start_date, end=end_date, freq=freq_map.get(frequency, "MS"))
    buy_dates_str = [d.strftime('%Y-%m-%d') for d in buy_dates]
    
    last_buy_date = ""
    for date, price in series.items():
        curr_date_str = date.strftime('%Y-%m-%d')
        # Simple buy logic: if today is a scheduled buy date or the first available day after it
        if any(d <= curr_date_str for d in buy_dates_str) and last_buy_date < max([d for d in buy_dates_str if d <= curr_date_str], default=""):
            total_shares += amount / price
            total_invested += amount
            last_buy_date = max([d for d in buy_dates_str if d <= curr_date_str])
            
        dates.append(curr_date_str)
        invested_curve.append(total_invested)
        valuation_curve.append(total_shares * price)
        
    return {"ticker": ticker, "total_invested": total_invested, "final_value": valuation_curve[-1], "return_pct": ((valuation_curve[-1]-total_invested)/total_invested*100), "dates": dates, "invested_curve": invested_curve, "valuation_curve": valuation_curve}

@app.get("/api/risk-return")
def get_risk_return_map(tickers: str):
    # Support space or comma
    ticker_list = [t.strip().upper() for t in tickers.replace(' ', ',').split(',') if t.strip()]
    result = []
    for t in ticker_list:
        series = get_historical_data(t, period="1y")
        if series is None or len(series) < 50: continue
        rets = series.pct_change().dropna()
        result.append({"ticker": t, "return": float(rets.mean()*252*100), "risk": float(rets.std()*np.sqrt(252)*100)})
    return result

@app.get("/api/deep-analysis/{ticker}")
def get_deep_analysis(ticker: str, analysis_start: str = None, analysis_end: str = None):
    series = get_historical_data(ticker, period="5y")
    if series is None or len(series) < 50: raise HTTPException(status_code=404)
    
    # Analysis range slicing
    if analysis_start and analysis_end:
        analysis_series = series[analysis_start:analysis_end]
    else:
        analysis_series = series[-504:] # Default 2y
        
    if analysis_series.empty: analysis_series = series[-252:]

    curr_price = float(analysis_series.iloc[-1])
    
    # 1. Trend (Log-Linear)
    x = np.arange(len(analysis_series))
    log_p = np.log(analysis_series.values)
    slope, intercept = np.polyfit(x, log_p, 1)
    line = np.exp(slope * x + intercept)
    std = np.std(log_p - np.log(line))
    
    # 2. Simulation (Monte Carlo logic renamed)
    rets = analysis_series.pct_change().dropna()
    log_rets = np.log(1 + rets)
    drift = log_rets.mean() - 0.5 * log_rets.var()
    vol = log_rets.std()
    
    days = 120
    iters = 100
    paths = np.zeros((days, iters))
    paths[0] = curr_price
    for t in range(1, days):
        paths[t] = paths[t-1] * np.exp(drift + vol * np.random.normal(0, 1, iters))
    
    # Return samples for gray lines (first 10 paths)
    samples = paths[:, :10].T.tolist()
    
    return {
        "ticker": ticker,
        "current_price": curr_price,
        "current_return": float(analysis_series.pct_change(len(analysis_series)-1).iloc[-1]*100),
        "trend": {
            "dates": analysis_series.index.strftime('%Y-%m-%d').tolist(),
            "prices": analysis_series.values.tolist(),
            "middle": line.tolist(),
            "upper": (line * np.exp(2*std)).tolist(),
            "lower": (line * np.exp(-2*std)).tolist()
        },
        "quant": {
            "mean": float(rets.mean()*100),
            "std": float(rets.std()*100),
            "current_z": float((rets.iloc[-1]-rets.mean())/rets.std()),
            "z_history": ((analysis_series.pct_change()-rets.mean())/rets.std()).fillna(0).tail(60).tolist(),
            "z_dates": analysis_series.tail(60).index.strftime('%Y-%m-%d').tolist(),
            "bins": np.histogram(rets*100, bins=30)[1].tolist(),
            "counts": np.histogram(rets*100, bins=30)[0].tolist()
        },
        "simulation": {
            "p50": np.percentile(paths, 50, axis=1).tolist(),
            "samples": samples
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
