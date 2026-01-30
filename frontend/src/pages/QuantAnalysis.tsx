import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { TickerSearch } from '../components/TickerSearch';
import { api, type QuantData } from '../lib/api';
import { clsx } from 'clsx';

export const QuantAnalysis = () => {
  const [data, setData] = useState<QuantData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (ticker: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<QuantData>(`/api/quant/${ticker}`);
      setData(response.data);
    } catch (err) {
      setError('Failed to fetch quant data.');
    } finally {
      setLoading(false);
    }
  };

  const historyData = data?.history_z_score.map((val, i) => ({
    date: data.history_dates[i],
    z: val
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Quant Analysis</h1>
          <p className="text-gray-400 text-sm">Statistical scoring and mean reversion signals</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Score Card */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center">
              <h3 className="text-lg font-semibold text-gray-400 mb-4">Return Percentile</h3>
              <div className="relative w-48 h-48 flex items-center justify-center">
                 <svg className="w-full h-full transform -rotate-90">
                   <circle cx="96" cy="96" r="88" fill="none" stroke="#374151" strokeWidth="16" />
                   <circle 
                      cx="96" cy="96" r="88" fill="none" stroke={data.percentile_rank > 80 ? "#F87171" : data.percentile_rank < 20 ? "#34D399" : "#60A5FA"} 
                      strokeWidth="16" 
                      strokeDasharray={`${(data.percentile_rank / 100) * 553} 553`}
                      strokeLinecap="round"
                   />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-4xl font-bold text-white">{data.percentile_rank.toFixed(0)}</span>
                   <span className="text-sm text-gray-500">Percentile</span>
                 </div>
              </div>
              <p className="text-sm text-gray-400 mt-4 text-center">
                Higher percentile means the stock has risen more than usual in the past year.
              </p>
            </div>

            {/* Z-Score Stats */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-400 mb-4">Z-Score Analysis</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Current Z-Score</span>
                    <span className={clsx("font-bold", Math.abs(data.z_score) > 2 ? "text-red-400" : "text-white")}>
                      {data.z_score.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    {/* Simple visual bar for Z-score from -3 to 3 */}
                    <div 
                      className={clsx("h-2.5 rounded-full", data.z_score > 0 ? "bg-red-500" : "bg-green-500")} 
                      style={{ width: `${Math.min(Math.abs(data.z_score) / 3 * 50, 50)}%`, marginLeft: data.z_score > 0 ? '50%' : `${50 - Math.min(Math.abs(data.z_score)/3*50, 50)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>-3σ</span>
                    <span>0</span>
                    <span>+3σ</span>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-300">
                    {data.z_score > 2 
                      ? "Statistically Overextended (High Probability of Pullback)" 
                      : data.z_score < -2 
                        ? "Statistically Oversold (Potential Reversal Zone)" 
                        : "Within Normal Statistical Range"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* History Chart */}
          <div className="h-[400px] bg-card border border-border rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Z-Score History (100 Days)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" tickFormatter={(val) => val.slice(5)} />
                <YAxis stroke="#9CA3AF" domain={[-3, 3]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                />
                <ReferenceLine y={2} stroke="#F87171" strokeDasharray="3 3" label={{ value: '+2σ', fill: '#F87171', fontSize: 12 }} />
                <ReferenceLine y={-2} stroke="#34D399" strokeDasharray="3 3" label={{ value: '-2σ', fill: '#34D399', fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#6B7280" />
                <Line type="monotone" dataKey="z" stroke="#FBBF24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
