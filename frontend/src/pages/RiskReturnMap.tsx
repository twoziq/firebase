import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { RiskReturnData } from '../lib/types';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, ZAxis } from 'recharts';
import { useLanguage } from '../components/LanguageProvider';

export const RiskReturnMap = () => {
  const { t } = useLanguage();
  const [tickerInput, setTickerInput] = useState('SPY QQQ DIA');
  const [data, setData] = useState<RiskReturnData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleAnalyze = () => {
    setLoading(true);
    api.get<RiskReturnData[]>(`/api/risk-return?tickers=${tickerInput.trim()}`)
      .then(res => {
        setData(res.data);
        setIsZoomed(false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { handleAnalyze(); }, []);

  // Calculate domains
  const getDomains = () => {
    if (!data.length) return { x: [0, 80], y: [0, 40] };
    
    const risks = data.map(d => d.risk);
    const rets = data.map(d => d.return);
    
    if (isZoomed) {
      const minX = Math.min(...risks);
      const maxX = Math.max(...risks);
      const minY = Math.min(...rets);
      const maxY = Math.max(...rets);
      // Increased padding to 20% for much better visual comfort
      const padX = (maxX - minX) * 0.2 || 2;
      const padY = (maxY - minY) * 0.2 || 2;
      return { x: [minX - padX, maxX + padX], y: [minY - padY, maxY + padY] };
    }
    
    return { x: [0, Math.max(80, ...risks) * 1.1], y: [0, Math.max(40, ...rets) * 1.1] };
  };

  const domain = getDomains();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('risk')}</h1>
          <p className="text-muted-foreground text-sm">Click the chart to toggle detailed view.</p>
        </div>
        
        <div className="flex gap-2 w-full max-w-2xl">
          <input type="text" value={tickerInput} onChange={(e) => setTickerInput(e.target.value)} className="flex-1 bg-card border border-input rounded-lg px-4 py-2" />
          <button onClick={handleAnalyze} disabled={loading} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold">
            {loading ? '...' : t('analyze')}
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <div className="h-[600px] bg-card border border-border rounded-xl p-4 shadow-sm cursor-pointer relative overflow-hidden" onClick={() => setIsZoomed(!isZoomed)}>
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-5 pointer-events-none">
             <div className="bg-red-500"></div><div className="bg-green-500"></div><div className="bg-orange-500"></div><div className="bg-yellow-500"></div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis type="number" dataKey="risk" stroke="#9ca3af" fontSize={12} domain={domain.x} tickFormatter={(v) => v.toFixed(1)} />
              <YAxis type="number" dataKey="return" stroke="#9ca3af" fontSize={12} domain={domain.y} tickFormatter={(v) => v.toFixed(1)} />
              <ZAxis range={[100, 100]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  if (active && payload?.length) {
                    const d = payload[0].payload as RiskReturnData;
                    return <div className="bg-popover border border-border p-3 rounded-lg shadow-xl"><p className="font-bold">{d.ticker}</p><p className="text-sm text-green-500">Ret: {d.return.toFixed(1)}%</p><p className="text-sm text-red-400">Risk: {d.risk.toFixed(1)}%</p></div>;
                  } return null;
                }} />
              <Scatter data={data} fill="hsl(var(--primary))">
                <LabelList dataKey="ticker" position="top" style={{ fill: 'currentColor', fontSize: '11px', fontWeight: 'bold' }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
