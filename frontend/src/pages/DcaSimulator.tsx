import { useState } from 'react';
import { TickerCombobox } from '../components/TickerCombobox';
import { api } from '../lib/api';
import { DcaData } from '../lib/types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export const DcaSimulator = () => {
  const [data, setData] = useState<DcaData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleSearch = (ticker: string) => {
    setLoading(true);
    // Default: 3 years (36 months), $1000/month
    api.get<DcaData>(`/api/dca?ticker=${ticker}&months=36&monthly_amount=1000`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const chartData = data?.dates.map((date, i) => ({
    date,
    invested: data.invested_curve[i],
    value: data.valuation_curve[i]
  })) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DCA Simulator</h1>
          <p className="text-muted-foreground">Monthly $1,000 investment for 3 years</p>
        </div>
        <TickerCombobox onSearch={handleSearch} isLoading={loading} placeholder="Enter ticker for DCA..." />
      </div>

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground text-sm">Total Invested</p>
              <p className="text-2xl font-bold text-foreground">${data.total_invested.toLocaleString()}</p>
            </div>
            <div className="p-6 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground text-sm">Final Value</p>
              <p className={`text-2xl font-bold ${data.final_value >= data.total_invested ? 'text-green-500' : 'text-red-500'}`}>
                ${data.final_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-6 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground text-sm">Total Return</p>
              <p className={`text-2xl font-bold ${data.return_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.return_pct > 0 ? '+' : ''}{data.return_pct.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="h-[400px] bg-card border border-border rounded-xl p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                <XAxis dataKey="date" stroke="#9ca3af" tickFormatter={(val) => val.slice(0, 7)} minTickGap={50} />
                <YAxis stroke="#9ca3af" tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(val: number) => [`$${val.toLocaleString()}`, '']}
                />
                <Legend />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" name="Portfolio Value" />
                <Area type="step" dataKey="invested" stroke="#9ca3af" strokeDasharray="5 5" fill="none" name="Invested Capital" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
