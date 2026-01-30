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

  if (loading) return <div className="text-center p-10 text-muted-foreground">Loading...</div>;
  if (!data) return <div className="text-center p-10 text-red-400">Error.</div>;

  const chartData = history?.dates.map((date, i) => ({ date, value: history.values[i] })) || [];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Big Tech Valuation</h1>
        <p className="text-muted-foreground">{t('market')} - Top 8 Tech Giants</p>
      </div>

      {/* Main Stats */}
      <div className="flex justify-center">
        <div className="relative w-64 h-64 bg-card rounded-full border-4 border-primary/20 flex flex-col items-center justify-center shadow-xl">
           <span className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Market PER</span>
           <span className="text-6xl font-black text-foreground">{data.weighted_pe.toFixed(1)}</span>
        </div>
      </div>

      {/* History Chart */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">Valuation Trend (Price Index)</h2>
          <div className="flex bg-muted rounded-lg p-1">
            {['1y', '2y', '5y'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-xs rounded ${period === p ? 'bg-primary text-white shadow' : 'text-muted-foreground'}`}>{p}</button>
            ))}
          </div>
        </div>
        <div className="h-[300px] bg-card border border-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="date" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))'}} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.details.map((item) => (
          <div key={item.ticker} className="bg-card border border-border p-4 rounded-xl">
            <p className="font-bold text-lg">{item.ticker}</p>
            <p className="text-sm text-muted-foreground">PER: <span className="text-foreground font-mono">{item.pe.toFixed(1)}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
};