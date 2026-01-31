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

import json
import os
import time
from contextlib import asynccontextmanager

CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

def get_cached_data(filename: str, ttl_seconds: int = 3600):
    """Load data from JSON file if it exists and is fresh."""
    filepath = os.path.join(CACHE_DIR, filename)
    if not os.path.exists(filepath):
        return None
    
    try:
        # Check if file is older than TTL
        file_age = time.time() - os.path.getmtime(filepath)
        if file_age > ttl_seconds:
            return None # Expired
            
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Cache read error for {filename}: {e}")
        return None

def save_cached_data(filename: str, data: Any):
    """Save data to JSON file."""
    try:
        filepath = os.path.join(CACHE_DIR, filename)
        with open(filepath, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Cache write error for {filename}: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Warm up cache in background
    print("Server starting... Warming up cache...")
    try:
        # We trigger these but don't await them to block startup, 
        # or we can run a simple pre-fetch if acceptable. 
        # For simplicity in Cloud Run, we let the first request trigger or do a quick check.
        pass 
    except: pass
    yield
    # Shutdown logic if needed

app = FastAPI(title="Twoziq Finance API", lifespan=lifespan)

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
    # Try Cache First (1 Hour TTL)
    cached = get_cached_data("market_valuation.json", ttl_seconds=3600)
    if cached:
        print("Returning cached Market Valuation")
        return cached

    total_mkt_cap, total_earn = 0, 0
    details = []
    for t in TOP_8:
        try:
            dat = yf.Ticker(t)
            info = dat.info
            m = info.get('marketCap', 0)
            p = info.get('trailingPE') or info.get('forwardPE') or 25
            if m > 0 and p > 0:
                total_mkt_cap += m
                total_earn += m / p
                details.append({"ticker": t, "pe": p, "market_cap": m})
        except Exception as e:
            print(f"Error fetching valuation for {t}: {e}")
            continue
            
    result = {"weighted_pe": total_mkt_cap / total_earn if total_earn > 0 else 0, "details": details}
    save_cached_data("market_valuation.json", result)
    return result

@app.get("/api/market/per-history")
def get_per_history(period: str = "2y"):
    # Cache per period (12 Hour TTL for history)
    cache_key = f"per_history_{period}.json"
    cached = get_cached_data(cache_key, ttl_seconds=43200)
    if cached:
        print(f"Returning cached History for {period}")
        return cached

    data_dict = {}
    mkt_caps, pes = {}, {}
    
    # Bulk download is much faster
    try:
        bulk_data = yf.download(TOP_8, period=period, progress=False)
        if isinstance(bulk_data.columns, pd.MultiIndex):
            prices_df = bulk_data['Close']
        else:
            prices_df = pd.DataFrame({TOP_8[0]: bulk_data['Close']})
    except Exception as e:
        print(f"Bulk download failed: {e}")
        return {"dates": [], "values": []}

    for t in TOP_8:
        try:
            info = yf.Ticker(t).info
            mkt_caps[t] = info.get('marketCap', 1)
            pes[t] = info.get('trailingPE') or info.get('forwardPE') or 25
            if t in prices_df.columns:
                data_dict[t] = prices_df[t]
        except: continue
        
    if not data_dict: return {"dates": [], "values": []}
    df = pd.DataFrame(data_dict).ffill().bfill()
    total_mkt_cap = sum(mkt_caps.values())
    
    total_earnings = 0
    for t in pes:
        if pes[t] > 0:
            total_earnings += mkt_caps.get(t, 0) / pes[t]
            
    avg_pe = total_mkt_cap / total_earnings if total_earnings > 0 else 0
    
    weighted_idx = pd.Series(0.0, index=df.index)
    for t in data_dict:
        last_price = df[t].iloc[-1]
        if last_price > 0:
            weighted_idx += (df[t] / last_price) * (mkt_caps[t] / total_mkt_cap)
        
    result = {"dates": df.index.strftime('%Y-%m-%d').tolist(), "values": (weighted_idx * avg_pe).round(1).tolist()}
    save_cached_data(cache_key, result)
    return result

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
    prices_list = []
    
    for date, price in series.items():
        curr = date.strftime('%Y-%m-%d')
        prices_list.append(float(price))
        month = date.strftime('%Y-%m')
        should_buy = (frequency == "monthly" and month != last_buy_month) or (frequency != "monthly" and curr in buy_dates)
        
        if should_buy:
            total_shares += amount / price
            total_invested += amount
            last_buy_month = month
            
        dates.append(curr)
        invested_curve.append(float(total_invested))
        valuation_curve.append(float(total_shares * price))
        
    return {"ticker": ticker, "total_invested": total_invested, "final_value": valuation_curve[-1], "return_pct": ((valuation_curve[-1]-total_invested)/total_invested*100) if total_invested > 0 else 0, "dates": dates, "invested_curve": invested_curve, "valuation_curve": valuation_curve, "prices": prices_list}

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
        dat = yf.Ticker(ticker)
        # Try to get from metadata first (fastest)
        if hasattr(dat, 'history_metadata') and 'firstTradeDate' in dat.history_metadata:
            ts = dat.history_metadata['firstTradeDate']
            return datetime.fromtimestamp(ts, tz=KST).strftime('%Y-%m-%d')
        
        # Fallback: Still use period="max" but it's the only way if metadata is missing
        hist = dat.history(period="max")
        if not hist.empty:
            return hist.index[0].strftime('%Y-%m-%d')
    except Exception as e:
        print(f"Error getting listing date for {ticker}: {e}")
    return "Unknown"

def safe_float(val):
    try:
        if val is None: return 0.0
        f = float(val)
        if np.isnan(f) or np.isinf(f): return 0.0
        return f
    except: return 0.0

def clean_data(data):
    if isinstance(data, list):
        return [clean_data(x) for x in data]
    elif isinstance(data, dict):
        return {k: clean_data(v) for k, v in data.items()}
    elif isinstance(data, (float, np.floating, int, np.integer)):
        return safe_float(data)
    elif isinstance(data, np.ndarray):
        return clean_data(data.tolist())
    elif isinstance(data, pd.Series):
        return clean_data(data.tolist())
    return data

@app.get("/api/deep-analysis/{ticker}")
def get_deep_analysis(ticker: str, start_date: str = "2010-01-01", end_date: str = None, analysis_period: int = 252, forecast_days: int = 252):
    try:
        # ... (Previous code remains roughly same, but wrapped in try block) ...
        print(f"Deep Analysis Request: {ticker}, {start_date} ~ {end_date}")
        if not end_date: end_date = datetime.now().strftime('%Y-%m-%d')
        
        # 1. Fetch Data
        prices = get_data(ticker, start=start_date, end=end_date)
        
        if prices is None or prices.empty: 
            print("Data not found")
            raise HTTPException(status_code=404, detail=f"Data not found for {ticker}")
            
        prices = prices.ffill().dropna()
        # Ensure prices are positive for log calculations
        prices = prices.clip(lower=0.0001)
        price_vals = prices.values
        
        if len(price_vals) < 30:
             print("Data too short")
             raise HTTPException(status_code=400, detail="Not enough data history")

        # --- 2. Simulation (Monte Carlo) ---
        try:
            log_returns = np.log(price_vals[1:] / price_vals[:-1])
            mu = np.mean(log_returns)
            sigma = np.std(log_returns)
            
            num_simulations = 1000
            sim_days = int(forecast_days)
            last_price = price_vals[-1]
            
            random_shocks = np.random.normal(0, 1, (num_simulations, sim_days))
            brownian_motion = np.cumsum(random_shocks, axis=1)
            time_steps = np.arange(1, sim_days + 1)
            drift_component = (mu - 0.5 * sigma**2) * time_steps
            
            sim_paths = 100 * np.exp(drift_component + sigma * brownian_motion)
            sim_paths = np.hstack([np.full((num_simulations, 1), 100), sim_paths])
            
            p50_path = np.percentile(sim_paths, 50, axis=0).tolist()
            p95_path = np.percentile(sim_paths, 95, axis=0).tolist()
            p05_path = np.percentile(sim_paths, 5, axis=0).tolist()
            samples = sim_paths[:30].tolist()
        except Exception as e:
            print(f"Simulation Error: {e}")
            p50_path, p95_path, p05_path, samples = [], [], [], []

        # --- DCA vs Lump Sum Simulation (Past/Recent) ---
        try:
            if len(price_vals) > forecast_days:
                recent_prices = price_vals[-int(forecast_days):]
            else:
                recent_prices = price_vals
                
            lump_perf = (recent_prices / recent_prices[0] * 100).tolist()
            
            dca_shares = 0.0
            dca_cost = 0.0
            dca_perf = []
            for p in recent_prices:
                dca_shares += 1.0 / p 
                dca_cost += 1.0
                val = dca_shares * p
                ret = (val / dca_cost) * 100
                dca_perf.append(ret)
                
            savings_perf = [100.0] * len(recent_prices)
        except Exception as e:
            print(f"DCA Calc Error: {e}")
            lump_perf, dca_perf, savings_perf = [], [], []
        
        simulation_data = { 
            "p50": p50_path, 
            "upper": p95_path, 
            "lower": p05_path, 
            "actual_past": lump_perf, 
            "dca_perf": dca_perf,
            "savings_perf": savings_perf,
            "samples": samples 
        }

        # --- 3. Quant (Rolling) ---
        try:
            lookback = int(analysis_period)
            if len(price_vals) > lookback:
                rolling_rets = (price_vals[lookback:] / price_vals[:-lookback]) - 1
                rolling_rets_pct = rolling_rets * 100
                current_ret_pct = rolling_rets_pct[-1]
                mean_ret = np.mean(rolling_rets_pct)
                std_ret = np.std(rolling_rets_pct)
                
                if std_ret > 1e-6:
                    current_z = (current_ret_pct - mean_ret) / std_ret
                    z_history = ((rolling_rets_pct - mean_ret) / std_ret).tolist()
                else:
                    current_z = 0.0
                    z_history = [0.0] * len(rolling_rets_pct)
                    
                z_dates = prices.index[lookback:].strftime('%Y-%m-%d').tolist()
                hist_counts, hist_bins = np.histogram(rolling_rets_pct, bins=100)
            else:
                mean_ret, std_ret, current_z, current_ret_pct = 0, 0, 0, 0
                z_history, z_dates, hist_bins, hist_counts = [], [], [], []
        except Exception as e:
            print(f"Quant Error: {e}")
            mean_ret, std_ret, current_z, current_ret_pct = 0, 0, 0, 0
            z_history, z_dates, hist_bins, hist_counts = [], [], [], []

        # --- 4. Trend ---
        try:
            x = np.arange(len(price_vals))
            # Handle potential log(0) or log(negative)
            safe_prices = np.maximum(price_vals, 1e-4)
            slope, intercept = np.polyfit(x, np.log(safe_prices), 1)
            trend_line = np.exp(slope * x + intercept)
            std_resid = np.std(np.log(safe_prices) - np.log(trend_line))
            
            trend_dates = prices.index.strftime('%Y-%m-%d').tolist()
            trend_prices = price_vals.tolist()
            trend_middle = trend_line.tolist()
            trend_upper = (trend_line * np.exp(2*std_resid)).tolist()
            trend_lower = (trend_line * np.exp(-2*std_resid)).tolist()
        except Exception as e:
            print(f"Trend Error: {e}")
            trend_dates, trend_prices, trend_middle, trend_upper, trend_lower = [], [], [], [], []
        
        # Safe Listing Date Fetch
        listing_date = "Unknown"
        try:
            listing_date = get_listing_date(ticker)
        except Exception as e:
            print(f"Listing Date Error: {e}")
            listing_date = prices.index[0].strftime('%Y-%m-%d') # Fallback
        
        response_payload = {
            "ticker": ticker, 
            "first_date": listing_date,
            "current_price": float(price_vals[-1]),
            "invested_days": len(price_vals),
            "avg_1y_return": float(mean_ret),
            "current_1y_return": float(current_ret_pct),
            "trend": {
                "dates": trend_dates, 
                "prices": trend_prices,
                "middle": trend_middle, 
                "upper": trend_upper, 
                "lower": trend_lower
            },
            "quant": {
                "mean": float(mean_ret), 
                "std": float(std_ret), 
                "current_z": float(current_z),
                "z_history": z_history,
                "z_dates": z_dates,
                "bins": hist_bins[:-1].tolist() if len(hist_bins) > 0 else [], 
                "counts": hist_counts.tolist()
            },
            "simulation": simulation_data
        }
        
        return clean_data(response_payload)
        
    except Exception as e:
        print(f"CRITICAL Error in get_deep_analysis: {e}")
        import traceback
        err_msg = traceback.format_exc()
        print(err_msg)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}\n\nTraceback:\n{err_msg}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)