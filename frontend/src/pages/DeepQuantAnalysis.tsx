import { useState, useEffect, useCallback } from 'react';
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
  const [startDate, setStartDate] = useState('2010-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysisPeriod, setAnalysisPeriod] = useState(252);
  const [forecastDays, setForecastDays] = useState(252);

  const fetchAnalysis = useCallback((tck: string, sDate: string, eDate: string, period: number, fDays: number) => {
    setLoading(true);
    api.get<DeepAnalysisData>(`/api/deep-analysis/${encodeURIComponent(tck)}`, {
      params: { start_date: sDate, end_date: eDate, analysis_period: period, forecast_days: fDays }
    })
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAnalysis(ticker, startDate, endDate, analysisPeriod, forecastDays); }, []);

  const handleAnalyzeClick = () => { fetchAnalysis(ticker, startDate, endDate, analysisPeriod, forecastDays); };

  // --- Data Mapping ---
  const trendData = data?.trend?.dates?.map((date, i) => ({
    date, 
    price: data.trend.prices[i], 
    upper: data.trend.upper[i], 
    middle: data.trend.middle[i], 
    lower: data.trend.lower[i]
  })) || [];

  const histData = data?.quant?.bins?.map((bin, i) => ({
    bin: bin.toFixed(0) + '%', 
    val: bin, 
    count: data.quant.counts[i]
  })) || [];

  const pathData = data?.simulation?.p50?.map((val, i) => {
    const obj: any = { 
      day: i, 
      p50: val, 
      upper: data.simulation.upper?.[i], 
      lower: data.simulation.lower?.[i], 
    };
    data.simulation.samples?.forEach((path, idx) => { obj[`s${idx}`] = path[i]; });
    return obj;
  }) || [];

  const zHistoryData = data?.quant?.z_history?.map((z, i) => ({
    date: data.quant.z_dates[i], 
    z: z
  })) || [];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 bg-background/95 backdrop-blur z-[50] py-4 border-b border-border">
        <div><h1 className="text-3xl font-bold text-foreground">{t('deep')}</h1><p className="text-muted-foreground">Historical Rolling Analysis</p></div>
        <TickerCombobox onSearch={(t) => { setTicker(t); fetchAnalysis(t, startDate, endDate, analysisPeriod); }} isLoading={loading} initialValue={ticker} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground uppercase">{t('start_date')}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground" />
        </div>
        <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground uppercase">{t('end_date')}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground" />
        </div>
        <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground uppercase">Lookback (Days)</label>
          <input type="number" value={analysisPeriod} onChange={e => setAnalysisPeriod(Number(e.target.value))} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground" />
        </div>
        <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground uppercase">Forecast (Days)</label>
          <input type="number" value={forecastDays} onChange={e => setForecastDays(Number(e.target.value))} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground" />
        </div>
        <div className="flex items-end">
          <button onClick={handleAnalyzeClick} disabled={loading} className="w-full bg-primary text-primary-foreground py-1.5 rounded-lg font-bold hover:opacity-90">
            {loading ? '...' : t('analyze')}
          </button>
        </div>
      </div>

      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="bg-card border border-border p-4 rounded-xl shadow-sm border-l-4 border-l-green-500">
             <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Rolling Mean Return ({analysisPeriod}D)</p>
             <p className="text-2xl font-black text-green-500">{data.avg_1y_return?.toFixed(1)}%</p>
           </div>
           <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
             <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Data Available Since</p>
             <p className="text-xl font-bold text-foreground">{data.first_date}</p>
           </div>
           <div className="bg-card border border-border p-4 rounded-xl shadow-sm border-l-4 border-l-primary">
             <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Current Z-Score</p>
             <p className="text-2xl font-black text-primary">{data.quant?.current_z?.toFixed(2)}σ</p>
           </div>
        </div>
      )}

      {loading && <div className="text-center py-20 text-muted-foreground animate-pulse font-bold">Processing Data...</div>}

      {data && !loading && (
        <>
          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-purple-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">1. Future Simulation (Monte Carlo)</h2></div>
             <div className="h-[450px] bg-card border border-border rounded-2xl p-6 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pathData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} label={{ value: 'Future Days', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={12} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '12px'}} labelFormatter={(v) => `Future Day: +${v}`} />
                    <Legend />
                    <ReferenceLine y={data.trend?.prices ? data.trend.prices[data.trend.prices.length-1] : 0} stroke="#6b7280" strokeDasharray="3 3" label="Current Price" />
                    <Area type="monotone" dataKey="upper" stroke="none" fill="#6b7280" fillOpacity={0.05} />
                    <Area type="monotone" dataKey="lower" stroke="none" fill="hsl(var(--background))" fillOpacity={1} />
                    
                    {/* Random Samples (30) - HIDDEN FROM LEGEND */}
                    {Array.from({length: 30}).map((_, i) => (
                      <Line 
                        key={i} 
                        type="monotone" 
                        dataKey={`s${i}`} 
                        stroke="#6b7280" 
                        strokeWidth={1} 
                        strokeOpacity={0.1} 
                        dot={false} 
                        legendType="none"
                      />
                    ))}
                    
                    <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={3} dot={false} name="Median Scenario (P50)" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-blue-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">2. {t('prob_dist')}</h2></div>
             <div className="h-[350px] bg-card border border-border rounded-2xl p-6 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histData} barGap={0} barCategoryGap={0}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.05}/>
                    <XAxis dataKey="bin" stroke="#9ca3af" fontSize={10} minTickGap={30} />
                    <YAxis stroke="#9ca3af" fontSize={10} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '12px'}} />
                    <Bar dataKey="count">
                      {histData.map((entry, index) => {
                        let color = entry.val > 0 ? "#86efac" : "#93c5fd";
                        if (data.quant && Math.abs(entry.val - data.quant.mean) > 2 * data.quant.std) color = entry.val > 0 ? "#ef4444" : "#3b82f6";
                        return <Cell key={index} fill={color} />;
                      })}
                    </Bar>
                    <ReferenceLine x={data.quant?.mean?.toFixed(0) + '%'} stroke="#22c55e" strokeDasharray="3 3" label={{position: 'top', value: 'Mean', fill: '#22c55e', fontSize: 10}} />
                    
                    {/* TODAY Arrow/Marker - Fixed Alignment */}
                    <ReferenceLine 
                      x={data.current_1y_return?.toFixed(0) + '%'} 
                      stroke="#f59e0b" 
                      strokeWidth={2} 
                      label={{position: 'top', value: 'Today ▽', fill: '#f59e0b', fontWeight: 'bold'}} 
                    />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-yellow-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">3. {t('z_flow')}</h2></div>
             <div className="h-[300px] bg-card border border-border rounded-2xl p-6 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={zHistoryData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} minTickGap={100} tickFormatter={(v) => v?.slice(2, 7)} />
                    <YAxis domain={[-4, 4]} stroke="#9ca3af" fontSize={10} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '12px'}} />
                    <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine y={-2} stroke="#3b82f6" strokeDasharray="3 3" />
                    <ReferenceLine y={0} stroke="#22c55e" />
                    <Line type="step" dataKey="z" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Z-Score" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-green-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">4. Log-Linear Trend Channel</h2></div>
             <div className="h-[500px] bg-card border border-border rounded-2xl p-6 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} minTickGap={100} tickFormatter={(v) => v?.slice(0, 4)} />
                    <YAxis domain={['auto', 'auto']} scale="log" stroke="#9ca3af" fontSize={10} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '12px'}} />
                    <Legend />
                    <Area type="monotone" dataKey="upper" stroke="none" fill="#6b7280" fillOpacity={0.05} />
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
