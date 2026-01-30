from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pytz
from functools import lru_cache
import time
from typing import List, Dict, Optional, Any

app = FastAPI(title="Twoziq Finance API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KST = pytz.timezone('Asia/Seoul')
TOP_8 = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO']

@lru_cache(maxsize=128)
def get_data(ticker: str, start: str = None, end: str = None):
    try:
        df = yf.download(ticker, start=start, end=end, progress=False)
        if df.empty: return None
        return df['Close'].iloc[:, 0] if isinstance(df.columns, pd.MultiIndex) else df['Close']
    except: return None

@app.get("/api/market/valuation")
def get_market_valuation():
    total_mkt_cap, total_earn = 0, 0
    details = []
    for t in TOP_8:
        try:
            info = yf.Ticker(t).info
            m = info.get('marketCap', 0)
            p = info.get('trailingPE') or info.get('forwardPE', 30)
            if m > 0:
                total_mkt_cap += m
                total_earn += m / p
                details.append({"ticker": t, "pe": p, "market_cap": m})
        except: continue
    return {"weighted_pe": total_mkt_cap / total_earn if total_earn > 0 else 0, "details": details}

@app.get("/api/market/per-history")
def get_per_history(period: str = "2y"):
    data_dict = {}
    mkt_caps = {}
    pes = {}
    for t in TOP_8:
        try:
            info = yf.Ticker(t).info
            mkt_caps[t] = info.get('marketCap', 1)
            pes[t] = info.get('trailingPE') or info.get('forwardPE', 30)
            series = yf.download(t, period=period, progress=False)
            if not series.empty:
                data_dict[t] = series['Close'].iloc[:, 0] if isinstance(series.columns, pd.MultiIndex) else series['Close']
        except: continue
    if not data_dict: return {"dates": [], "values": []}
    df = pd.DataFrame(data_dict).ffill().bfill()
    total_mkt_cap = sum(mkt_caps.values())
    weighted_idx = pd.Series(0.0, index=df.index)
    for t in data_dict:
        weighted_idx += (df[t] / df[t].iloc[-1]) * (mkt_caps[t] / total_mkt_cap)
    avg_pe = sum(pes[t] * mkt_caps[t] for t in pes) / total_mkt_cap
    return {"dates": df.index.strftime('%Y-%m-%d').tolist(), "values": (weighted_idx * avg_pe).round(1).tolist()}

@app.get("/api/risk-return")
def get_risk_return(tickers: str):
    ticker_list = [t.strip().upper() for t in tickers.replace(' ', ',').split(',') if t.strip()]
    result = []
    for t in ticker_list:
        try:
            series = yf.download(t, period="1y", progress=False)
            if series.empty: continue
            price = series['Close'].iloc[:, 0] if isinstance(series.columns, pd.MultiIndex) else series['Close']
            rets = price.pct_change().dropna()
            result.append({"ticker": t, "return": round(float(rets.mean()*252*100), 1), "risk": round(float(rets.std()*np.sqrt(252)*100), 1)})
        except: continue
    return result

@app.get("/api/deep-analysis/{ticker}")
def get_deep_analysis(ticker: str, start_date: str = "2010-01-01", end_date: str = None, analysis_period: int = 252):
    if not end_date: end_date = datetime.now().strftime('%Y-%m-%d')
    fetch_start = (datetime.strptime(start_date, '%Y-%m-%d') - timedelta(days=analysis_period + 100)).strftime('%Y-%m-%d')
    
    df = yf.download(ticker, start=fetch_start, end=end_date, progress=False)
    if df.empty: raise HTTPException(status_code=404, detail="No data found")
    
    prices = df['Close'].iloc[:, 0] if isinstance(df.columns, pd.MultiIndex) else df['Close']
    prices = prices.ffill().dropna()
    
    if len(prices) < analysis_period: raise HTTPException(status_code=400, detail="Data too short")

    first_date = prices.index[0].strftime('%Y-%m-%d')
    price_vals = prices.values
    
    # Vectorized Rolling Returns
    rolling_rets = (price_vals[analysis_period:] / price_vals[:-analysis_period]) - 1
    rolling_rets_pct = rolling_rets * 100
    
    # Average Path Calculation (Optimized)
    num_windows = len(price_vals) - analysis_period
    step = max(1, num_windows // 500)
    paths = [price_vals[i : i + analysis_period] / price_vals[i] * 100 for i in range(0, num_windows, step)]
    
    avg_path = np.mean(paths, axis=0).tolist()
    recent_segment = price_vals[-analysis_period:]
    recent_actual_path = (recent_segment / recent_segment[0] * 100).tolist()
    
    # Trend
    x = np.arange(len(price_vals))
    log_p = np.log(price_vals)
    slope, intercept = np.polyfit(x, log_p, 1)
    line = np.exp(slope * x + intercept)
    std_resid = np.std(log_p - np.log(line))
    
    hist_counts, bin_edges = np.histogram(rolling_rets_pct, bins=100)
    
    return {
        "ticker": ticker, "first_date": first_date, "invested_days": len(prices),
        "avg_1y_return": float(np.mean(rolling_rets_pct)),
        "trend": {
            "dates": prices.index.strftime('%Y-%m-%d').tolist(),
            "prices": price_vals.tolist(),
            "middle": line.tolist(),
            "upper": (line * np.exp(2 * std_resid)).tolist(),
            "lower": (line * np.exp(-2 * std_resid)).tolist()
        },
        "quant": {
            "mean": float(np.mean(rolling_rets_pct)),
            "std": float(np.std(rolling_rets_pct)),
            "current_z": float((rolling_rets_pct[-1] - np.mean(rolling_rets_pct)) / np.std(rolling_rets_pct)) if len(rolling_rets_pct)>0 else 0,
            "z_history": ((prices.pct_change()-prices.pct_change().mean())/prices.pct_change().std()).fillna(0).tail(100).tolist(),
            "z_dates": prices.tail(100).index.strftime('%Y-%m-%d').tolist(),
            "bins": bin_edges[:-1].tolist(),
            "counts": hist_counts.tolist()
        },
        "simulation": { "p50": avg_path, "actual_past": recent_actual_path }
    }