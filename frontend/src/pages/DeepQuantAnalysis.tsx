import { useState, useEffect } from 'react';
import { TickerCombobox } from '../components/TickerCombobox';
import { api } from '../lib/api';
import type { DeepAnalysisData } from '../lib/types';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area, BarChart, Bar, ReferenceLine, Cell } from 'recharts';
import { cn } from '../lib/utils';
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

  const histData = data?.quant.bins.slice(0, -1).map((bin, i) => ({
    bin: bin.toFixed(1) + '%', val: bin, count: data.quant.counts[i]
  })) || [];

  const simData = data?.simulation.p50.map((val, i) => {
    const obj: any = { day: i, p50: val };
    data.simulation.samples?.forEach((path, idx) => { obj[`s${idx}`] = path[i]; });
    if (data.simulation.actual_past?.[i] !== undefined) obj['actual'] = data.simulation.actual_past[i];
    return obj;
  }) || [];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 bg-background/95 backdrop-blur z-30 py-4 border-b border-border">
        <div><h1 className="text-3xl font-bold text-foreground">{t('deep')}</h1><p className="text-muted-foreground">Fixed Analysis: Since 2011, 252D Period</p></div>
        <TickerCombobox onSearch={handleSearch} isLoading={loading} initialValue={ticker} />
      </div>

      {data && (
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex justify-between text-sm">
           <p className="text-muted-foreground font-semibold">Data Available Since: <span className="text-foreground">{data.first_date}</span></p>
           <p className="text-muted-foreground font-semibold">Total Days Analyzed: <span className="text-foreground">{data.invested_days} days</span></p>
        </div>
      )}

      {data && (
        <>
          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-blue-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">{t('prob_dist')}</h2></div>
             <div className="h-[300px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1}/><XAxis dataKey="bin" stroke="#9ca3af" fontSize={10} /><YAxis stroke="#9ca3af" fontSize={10} /><Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))'}} />
                    <Bar dataKey="count">{histData.map((entry, index) => {
                      const color = entry.val > 0 ? "#86efac" : "#93c5fd";
                      return <Cell key={index} fill={color} />;
                    })}</Bar>
                    <ReferenceLine x={data.quant.mean.toFixed(1) + '%'} stroke="#22c55e" label={{position: 'top', value: 'Mean', fill: '#22c55e', fontSize: 10}} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-purple-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">2. {t('simulation')}</h2></div>
             <div className="h-[400px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={simData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} /><XAxis dataKey="day" stroke="#9ca3af" fontSize={12} /><YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))'}} />
                    {Array.from({length: 10}).map((_, i) => (<Line key={i} type="monotone" dataKey={`s${i}`} stroke="#6b7280" strokeWidth={1} strokeOpacity={0.1} dot={false} />))}
                    <Line type="monotone" dataKey="actual" stroke="currentColor" strokeWidth={3} dot={false} className="text-foreground" name="Actual Moving" />
                    <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={3} dot={false} name="Median Path" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-green-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">4. {t('trend_channel')}</h2></div>
             <div className="h-[500px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} /><XAxis dataKey="date" stroke="#9ca3af" fontSize={10} minTickGap={30} tickFormatter={(v) => v.slice(0, 7)} /><YAxis domain={['auto', 'auto']} scale="log" stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `$${v.toFixed(0)}`} /><Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))'}} /><Legend />
                    <Area type="monotone" dataKey="upper" stroke="none" fill="#6b7280" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="lower" stroke="none" fill="hsl(var(--background))" fillOpacity={1} />
                    <Line type="monotone" dataKey="price" stroke="currentColor" strokeWidth={2} dot={false} className="text-foreground" />
                    <Line type="monotone" dataKey="middle" stroke="#22c55e" strokeDasharray="5 5" strokeWidth={2} dot={false} />
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
