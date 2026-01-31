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
import logging
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- In-Memory Logging Setup ---
SERVER_LOGS = deque(maxlen=200)

class ListHandler(logging.Handler):
    def emit(self, record):
        try:
            msg = self.format(record)
            SERVER_LOGS.append(msg)
        except Exception:
            self.handleError(record)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")
list_handler = ListHandler()
list_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(list_handler)
app_logger = logging.getLogger("twoziq")
app_logger.setLevel(logging.INFO)
app_logger.addHandler(list_handler)

app = FastAPI(title="Twoziq Finance API")

@app.get("/api/logs")
def get_server_logs():
    return {"logs": list(SERVER_LOGS)}

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
        app_logger.info(f"Fetching {ticker} from {start} to {end}")
        df = yf.download(ticker, start=start, end=end, progress=False)
        if not df.empty:
            return df['Close'].iloc[:, 0] if isinstance(df.columns, pd.MultiIndex) else df['Close']
    except Exception as e:
        app_logger.error(f"Failed for {ticker}: {e}")
    return None

@app.get("/api/market/valuation")
def get_market_valuation():
    total_mkt_cap, total_earn = 0, 0
    details = []
    
    def fetch_val(t):
        try:
            dat = yf.Ticker(t)
            info = dat.info or {}
            
            # Market Cap fallback: info -> fast_info
            mc = info.get('marketCap', 0)
            if not mc:
                try: mc = dat.fast_info['market_cap']
                except: mc = 0
            
            # Earnings (NI)
            ni = info.get('netIncomeToCommon')
            
            # PE fallback
            pe = info.get('trailingPE') or info.get('forwardPE') or 30
            
            return t, mc, ni, pe
        except Exception as e:
            app_logger.error(f"fetch_val error for {t}: {e}")
            return t, 0, None, 30

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_val, t) for t in TOP_8]
        for future in as_completed(futures):
            t, mc, ni, pe = future.result()
            if mc and mc > 0:
                total_mkt_cap += mc
                
                # Earnings logic: Use NI if valid, else derive from PE
                if ni is not None and ni > 0:
                    earn = ni
                else:
                    earn = mc / pe if pe and pe > 0 else 0
                
                total_earn += earn
                
                # Display PE
                display_pe = mc / earn if earn > 0 else pe
                details.append({"ticker": t, "pe": float(display_pe), "market_cap": float(mc)})
    
    weighted_pe = total_mkt_cap / total_earn if total_earn > 0 else 0
    return {"weighted_pe": weighted_pe, "details": details}

@app.get("/api/market/per-history")
def get_per_history(period: str = "2y"):
    # Reverted to Price-based Valuation Trend Logic (Reliable & Consistent) 
    
    # 1. Fetch Price History
    try:
        app_logger.info(f"Fetching history prices for {TOP_8} ({period})")
        bulk_data = yf.download(TOP_8, period=period, progress=False, threads=True)
        if bulk_data.empty: return {"dates": [], "values": []}
        
        if isinstance(bulk_data.columns, pd.MultiIndex):
            prices_df = bulk_data['Close']
        else:
            prices_df = pd.DataFrame({TOP_8[0]: bulk_data['Close']})
            
    except Exception as e:
        app_logger.error(f"Price fetch failed: {e}")
        return {"dates": [], "values": []}

    # 2. Fetch Current Fundamentals (Parallel)
    # Goal: Calculate EXACT Current Weighted PER
    mkt_caps = {}
    earnings_dict = {}
    
    def fetch_fund(t):
        try:
            tick = yf.Ticker(t)
            info = tick.info or {}
            
            mc = info.get('marketCap')
            if not mc:
                try: mc = tick.fast_info['market_cap']
                except: mc = 0
            
            # Use netIncomeToCommon (User verified source)
            ni = info.get('netIncomeToCommon')
            
            # Fallback
            pe = info.get('trailingPE') or info.get('forwardPE') or 30
            
            return t, mc, ni, pe
        except: return t, 0, None, 30

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_fund, t) for t in TOP_8]
        for future in as_completed(futures):
            t, mc, ni, pe = future.result()
            if mc and mc > 0:
                mkt_caps[t] = mc
                # Use NI if available, else derive
                if ni is not None and ni > 0:
                    earnings_dict[t] = ni
                else:
                    earnings_dict[t] = mc / pe if pe and pe > 0 else (mc / 30)

    # 3. Calculate Current Weighted PER
    total_mc = sum(mkt_caps.values())
    total_earn = sum(earnings_dict.values())
    
    current_weighted_pe = total_mc / total_earn if total_earn > 0 else 0
    app_logger.info(f"Current Weighted PE: {current_weighted_pe:.2f}")

    # 4. Construct Weighted Price Index (History)
    # We construct an index that starts from historical prices and lands on 1.0 (Current)
    # Then multiply by current_weighted_pe.
    
    # Fill missing prices
    df = prices_df.ffill().bfill().fillna(0)
    
    # Identify valid tickers (intersection of prices and fetched info)
    valid_tickers = [t for t in TOP_8 if t in df.columns and t in mkt_caps]
    if not valid_tickers: return {"dates": [], "values": []}
    
    # Calculate Weighted Index
    weighted_idx = pd.Series(0.0, index=df.index)
    
    for t in valid_tickers:
        last_valid_price = df[t].replace(0, np.nan).ffill().iloc[-1]
        current_price = last_valid_price if not np.isnan(last_valid_price) else 0
        
        if current_price > 0:
            # Weight based on Current Market Cap
            weight = mkt_caps[t] / total_mc
            # Price Trend (Normalized to 1.0 at end)
            price_trend = df[t] / current_price
            
            weighted_idx += price_trend.fillna(0) * weight
            
    # Final PER History = Index * Current PER
    # This ensures the last value matches 'current_weighted_pe' exactly.
    per_history = weighted_idx * current_weighted_pe
    
    return {
        "dates": per_history.index.strftime('%Y-%m-%d').tolist(), 
        "values": per_history.replace([np.inf, -np.inf], 0).fillna(0).round(1).tolist()
    }

# ... rest of API endpoints (dca, risk, deep, listing_date, safe_float, clean_data, main) ...

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
        if hasattr(dat, 'history_metadata') and 'firstTradeDate' in dat.history_metadata:
            ts = dat.history_metadata['firstTradeDate']
            return datetime.fromtimestamp(ts, tz=KST).strftime('%Y-%m-%d')
        hist = dat.history(period="max")
        if not hist.empty:
            return hist.index[0].strftime('%Y-%m-%d')
    except Exception as e:
        app_logger.error(f"Error getting listing date for {ticker}: {e}")
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
        app_logger.info(f"Deep Analysis Request: {ticker}, {start_date} ~ {end_date}")
        if not end_date: end_date = datetime.now().strftime('%Y-%m-%d')
        prices = get_data(ticker, start=start_date, end=end_date)
        if prices is None or prices.empty: 
            app_logger.warning("Data not found")
            raise HTTPException(status_code=404, detail=f"Data not found for {ticker}")
        prices = prices.ffill().dropna()
        prices = prices.clip(lower=0.0001)
        price_vals = prices.values
        if len(price_vals) < 30:
             app_logger.warning("Data too short")
             raise HTTPException(status_code=400, detail="Not enough data history")
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
            app_logger.error(f"Simulation Error: {e}")
            p50_path, p95_path, p05_path, samples = [], [], [], []
        try:
            # Align recent_prices with lookback period (252 days gap requires 253 prices)
            lookback = int(forecast_days)
            if len(price_vals) > lookback:
                recent_prices = price_vals[-(lookback + 1):]
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
            app_logger.error(f"DCA Calc Error: {e}")
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
        try:
            lookback = int(analysis_period)
            if len(price_vals) > lookback:
                # Calculate rolling returns: (Price_today / Price_N_days_ago) - 1
                # To match actual_past exactly, we use the same relative change
                rolling_rets = (price_vals[lookback:] / price_vals[:-lookback]) - 1
                rolling_rets_pct = rolling_rets * 100
                
                # current_1y_return MUST be the last value of actual_past scaled to %
                # which is (recent_prices[-1] / recent_prices[0] - 1) * 100
                current_ret_pct = ((price_vals[-1] / price_vals[-(lookback+1)]) - 1) * 100
                
                mean_ret = np.mean(rolling_rets_pct)
                std_ret = np.std(rolling_rets_pct)
                
                if std_ret > 1e-6:
                    current_z = (current_ret_pct - mean_ret) / std_ret
                    z_history = ((rolling_rets_pct - mean_ret) / std_ret).tolist()
                else:
                    current_z = 0.0
                    z_history = [0.0] * len(rolling_rets_pct)
                
                z_dates = prices.index[lookback:].strftime('%Y-%m-%d').tolist()
                
                # Use enough bins for smooth distribution
                counts, bins = np.histogram(rolling_rets_pct, bins=60)
                hist_counts = counts.tolist()
                hist_bins = ((bins[:-1] + bins[1:]) / 2).tolist()
            else:
                mean_ret, std_ret, current_z, current_ret_pct = 0, 0, 0, 0
                z_history, z_dates, hist_bins, hist_counts = [], [], [], []
        except Exception as e:
            app_logger.error(f"Quant Error: {e}")
            mean_ret, std_ret, current_z, current_ret_pct = 0, 0, 0, 0
            z_history, z_dates, hist_bins, hist_counts = [], [], [], []
        try:
            x = np.arange(len(price_vals))
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
            app_logger.error(f"Trend Error: {e}")
            trend_dates, trend_prices, trend_middle, trend_upper, trend_lower = [], [], [], [], []
        listing_date = "Unknown"
        try:
            listing_date = get_listing_date(ticker)
        except Exception as e:
            app_logger.error(f"Listing Date Error: {e}")
            listing_date = prices.index[0].strftime('%Y-%m-%d')
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
        app_logger.error(f"CRITICAL Error in get_deep_analysis: {e}")
        import traceback
        err_msg = traceback.format_exc()
        app_logger.error(err_msg)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}\n\nTraceback:\n{err_msg}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
