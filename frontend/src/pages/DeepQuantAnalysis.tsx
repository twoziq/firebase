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

  const handleSearch = (ticker: string) => {
    setLoading(true);
    api.get<DeepAnalysisData>(`/api/deep-analysis/${ticker}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Default load
  useEffect(() => {
    handleSearch('^IXIC');
  }, []);

  const trendData = data?.trend.dates.map((date, i) => ({
    date,
    price: data.trend.prices[i],
    upper: data.trend.upper[i],
    middle: data.trend.middle[i],
    lower: data.trend.lower[i]
  })) || [];

  const histData = data?.quant.bins.slice(0, -1).map((bin, i) => ({
    bin: bin.toFixed(1) + '%',
    val: bin,
    count: data.quant.counts[i]
  })) || [];

  const simData = data?.simulation.p50.map((val, i) => {
    const obj: any = { day: i, p50: val };
    data.simulation.samples.forEach((path, idx) => {
      obj[`s${idx}`] = path[i];
    });
    return obj;
  }) || [];

  const zHistoryData = data?.quant.z_history.map((z, i) => ({
    date: data.quant.z_dates[i],
    z: z
  })) || [];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 bg-background/95 backdrop-blur z-30 py-4 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('deep')}</h1>
          <p className="text-muted-foreground">Comprehensive statistical breakdown for {data?.ticker || '^IXIC'}</p>
        </div>
        <TickerCombobox onSearch={handleSearch} isLoading={loading} placeholder={t('ticker_placeholder')} />
      </div>

      {data && (
        <>
          {/* 1. Probability Distribution */}
          <section className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-blue-500 rounded-full"/>
                <h2 className="text-xl font-bold text-foreground">{t('prob_dist')}</h2>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-[300px] bg-card border border-border rounded-xl p-4 shadow-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                      <XAxis dataKey="bin" stroke="#9ca3af" fontSize={10} />
                      <YAxis stroke="#9ca3af" fontSize={10} />
                      <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                        contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}} 
                      />
                      <Bar dataKey="count" name="Frequency">
                        {histData.map((entry, index) => {
                          const isStdOut = Math.abs(entry.val / data.quant.std) > 2;
                          let color = "hsl(var(--primary))";
                          if (isStdOut) color = entry.val > 0 ? "#ef4444" : "#3b82f6"; // Red for +Std, Blue for -Std
                          else if (entry.val > 0) color = "#86efac"; // Light Green
                          else color = "#93c5fd"; // Light Blue
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                      <ReferenceLine x={data.quant.mean.toFixed(1) + '%'} stroke="#22c55e" strokeDasharray="3 3" label={{position: 'top', value: 'Mean', fill: '#22c55e', fontSize: 10}} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center space-y-4 p-6 bg-muted/20 rounded-xl border border-border/50">
                   <div className="flex justify-between items-end">
                      <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Current Yield</span>
                      <span className={cn("text-3xl font-black", data.current_return >= 0 ? "text-green-500" : "text-red-500")}>
                        {data.current_return.toFixed(2)}%
                      </span>
                   </div>
                   <div className="h-px bg-border" />
                   <p className="text-sm text-muted-foreground leading-relaxed">
                     Z-Score: <span className="font-bold text-foreground">{data.quant.current_z.toFixed(2)}σ</span>. 
                     The distribution shows returns over the analysis period. Red/Blue bars indicate 2-sigma outliers.
                   </p>
                </div>
             </div>
          </section>

          {/* 2. Simulation */}
          <section className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-purple-500 rounded-full"/>
                <h2 className="text-xl font-bold text-foreground">2. {t('simulation')}</h2>
             </div>
             <div className="h-[400px] bg-card border border-border rounded-xl p-4 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={simData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                    <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}} />
                    
                    {/* Sample Paths (Gray lines) */}
                    {Array.from({length: 10}).map((_, i) => (
                      <Line key={i} type="monotone" dataKey={`s${i}`} stroke="#6b7280" strokeWidth={1} strokeOpacity={0.2} dot={false} />
                    ))}
                    
                    {/* Thick Recent Actual (Historical end point) */}
                    <ReferenceLine x={0} stroke="#ffffff" strokeWidth={3} label={{value: 'NOW', fill: '#ffffff', fontSize: 10}} />
                    
                    {/* Median Path (Green Solid) */}
                    <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={3} dot={false} name="Median Flow" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

          {/* 3. Z-Score Flow */}
          <section className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-yellow-500 rounded-full"/>
                <h2 className="text-xl font-bold text-foreground">3. {t('z_flow')}</h2>
             </div>
             <div className="h-[300px] bg-card border border-border rounded-xl p-4 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={zHistoryData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                    <YAxis domain={[-3, 3]} stroke="#9ca3af" fontSize={10} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}} />
                    <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine y={-2} stroke="#3b82f6" strokeDasharray="3 3" />
                    <ReferenceLine y={0} stroke="#22c55e" />
                    <Line type="step" dataKey="z" stroke="#f59e0b" strokeWidth={2} dot={false} name="Z-Score" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

          {/* 4. Log-Linear Trend Channel */}
          <section className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-green-500 rounded-full"/>
                <h2 className="text-xl font-bold text-foreground">4. {t('trend_channel')}</h2>
             </div>
             <div className="h-[500px] bg-card border border-border rounded-xl p-4 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} minTickGap={30} tickFormatter={(v) => v.slice(0, 7)} />
                    <YAxis domain={['auto', 'auto']} scale="log" stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}} />
                    <Legend />
                    {/* Using CSS variables for stroke to handle dark/light mode transition */}
                    <Line type="monotone" dataKey="price" stroke="currentColor" strokeWidth={2} dot={false} name="Price" className="text-foreground" />
                    <Line type="monotone" dataKey="middle" stroke="#22c55e" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Trend Mean" />
                    <Area type="monotone" dataKey="upper" stroke="#ef4444" fill="#ef4444" fillOpacity={0.05} strokeWidth={1} name="+2σ Band" />
                    <Area type="monotone" dataKey="lower" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} strokeWidth={1} name="-2σ Band" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>
        </>
      )}
    </div>
  );
};