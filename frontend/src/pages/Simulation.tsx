import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TickerSearch } from '../components/TickerSearch';
import { api, type SimulationData } from '../lib/api';

export const Simulation = () => {
  const [data, setData] = useState<SimulationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (ticker: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<SimulationData>(`/api/simulation/${ticker}`);
      setData(response.data);
    } catch (err) {
      setError('Failed to fetch simulation data.');
    } finally {
      setLoading(false);
    }
  };

  const chartData = data?.paths.p50.map((val, i) => ({
    day: i,
    p95: data.paths.p95[i],
    p50: val,
    p05: data.paths.p05[i]
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Monte Carlo Simulation</h1>
          <p className="text-gray-400 text-sm">Future price projection based on geometric Brownian motion</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-gray-500">Win Rate</p>
              <p className="text-2xl font-bold text-green-400">{data.win_rate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Probability of positive return</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-gray-500">Current Price</p>
              <p className="text-2xl font-bold text-white">${data.current_price.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-gray-500">Simulation Horizon</p>
              <p className="text-2xl font-bold text-blue-400">{data.simulation_days} Days</p>
            </div>
          </div>

          <div className="h-[500px] bg-card border border-border rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Projected Price Paths</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="day" 
                  stroke="#9CA3AF" 
                  label={{ value: 'Days into Future', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
                />
                <YAxis stroke="#9CA3AF" tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                  labelFormatter={(val) => `Day ${val}`}
                />
                <Legend />
                <Line type="monotone" dataKey="p95" stroke="#34D399" strokeWidth={2} dot={false} name="Bull Case (95%)" />
                <Line type="monotone" dataKey="p50" stroke="#60A5FA" strokeWidth={2} dot={false} name="Base Case (Median)" />
                <Line type="monotone" dataKey="p05" stroke="#F87171" strokeWidth={2} dot={false} name="Bear Case (5%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
