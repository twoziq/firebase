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

# --- Endpoints ---

@app.get("/api/market/valuation")
def get_market_valuation():
    total_mkt_cap, total_earn = 0, 0
    details = []
    for ticker in TOP_8_TICKERS:
        try:
            info = yf.Ticker(ticker).info
            mkt_cap = info.get('marketCap', 0)
            pe = info.get('trailingPE', 0)
            if mkt_cap and pe:
                earn = mkt_cap / pe
                total_mkt_cap += mkt_cap
                total_earn += earn
                details.append({"ticker": ticker, "pe": pe, "market_cap": mkt_cap, "earnings": earn})
        except: continue
    if total_earn == 0: raise HTTPException(status_code=500)
    return {"weighted_pe": total_mkt_cap / total_earn, "total_market_cap": total_mkt_cap, "details": sorted(details, key=lambda x: x['market_cap'], reverse=True)}

@app.get("/api/dca")
def run_dca_simulation(ticker: str, start_date: str, end_date: str, amount: float, frequency: str = "monthly"):
    series = get_historical_data(ticker, start=start_date, end=end_date)
    if series is None or series.empty: raise HTTPException(status_code=404)
    total_invested, total_shares = 0, 0
    dates, invested_curve, valuation_curve = [], [], []
    freq_map = {"daily": "D", "weekly": "W-MON", "monthly": "MS"}
    buy_dates = pd.date_range(start=start_date, end=end_date, freq=freq_map.get(frequency, "MS"))
    buy_dates_str = [d.strftime('%Y-%m-%d') for d in buy_dates]
    last_buy = ""
    for date, price in series.items():
        curr_str = date.strftime('%Y-%m-%d')
        if any(d <= curr_str for d in buy_dates_str) and last_buy < max([d for d in buy_dates_str if d <= curr_str], default=""):
            total_shares += amount / price
            total_invested += amount
            last_buy = max([d for d in buy_dates_str if d <= curr_str])
        dates.append(curr_str)
        invested_curve.append(total_invested)
        valuation_curve.append(total_shares * price)
    return {"ticker": ticker, "total_invested": total_invested, "final_value": valuation_curve[-1], "return_pct": ((valuation_curve[-1]-total_invested)/total_invested*100), "dates": dates, "invested_curve": invested_curve, "valuation_curve": valuation_curve}

@app.get("/api/risk-return")
def get_risk_return_map(tickers: str):
    ticker_list = [t.strip().upper() for t in tickers.replace(' ', ',').split(',') if t.strip()]
    result = []
    for t in ticker_list:
        series = get_historical_data(t, period="1y")
        if series is None or len(series) < 50: continue
        rets = series.pct_change().dropna()
        result.append({"ticker": t, "return": float(rets.mean()*252*100), "risk": float(rets.std()*np.sqrt(252)*100)})
    return result

@app.get("/api/deep-analysis/{ticker}")
def get_deep_analysis(ticker: str, start_date: str = None, end_date: str = None):
    # Full data for the requested or default period
    series = get_historical_data(ticker, start=start_date, end=end_date) if start_date else get_historical_data(ticker, period="5y")
    if series is None or len(series) < 20: raise HTTPException(status_code=404)
    
    analysis_series = series # Use whole range for this view
    curr_price = float(analysis_series.iloc[-1])
    
    # 1. Trend (Log-Linear)
    x = np.arange(len(analysis_series))
    log_p = np.log(analysis_series.values)
    slope, intercept = np.polyfit(x, log_p, 1)
    line = np.exp(slope * x + intercept)
    std = np.std(log_p - np.log(line))
    
    # 2. Simulation (Monte Carlo logic)
    rets = analysis_series.pct_change().dropna()
    log_rets = np.log(1 + rets)
    drift = log_rets.mean() - 0.5 * log_rets.var()
    vol = log_rets.std()
    
    sim_days = 120
    iters = 100
    paths = np.zeros((sim_days, iters))
    paths[0] = curr_price
    for t in range(1, sim_days):
        paths[t] = paths[t-1] * np.exp(drift + vol * np.random.normal(0, 1, iters))
    
    # Return samples + actual past moving (last 120 days)
    actual_moving = analysis_series.tail(sim_days).values.tolist()
    samples = paths[:, :10].T.tolist()
    
    return {
        "ticker": ticker,
        "current_price": curr_price,
        "current_return": float(analysis_series.pct_change(len(analysis_series)-1).iloc[-1]*100) if len(analysis_series)>1 else 0,
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
            "current_z": float((rets.iloc[-1]-rets.mean())/rets.std()) if not rets.empty else 0,
            "z_history": ((analysis_series.pct_change()-rets.mean())/rets.std()).fillna(0).tail(100).tolist(),
            "z_dates": analysis_series.tail(100).index.strftime('%Y-%m-%d').tolist(),
            "bins": np.histogram(rets*100, bins=30)[1].tolist() if not rets.empty else [],
            "counts": np.histogram(rets*100, bins=30)[0].tolist() if not rets.empty else []
        },
        "simulation": {
            "p50": np.percentile(paths, 50, axis=1).tolist(),
            "samples": samples,
            "actual_past": actual_moving
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)