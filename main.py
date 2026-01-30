from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pytz
from functools import lru_cache
import random
from typing import List, Dict, Optional, Any

app = FastAPI(title="Twoziq Finance API")

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
    # 1차 시도: yf.download
    try:
        print(f"Attempt 1 (download): Fetching {ticker} from {start} to {end}")
        df = yf.download(ticker, start=start, end=end, progress=False)
        
        if not df.empty:
            return df['Close'].iloc[:, 0] if isinstance(df.columns, pd.MultiIndex) else df['Close']
    except Exception as e:
        print(f"Attempt 1 failed for {ticker}: {e}")

    # 2차 시도: yf.Ticker().history (Fallback)
    try:
        print(f"Attempt 2 (history): Fetching {ticker} via Ticker.history")
        dat = yf.Ticker(ticker)
        # start/end가 있으면 사용, 없으면 period="max"
        if start and end:
            df = dat.history(start=start, end=end)
        else:
            df = dat.history(period="max")
        
        if not df.empty:
            return df['Close']
    except Exception as e:
        print(f"Attempt 2 failed for {ticker}: {e}")

    print(f"All attempts failed for {ticker}")
    return None

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
    mkt_caps, pes = {}, {}
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
    
    # Calculate Total Earnings for the group to get a proper weighted PE
    total_earnings = 0
    for t in pes:
        if pes[t] > 0:
            total_earnings += mkt_caps[t] / pes[t]
            
    # True Market PE = Total Market Cap / Total Earnings
    avg_pe = total_mkt_cap / total_earnings if total_earnings > 0 else 0
    
    for t in data_dict:
        weighted_idx += (df[t] / df[t].iloc[-1]) * (mkt_caps[t] / total_mkt_cap)
        
    return {"dates": df.index.strftime('%Y-%m-%d').tolist(), "values": (weighted_idx * avg_pe).round(1).tolist()}

@app.get("/api/dca")
def run_dca(ticker: str, start_date: str, end_date: str, amount: float, frequency: str = "monthly"):
    series = get_data(ticker, start=start_date, end=end_date)
    if series is None or series.empty:
        raise HTTPException(status_code=404, detail=f"Price data for {ticker} not found.")
    
    total_invested, total_shares = 0, 0
    dates, invested_curve, valuation_curve = [], [], []
    freq_map = {"daily": "D", "weekly": "W-MON", "monthly": "MS"}
    buy_dates = set(pd.date_range(start=start_date, end=end_date, freq=freq_map.get(frequency, "MS")).strftime('%Y-%m-%d'))
    
    last_buy_month = ""
    for date, price in series.items():
        curr = date.strftime('%Y-%m-%d')
        month = date.strftime('%Y-%m')
        should_buy = (frequency == "monthly" and month != last_buy_month) or (frequency != "monthly" and curr in buy_dates)
        
        if should_buy:
            total_shares += amount / price
            total_invested += amount
            last_buy_month = month
            
        dates.append(curr)
        invested_curve.append(float(total_invested))
        valuation_curve.append(float(total_shares * price))
        
    return {"ticker": ticker, "total_invested": total_invested, "final_value": valuation_curve[-1], "return_pct": ((valuation_curve[-1]-total_invested)/total_invested*100) if total_invested > 0 else 0, "dates": dates, "invested_curve": invested_curve, "valuation_curve": valuation_curve}

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

@lru_cache(maxsize=128)
def get_listing_date(ticker: str):
    try:
        # Fetch max history metadata only (limit to 1 row if possible, but yf history metadata needs fetch)
        # Using history(period="max") is the reliable way to find start. 
        # To minimize data transfer, we can just check the index.
        dat = yf.Ticker(ticker)
        hist = dat.history(period="max")
        if not hist.empty:
            return hist.index[0].strftime('%Y-%m-%d')
    except:
        pass
    return "Unknown"

@app.get("/api/deep-analysis/{ticker}")
def get_deep_analysis(ticker: str, start_date: str = "2010-01-01", end_date: str = None, analysis_period: int = 252, forecast_days: int = 252):
    try:
        if not end_date: end_date = datetime.now().strftime('%Y-%m-%d')
        
        # 1. Fetch Data (Full History for Trend & DNA Extraction)
        # ... (rest of the code) ...
        
        prices = get_data(ticker, start=start_date, end=end_date)
        
        # ... (middle code) ...
        
        # True Listing Date (Max History Start)
        true_listing_date = get_listing_date(ticker)
        
        return {
            "ticker": ticker, 
            "first_date": true_listing_date, # Updated to return TRUE listing date
            
            # ... (rest of the return dict) ...
    except Exception as e:
        print(f"Error in get_deep_analysis: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    rolling_rets_pct = rolling_rets * 100
    num_windows = len(price_vals) - analysis_period
    step = max(1, num_windows // 500)
    
    all_paths = [price_vals[i : i + analysis_period] / price_vals[i] * 100 for i in range(0, num_windows, step)]
    avg_path = np.mean(all_paths, axis=0).tolist()
    std_path = np.std(all_paths, axis=0)
    
    # 30 random samples for background
    sample_indices = random.sample(range(len(all_paths)), min(30, len(all_paths)))
    samples = [all_paths[i].tolist() for i in sample_indices]
    
    recent_actual = (price_vals[-analysis_period:] / price_vals[-analysis_period][0] * 100).tolist()
    
    x = np.arange(len(price_vals))
    slope, intercept = np.polyfit(x, np.log(price_vals), 1)
    line = np.exp(slope * x + intercept)
    std_resid = np.std(np.log(price_vals) - np.log(line))
    
    return {
        "ticker": ticker, "first_date": prices.index[0].strftime('%Y-%m-%d'), "avg_1y_return": float(np.mean(rolling_rets_pct)),
        "current_1y_return": float(rolling_rets_pct[-1]),
        "trend": {
            "dates": prices.index.strftime('%Y-%m-%d').tolist(), "prices": price_vals.tolist(),
            "middle": line.tolist(), "upper": (line * np.exp(2*std_resid)).tolist(), "lower": (line * np.exp(-2*std_resid)).tolist()
        },
        "quant": {
            "mean": float(np.mean(rolling_rets_pct)), "std": float(np.std(rolling_rets_pct)), "current_z": float((rolling_rets_pct[-1] - np.mean(rolling_rets_pct)) / np.std(rolling_rets_pct)) if len(rolling_rets_pct)>0 else 0,
            "z_history": ((prices.pct_change()-prices.pct_change().mean())/prices.pct_change().std()).fillna(0).tail(100).tolist(),
            "z_dates": prices.tail(100).index.strftime('%Y-%m-%d').tolist(),
            "bins": np.histogram(rolling_rets_pct, bins=100)[1][:-1].tolist(), "counts": np.histogram(rolling_rets_pct, bins=100)[0].tolist()
        },
        "simulation": { "p50": avg_path, "upper": (np.array(avg_path) + 2*std_path).tolist(), "lower": (np.array(avg_path) - 2*std_path).tolist(), "actual_past": recent_actual, "samples": samples }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)