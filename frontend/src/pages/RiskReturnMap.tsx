import { useState } from 'react';
import { api } from '../lib/api';
import { RiskReturnData } from '../lib/types';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Label, ZAxis } from 'recharts';

export const RiskReturnMap = () => {
  const [tickerInput, setTickerInput] = useState('AAPL, TSLA, NVDA, SPY, QQQ, AMZN, GOOGL, META, MSFT, AVGO');
  const [data, setData] = useState<RiskReturnData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = () => {
    setLoading(true);
    api.get<RiskReturnData[]>(`/api/risk-return?tickers=${tickerInput}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Risk vs Return Map</h1>
          <p className="text-muted-foreground text-sm">Visualize 1-year performance. Ideally, you want High Return (Up) and Low Risk (Left).</p>
        </div>
        
        <div className="flex gap-2 w-full max-w-2xl">
          <input
            type="text"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            className="flex-1 bg-background border border-input rounded-lg px-4 py-2 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="AAPL, TSLA, NVDA..."
          />
          <button 
            onClick={handleAnalyze} 
            disabled={loading}
            className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Map Tickers'}
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <div className="h-[600px] bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
          {/* Quadrant Backgrounds (CSS only for simplicity) */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-5 pointer-events-none">
             <div className="bg-red-500"></div> {/* High Risk, High Return */}
             <div className="bg-green-500"></div> {/* Low Risk, High Return (Ideal) */}
             <div className="bg-orange-500"></div> {/* High Risk, Low Return (Worst) */}
             <div className="bg-yellow-500"></div> {/* Low Risk, Low Return */}
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" dataKey="risk" name="Risk (Vol)" unit="%" stroke="#9ca3af" label={{ value: 'Annualized Volatility (Risk)', position: 'insideBottom', offset: -10, fill: '#6b7280' }} />
              <YAxis type="number" dataKey="return" name="Return" unit="%" stroke="#9ca3af" label={{ value: 'Annualized Return', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
              <ZAxis range={[100, 100]} /> {/* Constant size dots */}
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                        <p className="font-bold text-foreground">{d.ticker}</p>
                        <p className="text-sm text-green-500">Return: {d.return.toFixed(1)}%</p>
                        <p className="text-sm text-red-400">Risk: {d.risk.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Ratio: {(d.return/d.risk).toFixed(2)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="Stocks" data={data} fill="hsl(var(--primary))">
                {/* Labels on dots */}
                {data.map((entry, index) => (
                  <Label key={index} dataKey="ticker" position="top" offset={10} content={(props: any) => {
                       const { x, y, value } = props;
                       return <text x={x} y={y} dy={-10} fill="currentColor" textAnchor="middle" fontSize={12} className="text-foreground font-semibold">{entry.ticker}</text>
                  }} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
