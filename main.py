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
        
        # 1. Fetch Data
        prices = get_data(ticker, start=start_date, end=end_date)
        
        if prices is None or prices.empty: 
            raise HTTPException(status_code=404, detail=f"Data not found for {ticker}")
            
        prices = prices.ffill().dropna()
        price_vals = prices.values
        
        if len(price_vals) < 30:
             raise HTTPException(status_code=400, detail="Not enough data history")

        # --- 2. Simulation (Monte Carlo) ---
        log_returns = np.log(price_vals[1:] / price_vals[:-1])
        mu = np.mean(log_returns)
        sigma = np.std(log_returns)
        
        num_simulations = 1000
        sim_days = forecast_days
        last_price = price_vals[-1]
        
        random_shocks = np.random.normal(0, 1, (num_simulations, sim_days))
        brownian_motion = np.cumsum(random_shocks, axis=1)
        time_steps = np.arange(1, sim_days + 1)
        drift_component = (mu - 0.5 * sigma**2) * time_steps
        
        sim_paths = 100 * np.exp(drift_component + sigma * brownian_motion) # Normalize start to 100
        sim_paths = np.hstack([np.full((num_simulations, 1), 100), sim_paths])
        
        p50_path = np.percentile(sim_paths, 50, axis=0).tolist()
        p95_path = np.percentile(sim_paths, 95, axis=0).tolist()
        p05_path = np.percentile(sim_paths, 5, axis=0).tolist()
        samples = sim_paths[:30].tolist()
        
        # --- DCA vs Lump Sum Simulation (Past/Recent) ---
        # Compare 3 strategies over the LAST 'forecast_days' (or period)
        if len(price_vals) > forecast_days:
            recent_prices = price_vals[-forecast_days:]
        else:
            recent_prices = price_vals
            
        # 1. Lump Sum (Actual Price): Start at 100
        lump_perf = (recent_prices / recent_prices[0] * 100).tolist()
        
        # 2. Savings (Cash Accumulation): Linear growth 0 -> 100% of capital?
        # User said: "Start point same for all three".
        # Interpretation: We are comparing the VALUE of portfolio.
        # Lump Sum: Starts with $100 -> Ends with $100 * (P_end/P_start).
        # Savings: Starts with $100? No, "Daily invested amount".
        # If "Daily Invested Amount" is Green Dotted, it implies ACCUMULATION.
        # But if we compare Accumulation vs Lump Sum, the scales are different (0->100 vs 100->?).
        # User said: "Start point same for all three".
        # This implies we are comparing 3 scenarios starting with SAME capital $C.
        # A) Lump Sum: Put $C at start.
        # B) Savings: Put $C in safe asset (0% interest). Value stays $C.
        # C) DCA: This is usually "Income stream". But if we must compare with Lump Sum...
        # Maybe user means: "Value of $1 invested daily" (DCA) vs "Value of $N invested at start" (Lump Sum).
        # Let's try to interpret "Green dotted = Daily invested amount" literally.
        # It means the cost basis line for DCA.
        # If we normalize everything to "Total Invested = 100" at the END?
        # Or "Start = 100"?
        # Let's assume standard "Growth of $100" chart for Lump Sum.
        # For DCA, let's show the growth of a DCA portfolio that reached same total investment? No.
        
        # Let's provide the raw relative series for:
        # 1. Price (Lump Sum) -> Index 100
        # 2. DCA Value -> If we invested $1 daily, what is value? Scale it so it starts at 100? No, DCA starts at 0.
        # User said: "Start point same for all three".
        # This is the key constraint.
        # If DCA starts at 100, it means we have $100 and we drip feed it? (Reverse DCA / PCA).
        # Or maybe it's just "Price" vs "Average Cost"?
        
        # Let's implement what makes most sense visually for "Start same":
        # All lines start at 100.
        # 1. Lump Sum: Track Price.
        # 2. Savings: Flat line at 100 (Cash held).
        # 3. DCA: This is hard. DCA return is usually lower volatility.
        # Let's calculate DCA Return Index: (Current Value / Total Invested) * 100.
        # This starts at 100 (1st purchase value / 1st purchase cost = 1 = 100).
        # And evolves. This allows comparing "Efficiency" of DCA vs Lump Sum vs Cash(100).
        
        dca_shares = 0
        dca_cost = 0
        dca_perf = []
        for p in recent_prices:
            dca_shares += 1 / p # Invest $1
            dca_cost += 1
            val = dca_shares * p
            ret = (val / dca_cost) * 100
            dca_perf.append(ret)
            
        savings_perf = [100.0] * len(recent_prices)
        
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
        lookback = analysis_period
        if len(price_vals) > lookback:
            rolling_rets = (price_vals[lookback:] / price_vals[:-lookback]) - 1
            rolling_rets_pct = rolling_rets * 100
            current_ret_pct = rolling_rets_pct[-1]
            mean_ret = np.mean(rolling_rets_pct)
            std_ret = np.std(rolling_rets_pct)
            current_z = (current_ret_pct - mean_ret) / std_ret if std_ret > 0 else 0
            z_history = ((rolling_rets_pct - mean_ret) / std_ret).tolist()
            z_dates = prices.index[lookback:].strftime('%Y-%m-%d').tolist()
            hist_counts, hist_bins = np.histogram(rolling_rets_pct, bins=100)
        else:
            mean_ret, std_ret, current_z, current_ret_pct = 0, 0, 0, 0
            z_history, z_dates, hist_bins, hist_counts = [], [], [], []

        # --- 4. Trend ---
        x = np.arange(len(price_vals))
        slope, intercept = np.polyfit(x, np.log(price_vals), 1)
        trend_line = np.exp(slope * x + intercept)
        std_resid = np.std(np.log(price_vals) - np.log(trend_line))
        
        return {
            "ticker": ticker, 
            "first_date": get_listing_date(ticker),
            "avg_1y_return": float(mean_ret),
            "current_1y_return": float(current_ret_pct),
            "trend": {
                "dates": prices.index.strftime('%Y-%m-%d').tolist(), 
                "prices": price_vals.tolist(),
                "middle": trend_line.tolist(), 
                "upper": (trend_line * np.exp(2*std_resid)).tolist(), 
                "lower": (trend_line * np.exp(-2*std_resid)).tolist()
            },
            "quant": {
                "mean": float(mean_ret), 
                "std": float(std_ret), 
                "current_z": float(current_z),
                "z_history": z_history,
                "z_dates": z_dates,
                "bins": hist_bins[:-1].tolist(), 
                "counts": hist_counts.tolist()
            },
            "simulation": simulation_data
        }
    except Exception as e:
        print(f"Error in get_deep_analysis: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)