import { useState, useEffect } from 'react';
import { TickerCombobox } from '../components/TickerCombobox';
import { api } from '../lib/api';
import type { DeepAnalysisData } from '../lib/types';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area, BarChart, Bar, ReferenceLine, Cell } from 'recharts';
import { useLanguage } from '../components/LanguageProvider';

export const DeepQuantAnalysis = () => {
  const [data, setData] = useState<DeepAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const [ticker, setTicker] = useState('^IXIC');

  const handleSearch = (selectedTicker: string = ticker) => {
    setLoading(true);
    setTicker(selectedTicker);
    api.get<DeepAnalysisData>(`/api/deep-analysis/${selectedTicker}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { handleSearch('^IXIC'); }, []);

  const trendData = data?.trend.dates.map((date, i) => ({
    date, price: data.trend.prices[i], upper: data.trend.upper[i], middle: data.trend.middle[i], lower: data.trend.lower[i]
  })) || [];

  const histData = data?.quant.bins.map((bin, i) => ({
    bin: bin.toFixed(0) + '%', val: bin, count: data.quant.counts[i]
  })) || [];

  const simData = data?.simulation.p50.map((val, i) => ({
    day: i,
    p50: val,
    actual: data?.simulation.actual_past?.[i]
  })) || [];

  const zHistoryData = data?.quant.z_history.map((z, i) => ({
    date: data.quant.z_dates[i],
    z: z
  })) || [];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 bg-background/95 backdrop-blur z-30 py-4 border-b border-border">
        <div><h1 className="text-3xl font-bold text-foreground">{t('deep')}</h1><p className="text-muted-foreground">Rolling 252-day Returns (16Y History)</p></div>
        <TickerCombobox onSearch={handleSearch} isLoading={loading} initialValue={ticker} />
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
             <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Historical Mean (1Y)</p>
             <p className="text-2xl font-black text-green-500">{data.avg_1y_return.toFixed(1)}%</p>
           </div>
           <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
             <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Data Available Since</p>
             <p className="text-2xl font-black text-foreground">{data.first_date}</p>
           </div>
           <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
             <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Current Z-Score</p>
             <p className="text-2xl font-black text-primary">{data.quant.current_z.toFixed(2)}σ</p>
           </div>
        </div>
      )}

      {data && (
        <>
          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-blue-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">{t('prob_dist')}</h2></div>
             <div className="h-[350px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histData} barGap={0} barCategoryGap={1}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                    <XAxis dataKey="bin" stroke="#9ca3af" fontSize={10} minTickGap={20} />
                    <YAxis stroke="#9ca3af" fontSize={10} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))'}} />
                    <Bar dataKey="count">
                      {histData.map((entry, index) => {
                        let color = entry.val > 0 ? "#86efac" : "#93c5fd";
                        if (Math.abs(entry.val - data.quant.mean) > 2 * data.quant.std) {
                          color = entry.val > 0 ? "#ef4444" : "#3b82f6";
                        }
                        return <Cell key={index} fill={color} />;
                      })}
                    </Bar>
                    <ReferenceLine x={data.quant.mean.toFixed(0) + '%'} stroke="#22c55e" strokeDasharray="3 3" label={{position: 'top', value: 'Mean', fill: '#22c55e', fontSize: 10}} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-purple-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">2. Historical Typical Path vs Recent</h2></div>
             <div className="h-[400px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={simData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                    <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))'}} />
                    <Legend />
                    {/* Reference at 100 (Start) */}
                    <ReferenceLine y={100} stroke="#6b7280" strokeDasharray="3 3" />
                    
                    <Line type="monotone" dataKey="actual" stroke="currentColor" strokeWidth={3} dot={false} className="text-foreground" name="Recent 252D (Actual)" />
                    <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={3} dot={false} name="Historical Mean Path" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-green-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">4. Log-Linear Trend Channel (Full History)</h2></div>
             <div className="h-[500px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} minTickGap={50} tickFormatter={(v) => v.slice(0, 4)} />
                    <YAxis domain={['auto', 'auto']} scale="log" stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))'}} />
                    <Legend />
                    <Area type="monotone" dataKey="upper" stroke="none" fill="#6b7280" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="lower" stroke="none" fill="hsl(var(--background))" fillOpacity={1} />
                    <Line type="monotone" dataKey="price" stroke="currentColor" strokeWidth={1} dot={false} className="text-foreground" name="Price" />
                    <Line type="monotone" dataKey="middle" stroke="#22c55e" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Trend" />
                    <Line type="monotone" dataKey="upper" stroke="#ef4444" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="lower" stroke="#3b82f6" strokeWidth={1} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>
        </>
      )}
    </div>
  );
};