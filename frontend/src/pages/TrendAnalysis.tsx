import { useState } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area } from 'recharts';
import { TickerSearch } from '../components/TickerSearch';
import { api, type TrendData } from '../lib/api';
import { cn } from '../lib/utils';

export const TrendAnalysis = () => {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (ticker: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<TrendData>(`/api/trend/${ticker}`);
      setData(response.data);
    } catch (err) {
      setError('Failed to fetch data. Please check the ticker and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format data for Recharts
  const chartData = data?.dates.map((date, i) => ({
    date,
    price: data.prices[i],
    upper: data.trend_upper, // Constant in this simplistic model response, or historical? 
                             // Wait, main.py returns single float for upper/lower based on current fit.
                             // Actually, standard deviation bands usually expand.
                             // Let's check main.py again. 
                             // It returns: "trend_upper": float(upper[-1])
                             // Ah, it only returns the *current* upper/lower.
                             // But it returns "trend_middle_history".
                             // So I can reconstruct the bands history if I assume constant width or just plot current lines?
                             // Actually, in main.py: 
                             // middle = np.exp(trend_line)
                             // upper = np.exp(trend_line + 2*std) -> This is a vector!
                             // But the return dict says: "trend_upper": float(upper[-1])
                             // It implies the API only returns the *last* value for upper/lower.
                             // BUT it returns "trend_middle_history".
                             // I should probably plot the middle line history.
                             // For visual "bands", if I only have the last value, I can't plot historical bands accurately unless I calculate them locally 
                             // or if I assume the width (ratio) is constant (which it is for log-linear).
                             // Yes, upper = middle * exp(2*std).
                             // So I can derive historical upper/lower from middle history.
    middle: data.trend_middle_history[i]
  })) || [];

  // Derive historical bands for the chart
  // factor = upper / middle (at last point)
  const upperFactor = data ? data.trend_upper / data.trend_middle_history[data.trend_middle_history.length - 1] : 1;
  const lowerFactor = data ? data.trend_lower / data.trend_middle_history[data.trend_middle_history.length - 1] : 1;

  const finalChartData = chartData.map(d => ({
    ...d,
    upper: d.middle * upperFactor,
    lower: d.middle * lowerFactor
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Trend Analysis</h1>
          <p className="text-gray-400 text-sm">Log-Linear Regression & Standard Deviation Bands</p>
        </div>
        <TickerSearch onSearch={handleSearch} isLoading={loading} />
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-gray-500">Current Price</p>
              <p className="text-2xl font-bold text-white">${data.current_price.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-gray-500">Band Position</p>
              <p className={cn(
                "text-2xl font-bold",
                data.band_position > 80 ? "text-red-400" : data.band_position < 20 ? "text-green-400" : "text-blue-400"
              )}>
                {data.band_position.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">0% = Lower Band, 100% = Upper Band</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
               <p className="text-sm text-gray-500">Trend Status</p>
               <p className="text-lg font-medium text-white">
                 {data.band_position > 90 ? "Overbought" : data.band_position < 10 ? "Oversold" : "Neutral"}
               </p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[500px] bg-card border border-border rounded-xl p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={finalChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF" 
                  tick={{fontSize: 12}} 
                  tickFormatter={(val) => val.slice(5)} // Show MM-DD
                  minTickGap={30}
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                  itemStyle={{ color: '#F3F4F6' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#60A5FA" 
                  strokeWidth={2} 
                  dot={false} 
                  name="Price"
                />
                <Line 
                  type="monotone" 
                  dataKey="middle" 
                  stroke="#A78BFA" 
                  strokeDasharray="5 5" 
                  dot={false} 
                  name="Trend (Mean)"
                />
                <Area 
                  type="monotone" 
                  dataKey="upper" 
                  fill="#A78BFA" 
                  fillOpacity={0.1} 
                  stroke="#A78BFA" 
                  strokeOpacity={0.5}
                  name="Upper Band (+2σ)"
                />
                <Area 
                  type="monotone" 
                  dataKey="lower" 
                  fill="#A78BFA" 
                  fillOpacity={0.1} 
                  stroke="#A78BFA" 
                  strokeOpacity={0.5}
                  name="Lower Band (-2σ)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
