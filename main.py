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
        try:
            info = yf.Ticker(t).info
            m = info.get('marketCap', 0)
            p = info.get('trailingPE', 0)
            if m and p:
                e = m / p
                total_mkt_cap += m
                total_earn += e
                details.append({"ticker": t, "pe": p, "market_cap": m})
        except: continue
    if total_earn == 0: raise HTTPException(status_code=500)
    return {"weighted_pe": total_mkt_cap / total_earn, "details": details}

@app.get("/api/market/per-history")
def get_per_history(period: str = "2y"):
    data_dict = {}
    for t in TOP_8:
        series = get_data(t, period=period)
        if series is not None: data_dict[t] = series
    df = pd.DataFrame(data_dict).dropna()
    weights = {t: yf.Ticker(t).info.get('marketCap', 1) for t in TOP_8}
    total_weight = sum(weights.values())
    df['weighted_price'] = sum(df[t] * (weights[t]/total_weight) for t in TOP_8)
    return {"dates": df.index.strftime('%Y-%m-%d').tolist(), "values": df['weighted_price'].tolist()}

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
    # 1. Fetch 17 years to get 16 years of 252-day periods
    start_date = (datetime.now() - timedelta(days=365*17)).strftime('%Y-%m-%d')
    full_series = get_data(ticker, start=start_date)
    if full_series is None or len(full_series) < 252: raise HTTPException(status_code=404)
    
    first_date = full_series.index[0].strftime('%Y-%m-%d')
    
    # 2. Calculate Rolling 252-day Returns (Probability Distribution)
    # Return = (Price at T+252 / Price at T) - 1
    rolling_returns = []
    all_paths = []
    
    for i in range(len(full_series) - 252):
        segment = full_series.iloc[i : i + 252]
        ret = (segment.iloc[-1] / segment.iloc[0]) - 1
        rolling_returns.append(ret * 100)
        # Normalize path to 100 for Average Path calculation
        all_paths.append((segment.values / segment.iloc[0]) * 100)
        
    avg_return_1y = np.mean(rolling_returns)
    std_return_1y = np.std(rolling_returns)
    
    # 3. Calculate Average Historical Path (Typical 1-year movement)
    avg_path = np.mean(all_paths, axis=0).tolist()
    
    # 4. Recent Actual 1-year Path (Last 252 days, normalized to 100)
    recent_segment = full_series.tail(252)
    recent_actual_path = ((recent_segment.values / recent_segment.iloc[0]) * 100).tolist()
    
    # 5. Trend (Log-Linear) on Full Period
    x = np.arange(len(full_series))
    log_p = np.log(full_series.values)
    slope, intercept = np.polyfit(x, log_p, 1)
    line = np.exp(slope * x + intercept)
    std_resid = np.std(log_p - np.log(line))
    
    # Histogram for 1-year returns
    hist_counts, bin_edges = np.histogram(rolling_returns, bins=60)
    
    return {
        "ticker": ticker,
        "first_date": first_date,
        "invested_days": len(full_series),
        "avg_1y_return": float(avg_return_1y),
        "trend": {
            "dates": full_series.index.strftime('%Y-%m-%d').tolist(),
            "prices": full_series.values.tolist(),
            "middle": line.tolist(),
            "upper": (line * np.exp(2 * std_resid)).tolist(),
            "lower": (line * np.exp(-2 * std_resid)).tolist()
        },
        "quant": {
            "mean": float(avg_return_1y),
            "std": float(std_return_1y),
            "current_z": float((rolling_returns[-1] - avg_return_1y) / std_return_1y) if std_return_1y > 0 else 0,
            "bins": bin_edges[:-1].tolist(),
            "counts": hist_counts.tolist()
        },
        "simulation": {
            "p50": avg_path,
            "actual_past": recent_actual_path,
            "samples": [] # No longer needed for this view
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)