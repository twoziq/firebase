from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
import pytz
from functools import lru_cache
from typing import List, Dict, Optional

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
def get_data(ticker: str, period: str = "max", start: str = None, end: str = None):
    try:
        df = yf.download(ticker, period=period, start=start, end=end, progress=False)
        if df.empty: return None
        if isinstance(df.columns, pd.MultiIndex):
            return df['Close'].iloc[:, 0] if 'Close' in df.columns else df.iloc[:, 0]
        return df['Close'] if 'Close' in df.columns else df.iloc[:, 0]
    except: return None

@app.get("/api/market/valuation")
def get_market_valuation():
    total_mkt_cap, total_earn = 0, 0
    details = []
    for t in TOP_8:
        info = yf.Ticker(t).info
        m = info.get('marketCap', 0)
        p = info.get('trailingPE', 0)
        if m and p:
            e = m / p
            total_mkt_cap += m
            total_earn += e
            details.append({"ticker": t, "pe": p, "market_cap": m})
    return {"weighted_pe": total_mkt_cap / total_earn, "details": details}

@app.get("/api/market/per-history")
def get_per_history(period: str = "2y"):
    """Calculate historical weighted PER for Top 8"""
    data_dict = {}
    for t in TOP_8:
        series = get_data(t, period=period)
        if series is not None:
            data_dict[t] = series
            
    df = pd.DataFrame(data_dict).dropna()
    # Simplified historical PER: assume current earnings for history (approximation)
    # For real historical PE, we'd need quarterly earnings data which is complex via yf
    # We'll use Price / Current Earnings as a trend indicator
    weights = {t: yf.Ticker(t).info.get('marketCap', 1) for t in TOP_8}
    total_weight = sum(weights.values())
    
    # Just calculate a price index of top 8 as a proxy for valuation trend
    df['weighted_price'] = sum(df[t] * (weights[t]/total_weight) for t in TOP_8)
    
    return {
        "dates": df.index.strftime('%Y-%m-%d').tolist(),
        "values": df['weighted_price'].tolist() # This acts as a proxy for valuation trend
    }

@app.get("/api/dca")
def run_dca(ticker: str, start_date: str, end_date: str, amount: float, frequency: str = "monthly"):
    series = get_data(ticker, start=start_date, end=end_date)
    if series is None or series.empty: raise HTTPException(status_code=404)
    total_invested, total_shares = 0, 0
    dates, invested_curve, valuation_curve = [], [], []
    freq_map = {"daily": "D", "weekly": "W-MON", "monthly": "MS"}
    buy_dates = pd.date_range(start=start_date, end=end_date, freq=freq_map.get(frequency, "MS")).strftime('%Y-%m-%d').tolist()
    last_buy = ""
    for date, price in series.items():
        curr = date.strftime('%Y-%m-%d')
        if any(d <= curr for d in buy_dates) and last_buy < max([d for d in buy_dates if d <= curr], default=""):
            total_shares += amount / price
            total_invested += amount
            last_buy = max([d for d in buy_dates if d <= curr])
        dates.append(curr)
        invested_curve.append(total_invested)
        valuation_curve.append(total_shares * price)
    return {"ticker": ticker, "total_invested": total_invested, "final_value": valuation_curve[-1], "return_pct": ((valuation_curve[-1]-total_invested)/total_invested*100), "dates": dates, "invested_curve": invested_curve, "valuation_curve": valuation_curve}

@app.get("/api/risk-return")
def get_risk_return(tickers: str):
    ticker_list = [t.strip().upper() for t in tickers.replace(' ', ',').split(',') if t.strip()]
    result = []
    for t in ticker_list:
        series = get_data(t, period="1y")
        if series is None or len(series) < 50: continue
        rets = series.pct_change().dropna()
        result.append({"ticker": t, "return": round(float(rets.mean()*252*100), 1), "risk": round(float(rets.std()*np.sqrt(252)*100), 1)})
    return result

@app.get("/api/deep-analysis/{ticker}")
def get_deep_analysis(ticker: str):
    # Fixed Start: 2011-01-01
    start_date = "2011-01-01"
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    # Get Max data to find the first date
    full_series = get_data(ticker, period="max")
    if full_series is None: raise HTTPException(status_code=404)
    first_date = full_series.index[0].strftime('%Y-%m-%d')
    
    # Sliced data from 2011
    series = full_series[full_series.index >= pd.Timestamp(start_date)]
    if len(series) < 10: series = full_series # Fallback if 2011 is too far
    
    curr_price = float(series.iloc[-1])
    # Analysis period: last 252 days
    analysis_series = series.tail(252)
    
    x = np.arange(len(series))
    log_p = np.log(series.values)
    slope, intercept = np.polyfit(x, log_p, 1)
    line = np.exp(slope * x + intercept)
    std = np.std(log_p - np.log(line))
    
    rets = analysis_series.pct_change().dropna()
    log_rets = np.log(1 + rets)
    drift = log_rets.mean() - 0.5 * log_rets.var()
    vol = log_rets.std()
    
    sim_days = 120
    iters = 50
    paths = np.zeros((sim_days, iters))
    paths[0] = curr_price
    for t in range(1, sim_days):
        paths[t] = paths[t-1] * np.exp(drift + vol * np.random.normal(0, 1, iters))
    
    return {
        "ticker": ticker,
        "first_date": first_date,
        "current_price": curr_price,
        "invested_days": len(series),
        "trend": {
            "dates": series.index.strftime('%Y-%m-%d').tolist(),
            "prices": series.values.tolist(),
            "middle": line.tolist(),
            "upper": (line * np.exp(2*std)).tolist(),
            "lower": (line * np.exp(-2*std)).tolist()
        },
        "quant": {
            "mean": float(rets.mean()*100),
            "std": float(rets.std()*100),
            "current_z": float((rets.iloc[-1]-rets.mean())/rets.std()) if len(rets)>0 else 0,
            "z_history": ((series.pct_change()-rets.mean())/rets.std()).fillna(0).tail(100).tolist(),
            "z_dates": series.tail(100).index.strftime('%Y-%m-%d').tolist(),
            "bins": np.histogram(rets*100, bins=30)[1].tolist() if len(rets)>0 else [],
            "counts": np.histogram(rets*100, bins=30)[0].tolist() if len(rets)>0 else []
        },
        "simulation": {
            "p50": np.percentile(paths, 50, axis=1).tolist(),
            "samples": paths[:, :10].T.tolist(),
            "actual_past": series.tail(120).values.tolist()
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
