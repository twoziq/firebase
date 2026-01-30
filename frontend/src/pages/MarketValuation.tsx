import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { MarketValuationData } from '../lib/types';

export const MarketValuation = () => {
  const [data, setData] = useState<MarketValuationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.get<MarketValuationData>('/api/market/valuation')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center p-10 text-muted-foreground">Loading Market Data...</div>;
  if (!data) return <div className="text-center p-10 text-red-400">Failed to load data.</div>;

  // Format market cap for display (Trillions)
  const formatMktCap = (val: number) => `$${(val / 1e12).toFixed(2)}T`;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Big Tech Valuation</h1>
        <p className="text-muted-foreground">Weighted PER of Top 8 US Tech Giants</p>
      </div>

      <div className="flex justify-center">
        <div className="relative w-64 h-64 bg-card rounded-full border-4 border-muted flex flex-col items-center justify-center shadow-2xl">
           <span className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Market PER</span>
           <span className="text-5xl font-black text-foreground">{data.weighted_pe.toFixed(1)}</span>
           <span className="text-xs text-muted-foreground mt-2">Weighted Average</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.details.map((item) => (
          <div key={item.ticker} className="bg-card border border-border p-4 rounded-xl hover:border-primary transition-colors group">
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-xl group-hover:text-primary transition-colors">{item.ticker}</span>
              <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">{formatMktCap(item.market_cap)}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PER</span>
                <span className={`font-mono font-medium ${item.pe > data.weighted_pe ? 'text-red-400' : 'text-green-400'}`}>
                  {item.pe.toFixed(1)}
                </span>
              </div>
              <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary opacity-50" 
                  style={{ width: `${Math.min((item.pe / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
