import { useState, useEffect, useCallback } from 'react';
import { TickerCombobox } from '../components/TickerCombobox';
import { api } from '../lib/api';
import type { DeepAnalysisData } from '../lib/types';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area, ReferenceLine, BarChart, Bar, Cell } from 'recharts';
import { useLanguage } from '../components/LanguageProvider';

export const DeepQuantAnalysis = () => {
  const [data, setData] = useState<DeepAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  
  const [ticker, setTicker] = useState('^IXIC');
  const [startDate, setStartDate] = useState('2010-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodDays, setPeriodDays] = useState(252);

  const fetchAnalysis = useCallback((tck: string, sDate: string, eDate: string, period: number) => {
    setLoading(true);
    // Pass same period for both lookback and forecast
    api.get<DeepAnalysisData>(`/api/deep-analysis/${encodeURIComponent(tck)}`, {
      params: { start_date: sDate, end_date: eDate, analysis_period: period, forecast_days: period }
    })
      .then(res => setData(res.data))
      .catch(err => {
        console.error("Analysis Failed:", err);
        const msg = err.response?.data?.detail || err.message || "Unknown Error";
        alert(`Analysis failed: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAnalysis(ticker, startDate, endDate, periodDays); }, []);

  const handleAnalyzeClick = () => { fetchAnalysis(ticker, startDate, endDate, periodDays); };

  // --- Data Mapping ---
  // Chart 1: Simulation (Past + Future)
  const simulationChartData: any[] = [];
  if (data?.simulation) {
     // Future Data (Positive Days)
     if (data.simulation.p50) {
        data.simulation.p50.forEach((val, i) => {
           const obj: any = { day: i, p50: val, upper: data.simulation.upper?.[i], lower: data.simulation.lower?.[i] };
           data.simulation.samples?.forEach((path, idx) => { obj[`s${idx}`] = path[i]; });
           simulationChartData.push(obj);
        });
     }
  }
  
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

  const zHistoryData = data?.quant?.z_history?.map((z, i) => ({
    date: data.quant.z_dates[i], 
    z: z
  })) || [];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative py-4 border-b border-border">
        <div><h1 className="text-3xl font-bold text-foreground">{t('deep')}</h1><p className="text-muted-foreground">Historical Rolling Analysis</p></div>
        <TickerCombobox onSearch={(t) => { setTicker(t); fetchAnalysis(t, startDate, endDate, periodDays); }} isLoading={loading} initialValue={ticker} />
      </div>

      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Analysis Range */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border pb-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              Analysis Range
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('start_date')}</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="w-full h-11 bg-background border border-input rounded-lg px-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
                  />
                  {data?.first_date && <p className="text-xs text-muted-foreground mt-1 absolute right-0 -bottom-5">Listing: {data.first_date}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('end_date')}</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="w-full h-11 bg-background border border-input rounded-lg px-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
                />
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border pb-2">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
              Parameters
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Rolling Period (Days)</label>
              <input 
                type="number" 
                value={periodDays} 
                onChange={e => setPeriodDays(Number(e.target.value))} 
                className="w-full h-11 bg-background border border-input rounded-lg px-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button 
            onClick={handleAnalyzeClick} 
            disabled={loading} 
            className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
          >
            {loading ? 'Crunching Numbers...' : t('analyze')}
          </button>
        </div>
      </div>

      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="bg-card border border-border p-4 rounded-xl shadow-sm border-l-4 border-l-green-500">
             <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Avg Period Return ({periodDays}D)</p>
             <p className="text-2xl font-black text-green-500">{data.avg_1y_return?.toFixed(1)}%</p>
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
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-purple-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">1. Simulation Comparison (Past vs Future Model)</h2></div>
             <div className="h-[450px] bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="text-xs text-muted-foreground mb-2 text-right">Unit: Normalized Price (Start=100)</div>
                <ResponsiveContainer width="100%" height="95%">
                  <ComposedChart data={(() => {
                      const chartData: any[] = [];
                      const len = Math.max(data.simulation?.p50?.length || 0, data.simulation?.actual_past?.length || 0);
                      for(let i=0; i<len; i++) {
                          const obj: any = { day: i };
                          if (data.simulation?.p50?.[i] !== undefined) {
                              obj.p50 = data.simulation.p50[i];
                              obj.upper = data.simulation.upper?.[i];
                              obj.lower = data.simulation.lower?.[i];
                          }
                          if (data.simulation?.actual_past?.[i] !== undefined) {
                              obj.actual = data.simulation.actual_past[i];
                          }
                          chartData.push(obj);
                      }
                      return chartData;
                  })()} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} label={{ value: 'Days', position: 'insideBottomRight', offset: -5 }} type="number" />
                    <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={12} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '12px'}} labelFormatter={(v) => `Day ${v}`} />
                    <Legend />
                    <ReferenceLine y={100} stroke="#6b7280" strokeDasharray="3 3" />
                    
                    <Area type="monotone" dataKey="upper" stroke="none" fill="#6b7280" fillOpacity={0.05} />
                    <Area type="monotone" dataKey="lower" stroke="none" fill="hsl(var(--background))" fillOpacity={1} />
                    
                    <Line type="monotone" dataKey="actual" stroke="#000000" strokeWidth={3} dot={false} 
                          name={`Current Trajectory (${data.simulation?.actual_past ? (data.simulation.actual_past[data.simulation.actual_past.length-1] - 100).toFixed(1) : 0}%)`} />
                    <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={3} strokeDasharray="5 5" dot={false} 
                          name={`Projected Mean (${data.simulation?.p50 ? (data.simulation.p50[data.simulation.p50.length-1] - 100).toFixed(1) : 0}%)`} />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

                              <section className="space-y-4">
                                 <div className="flex items-center gap-2"><div className="w-1 h-8 bg-blue-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">2. {t('prob_dist')}</h2></div>
                                 <div className="h-[350px] bg-card border border-border rounded-2xl p-6 shadow-sm relative">
                                    <div className="absolute top-6 right-6 bg-card/80 backdrop-blur border border-border px-3 py-1 rounded-lg z-10 shadow-sm">
                                       <span className="text-xs text-muted-foreground font-bold uppercase mr-2">Current Period Return</span>
                                       <span className={`font-black ${data.current_1y_return > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                         {data.current_1y_return > 0 ? '+' : ''}{data.current_1y_return?.toFixed(1)}%
                                       </span>
                                    </div>
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
                                        
                                                            {/* TODAY Arrow - Custom Marker */}
                                                            <ReferenceLine 
                                                              x={data.current_1y_return?.toFixed(0) + '%'} 
                                                              stroke="#ef4444" 
                                                              strokeWidth={0}
                                                              label={({viewBox}) => {
                                                                return (
                                                                  <text x={viewBox.x} y={viewBox.y} dy={-5} fill="#ef4444" fontSize={18} textAnchor="middle" fontWeight="bold">▼</text>
                                                                );
                                                              }} 
                                                            />
                                                          </BarChart>                                    </ResponsiveContainer>
                                 </div>
                              </section>          <section className="space-y-4">
             <div className="flex items-center gap-2"><div className="w-1 h-8 bg-yellow-500 rounded-full"/><h2 className="text-xl font-bold text-foreground">3. {t('z_flow')}</h2></div>
             <div className="h-[300px] bg-card border border-border rounded-2xl p-6 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={zHistoryData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} minTickGap={100} tickFormatter={(v) => v?.slice(0, 4)} />
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
