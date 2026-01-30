import { useState } from 'react';
import { TickerCombobox } from '../components/TickerCombobox';
import { api } from '../lib/api';
import { DeepAnalysisData } from '../lib/types';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area, BarChart, Bar, ReferenceLine } from 'recharts';
import { cn } from '../lib/utils';

export const DeepQuantAnalysis = () => {
  const [data, setData] = useState<DeepAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = (ticker: string) => {
    setLoading(true);
    api.get<DeepAnalysisData>(`/api/deep-analysis/${ticker}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Prepare Data for Charts
  const trendData = data?.trend.dates.map((date, i) => ({
    date,
    price: data.trend.prices[i],
    upper: data.trend.upper[i],
    middle: data.trend.middle[i],
    lower: data.trend.lower[i]
  })) || [];

  const histData = data?.quant.distribution.bins.map((bin, i) => ({
    bin: bin.toFixed(1) + '%',
    count: data.quant.distribution.counts[i]
  })) || [];

  const simData = data?.simulation.p50.map((val, i) => ({
    day: i,
    p95: data.simulation.p95[i],
    p50: val,
    p05: data.simulation.p05[i]
  })) || [];

  const zHistoryData = data?.quant.z_history.map((z, i) => ({
    date: data.quant.z_dates[i],
    z: z
  })) || [];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 bg-background/95 backdrop-blur z-30 py-4 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Deep Quant Analysis</h1>
          <p className="text-muted-foreground">Comprehensive statistical breakdown</p>
        </div>
        <TickerCombobox onSearch={handleSearch} isLoading={loading} placeholder="Enter Ticker for Deep Dive..." />
      </div>

      {data && (
        <>
          {/* Section 1: Probability Distribution */}
          <section className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-blue-500 rounded-full"/>
                <h2 className="text-xl font-bold text-foreground">1. Return Probability Distribution</h2>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-[300px] bg-card border border-border rounded-xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3}/>
                      <XAxis dataKey="bin" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Frequency" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center space-y-4 p-6 bg-muted/30 rounded-xl">
                   <p className="text-sm text-muted-foreground">
                     Current Z-Score: <span className={cn("font-bold text-lg", Math.abs(data.quant.current_z) > 2 ? "text-red-500" : "text-green-500")}>
                       {data.quant.current_z.toFixed(2)}σ
                     </span>
                   </p>
                   <p className="text-sm text-muted-foreground">
                     This histogram shows the frequency of daily returns over the last year. A fat tail to the left indicates higher downside risk.
                   </p>
                </div>
             </div>
          </section>

          {/* Section 2: Monte Carlo Simulation */}
          <section className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-purple-500 rounded-full"/>
                <h2 className="text-xl font-bold text-foreground">2. Monte Carlo Future Paths ({data.simulation.days} Days)</h2>
             </div>
             <div className="h-[400px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={simData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" stroke="#9ca3af" />
                    <YAxis domain={['auto', 'auto']} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}} />
                    <Legend />
                    <Line type="monotone" dataKey="p95" stroke="#10b981" strokeWidth={2} dot={false} name="Bull Case (95%)" />
                    <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={2} dot={false} name="Base Case (Median)" />
                    <Line type="monotone" dataKey="p05" stroke="#ef4444" strokeWidth={2} dot={false} name="Bear Case (5%)" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

          {/* Section 3: Z-Score Flow (Standard Deviation Bands) */}
          <section className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-yellow-500 rounded-full"/>
                <h2 className="text-xl font-bold text-foreground">3. Z-Score Flow (Volatility Regime)</h2>
             </div>
             <div className="h-[300px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={zHistoryData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" stroke="#9ca3af" tickFormatter={(v) => v.slice(5)} />
                    <YAxis domain={[-3, 3]} stroke="#9ca3af" />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}} />
                    <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '+2σ', fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine y={-2} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: '-2σ', fill: '#3b82f6', fontSize: 10 }} />
                    <ReferenceLine y={0} stroke="#10b981" label={{ value: 'Mean', fill: '#10b981', fontSize: 10 }} />
                    <Line type="step" dataKey="z" stroke="#f59e0b" strokeWidth={2} dot={false} name="Z-Score" />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </section>

          {/* Section 4: Log-Linear Trend Channel */}
          <section className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-green-500 rounded-full"/>
                <h2 className="text-xl font-bold text-foreground">4. Log-Linear Trend Channel</h2>
             </div>
             <div className="h-[500px] bg-card border border-border rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" stroke="#9ca3af" minTickGap={30} tickFormatter={(v) => v.slice(0, 7)} />
                    <YAxis domain={['auto', 'auto']} scale="log" stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}} />
                    <Legend />
                    <Line type="monotone" dataKey="price" stroke="#ffffff" strokeWidth={1} dot={false} name="Price" opacity={0.8} />
                    <Line type="monotone" dataKey="middle" stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Trend Mean" />
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
