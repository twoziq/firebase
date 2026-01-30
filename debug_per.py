import yfinance as yf
import pandas as pd

TOP_8 = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO']

def debug_per_history():
    data_dict = {}
    mkt_caps, pes = {}, {}
    
    print("Fetching data...")
    for t in TOP_8:
        try:
            ticker = yf.Ticker(t)
            info = ticker.info
            mkt_caps[t] = info.get('marketCap', 1)
            pes[t] = info.get('trailingPE') or info.get('forwardPE', 30)
            print(f"{t}: MarketCap={mkt_caps[t]}, PE={pes[t]}")
            
            # period="2y" 대신 짧게 테스트
            series = yf.download(t, period="1mo", progress=False)
            if not series.empty:
                data_dict[t] = series['Close'].iloc[:, 0] if isinstance(series.columns, pd.MultiIndex) else series['Close']
        except Exception as e:
            print(f"Error fetching {t}: {e}")
            continue
            
    if not data_dict:
        print("No data fetched.")
        return

    df = pd.DataFrame(data_dict).ffill().bfill()
    total_mkt_cap = sum(mkt_caps.values())
    
    # Calculate weighted index
    weighted_idx = pd.Series(0.0, index=df.index)
    for t in data_dict:
        # 역산 로직: (과거 주가 / 현재 주가) * 가중치
        weight = mkt_caps[t] / total_mkt_cap
        price_ratio = df[t] / df[t].iloc[-1]
        contribution = price_ratio * weight
        weighted_idx += contribution
        print(f"{t} Weight: {weight:.4f}, Last Price: {df[t].iloc[-1]:.2f}")

    # Calculate current weighted average PE
    avg_pe = sum(pes[t] * mkt_caps[t] for t in pes) / total_mkt_cap
    print(f"\nCalculated Current Weighted PE (avg_pe): {avg_pe:.2f}")
    
    final_values = (weighted_idx * avg_pe).round(1)
    print(f"Graph Last Value: {final_values.iloc[-1]}")
    
    if abs(final_values.iloc[-1] - avg_pe) > 0.1:
        print("MISMATCH DETECTED!")
    else:
        print("Match confirmed.")

debug_per_history()
