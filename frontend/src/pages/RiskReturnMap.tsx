import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { RiskReturnData } from '../lib/types';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, ZAxis } from 'recharts';
import { useLanguage } from '../components/LanguageProvider';

export const RiskReturnMap = () => {
  const { t } = useLanguage();
  const [tickerInput, setTickerInput] = useState('SPY QQQ DIA SCHD AAPL TSLA NVDA');
  const [data, setData] = useState<RiskReturnData[]>([]);
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState<{ x: [number, number], y: [number, number] } | null>(null);

  const handleAnalyze = () => {
    setLoading(true);
    api.get<RiskReturnData[]>(`/api/risk-return?tickers=${tickerInput.trim()}`)
      .then(res => {
        setData(res.data);
        setDomain(null); // Reset zoom
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    handleAnalyze();
  }, []);

  const handlePointClick = () => {
    if (domain) setDomain(null);
    else {
      const risks = data.map(d => d.risk);
      const rets = data.map(d => d.return);
      setDomain({
        x: [Math.min(0, ...risks) * 1.1, Math.max(...risks) * 1.1],
        y: [Math.min(0, ...rets) * 1.1, Math.max(...rets) * 1.1]
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('risk')}</h1>
          <p className="text-muted-foreground text-sm">SPY, QQQ, DIA, SCHD included by default. Separated by space or comma.</p>
        </div>
        
        <div className="flex gap-2 w-full max-w-2xl">
          <input
            type="text"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            className="flex-1 bg-background border border-input rounded-lg px-4 py-2 text-foreground focus:ring-2 focus:ring-primary transition-all"
            placeholder="SPY QQQ DIA SCHD..."
          />
          <button 
            onClick={handleAnalyze} 
            disabled={loading}
            className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '...' : t('analyze')}
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <div 
          className="h-[600px] bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden cursor-pointer"
          onClick={handlePointClick}
          title="Click to toggle Auto-Scale"
        >
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-5 pointer-events-none">
             <div className="bg-red-500"></div>
             <div className="bg-green-500"></div>
             <div className="bg-orange-500"></div>
             <div className="bg-yellow-500"></div>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis 
                type="number" 
                dataKey="risk" 
                name="Risk" 
                unit="%" 
                stroke="#9ca3af" 
                fontSize={12}
                domain={domain ? domain.x : [0, 'auto']}
                label={{ value: 'Annualized Volatility (Risk)', position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 12 }} 
              />
              <YAxis 
                type="number" 
                dataKey="return" 
                name="Return" 
                unit="%" 
                stroke="#9ca3af" 
                fontSize={12}
                domain={domain ? domain.y : [0, 'auto']}
                label={{ value: 'Annualized Return', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }} 
              />
              <ZAxis range={[100, 100]} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as RiskReturnData;
                    return (
                      <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                        <p className="font-bold text-foreground">{d.ticker}</p>
                        <p className="text-sm text-green-500">Return: {d.return.toFixed(1)}%</p>
                        <p className="text-sm text-red-400">Risk: {d.risk.toFixed(1)}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="Stocks" data={data} fill="hsl(var(--primary))">
                <LabelList dataKey="ticker" position="top" offset={10} style={{ fill: 'currentColor', fontSize: '12px', fontWeight: 'bold' }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
