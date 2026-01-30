import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { MarketValuationData } from '../lib/types';
import { useLanguage } from '../components/LanguageProvider';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const MarketValuation = () => {
  const [data, setData] = useState<MarketValuationData | null>(null);
  const [history, setHistory] = useState<{dates: string[], values: number[]} | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('2y');
  const { t } = useLanguage();

  useEffect(() => {
    Promise.all([
      api.get<MarketValuationData>('/api/market/valuation'),
      api.get<{dates: string[], values: number[]}>(`/api/market/per-history?period=${period}`)
    ]).then(([res1, res2]) => {
      setData(res1.data);
      setHistory(res2.data);
    }).finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="text-center p-10 text-muted-foreground animate-pulse">Loading Market Data...</div>;
  if (!data) return <div className="text-center p-10 text-red-400">Error loading data.</div>;

  const chartData = history?.dates.map((date, i) => ({ date, value: history.values[i] })) || [];

  // Custom Tick Formatter: YY.MM at 3-month intervals
  const formatXAxis = (tickItem: string) => {
    const d = new Date(tickItem);
    const month = d.getMonth() + 1;
    const year = String(d.getFullYear()).slice(2);
    // Only show for 3, 6, 9, 12 months
    if ([3, 6, 9, 12].includes(month)) {
      return `${year}.${month < 10 ? '0' + month : month}`;
    }
    return "";
  };

  // Helper for formatting large numbers
  const formatCurrency = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    return `$${(val / 1e6).toFixed(0)}M`;
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Big Tech Valuation</h1>
        <p className="text-muted-foreground">{t('market')} - Top 8 Tech Giants</p>
      </div>

      <div className="flex justify-center">
        <div className="relative w-64 h-64 bg-card rounded-full border-4 border-primary/20 flex flex-col items-center justify-center shadow-xl">
           <span className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Market PER</span>
           <span className="text-6xl font-black text-foreground">{data.weighted_pe.toFixed(1)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">Valuation Index History</h2>
          <div className="flex bg-muted rounded-lg p-1 border border-border">
            {['1y', '2y', '5y'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${period === p ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{p.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="h-[350px] bg-card border border-border rounded-2xl p-6 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af" 
                fontSize={10} 
                tickFormatter={formatXAxis}
                minTickGap={30}
              />
              <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={10} tickFormatter={(v) => v.toFixed(1)} />
              <Tooltip 
                contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px'}} 
                labelFormatter={(v) => `Date: ${v}`}
                formatter={(v: any) => [Number(v || 0).toFixed(1), 'Weighted PER']}
              />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} animationDuration={1000} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.details.map((item) => {
          const earnings = item.market_cap / item.pe;
          return (
            <div key={item.ticker} className="group relative bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-primary/50 transition-all duration-300 overflow-hidden cursor-default">
              <div className="relative z-10 transition-transform duration-300 group-hover:-translate-y-1">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-black text-xl">{item.ticker}</p>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">PER</span>
                </div>
                <p className="text-2xl text-foreground font-bold">{item.pe.toFixed(1)}</p>
              </div>
              
              {/* Hover Details */}
              <div className="absolute inset-x-0 bottom-0 p-5 bg-muted/50 backdrop-blur-sm transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mkt Cap:</span>
                  <span className="font-bold text-foreground">{formatCurrency(item.market_cap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Earnings:</span>
                  <span className="font-bold text-foreground">{formatCurrency(earnings)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
