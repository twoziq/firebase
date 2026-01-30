import yfinance as yf
import pandas as pd

ticker = "^IXIC"
start = "2021-01-01"
end = "2026-01-30"

print(f"Attempting to download {ticker}...")
try:
    df = yf.download(ticker, start=start, end=end, progress=False)
    print("Download result type:", type(df))
    print("Empty?", df.empty)
    if not df.empty:
        print("Columns:", df.columns)
        print("Head:", df.head())
    else:
        print("Dataframe is empty.")
except Exception as e:
    print(f"Exception during download: {e}")
