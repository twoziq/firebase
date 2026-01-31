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
    setLoading(true);
    
    const fetchValuation = api.get<MarketValuationData>('/api/market/valuation')
      .then(res => setData(res.data))
      .catch(err => console.error("Valuation fetch failed:", err));

    const fetchHistory = api.get<{dates: string[], values: number[]}>(`/api/market/per-history?period=${period}`)
      .then(res => setHistory(res.data))
      .catch(err => console.error("History fetch failed:", err));

    Promise.all([fetchValuation, fetchHistory]).finally(() => setLoading(false));
  }, [period]);

  const chartData = history?.dates?.map((date, i) => ({ date, value: history.values[i] })) || [];

  // Custom Tick Formatter
  const formatXAxis = (tickItem: string) => {
    const d = new Date(tickItem);
    const month = d.getMonth() + 1;
    const year = String(d.getFullYear()).slice(2);
    if ([3, 6, 9, 12].includes(month)) return `${year}.${month < 10 ? '0' + month : month}`;
    return "";
  };

  const formatCurrency = (val: number) => {
    if (!val || !isFinite(val)) return "N/A";
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    return `$${(val / 1e6).toFixed(0)}M`;
  };

  // ... (Skeleton UI components remains same)
  const LoadingSkeleton = () => (
    <div className="animate-pulse space-y-12 pb-20">
      <div className="space-y-2 text-center">
        <div className="h-8 bg-muted rounded w-64 mx-auto"></div>
        <div className="h-4 bg-muted rounded w-48 mx-auto"></div>
      </div>
      <div className="flex justify-center">
        <div className="w-64 h-64 bg-muted rounded-full"></div>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-6 bg-muted rounded w-48"></div>
          <div className="h-8 bg-muted rounded w-32"></div>
        </div>
        <div className="h-[350px] bg-muted rounded-2xl"></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-2xl"></div>
        ))}
      </div>
    </div>
  );

  // Initial loading state (no data yet)
  if (loading && !data && !history) return <LoadingSkeleton />;

  return (
    <div className={`space-y-12 animate-in fade-in duration-500 pb-20 relative`}>
      {/* Background refresh indicator */}
      {loading && data && <div className="absolute top-0 right-0 m-4 text-xs font-bold text-primary animate-pulse z-10">Refreshing...</div>}
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Big Tech Valuation</h1>
        <p className="text-muted-foreground">{t('market')} - Top 8 Tech Giants</p>
      </div>

      <div className="flex justify-center">
        <div className="relative w-64 h-64 bg-card rounded-full border-4 border-primary/20 flex flex-col items-center justify-center shadow-xl">
           <span className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Market PER</span>
           {data ? (
             <span className="text-6xl font-black text-foreground">{data.weighted_pe?.toFixed(1)}</span>
           ) : (
             <div className="h-16 w-32 bg-muted animate-pulse rounded"></div>
           )}
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
        <div className="h-[350px] bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-center">
          {chartData.length > 0 ? (
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
                <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={10} tickFormatter={(v) => (v && isFinite(v)) ? v.toFixed(1) : ""} />
                <Tooltip 
                  contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px'}} 
                  labelFormatter={(v) => `Date: ${v}`}
                  formatter={(v: any) => [v && isFinite(v) ? Number(v).toFixed(1) : "N/A", 'Weighted PER']}
                />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} animationDuration={1000} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            loading ? <div className="text-muted-foreground animate-pulse">Loading Chart...</div> : <div className="text-muted-foreground font-medium">Chart data unavailable</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data?.details?.map((item) => {
          const earnings = item.market_cap / item.pe;
          return (
            <div key={item.ticker} className="group relative bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-primary/50 transition-all duration-300 overflow-hidden cursor-default">
              <div className="relative z-10 transition-transform duration-300 group-hover:-translate-y-1">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-black text-xl">{item.ticker}</p>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">PER</span>
                </div>
                <p className="text-2xl text-foreground font-bold">{item.pe && isFinite(item.pe) ? item.pe.toFixed(1) : "N/A"}</p>
              </div>
              
              {/* Hover Details */}
              <div className="absolute inset-x-0 bottom-0 p-4 bg-muted/60 backdrop-blur-md transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex flex-col gap-1.5 text-xs z-20 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Mkt Cap</span>
                  <span className="font-bold text-foreground text-right">{formatCurrency(item.market_cap)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Earnings</span>
                  <span className="font-bold text-foreground text-right">{formatCurrency(earnings)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {/* Skeleton items if data failed but we want to keep layout or if partial data */}
        {!data && !loading && (
           <div className="col-span-full text-center py-10 text-red-400">Failed to load valuation details. <button onClick={() => window.location.reload()} className="underline ml-2">Retry</button></div>
        )}
      </div>
    </div>
  );
};