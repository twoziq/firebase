import { useState, useEffect } from 'react';
import { TickerCombobox } from '../components/TickerCombobox';
import { api } from '../lib/api';
import type { DcaData } from '../lib/types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useLanguage } from '../components/LanguageProvider';

export const DcaSimulator = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<DcaData | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form States
  const [ticker, setTicker] = useState('^IXIC');
  const [startDate, setStartDate] = useState('2021-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(1000);
  const [frequency, setFrequency] = useState('monthly');

  const handleSearch = (selectedTicker: string = ticker) => {
    setLoading(true);
    // Update local ticker state when searching via combobox
    if (selectedTicker !== ticker) setTicker(selectedTicker);

    api.get<DcaData>(`/api/dca?ticker=${selectedTicker}&start_date=${startDate}&end_date=${endDate}&amount=${amount}&frequency=${frequency}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    handleSearch('^IXIC');
  }, []);

  const chartData = data?.dates.map((date, i) => ({
    date,
    invested: data.invested_curve[i],
    value: data.valuation_curve[i]
  })) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('dca')}</h1>
          <p className="text-muted-foreground">{t('amount')}: ${amount.toLocaleString()} / {t(frequency)}</p>
        </div>
        <TickerCombobox onSearch={handleSearch} isLoading={loading} placeholder={t('ticker_placeholder')} initialValue={ticker} />
      </div>

      {/* Input Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">{t('start_date')}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">{t('end_date')}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">{t('amount')}</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">{t('freq')}</label>
          <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm">
            <option value="daily">{t('daily')}</option>
            <option value="weekly">{t('weekly')}</option>
            <option value="monthly">{t('monthly')}</option>
          </select>
        </div>
        <button onClick={() => handleSearch()} className="md:col-span-4 bg-primary text-primary-foreground py-2 rounded-lg font-bold hover:opacity-90 transition-opacity">
          {t('analyze')}
        </button>
      </div>

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 bg-card border border-border rounded-xl shadow-sm">
              <p className="text-muted-foreground text-sm">{t('total_invested')}</p>
              <p className="text-2xl font-bold text-foreground">${data.total_invested.toLocaleString()}</p>
            </div>
            <div className="p-6 bg-card border border-border rounded-xl shadow-sm">
              <p className="text-muted-foreground text-sm">{t('final_value')}</p>
              <p className={`text-2xl font-bold ${data.final_value >= data.total_invested ? 'text-green-500' : 'text-red-500'}`}>
                ${data.final_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-6 bg-card border border-border rounded-xl shadow-sm">
              <p className="text-muted-foreground text-sm">{t('return_pct')}</p>
              <p className={`text-2xl font-bold ${data.return_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.return_pct > 0 ? '+' : ''}{data.return_pct.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="h-[450px] bg-card border border-border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickFormatter={(val) => val.slice(2)} minTickGap={50} />
                <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: any) => [`$${(value || 0).toLocaleString()}`, '']}
                />
                <Legend />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" name="Portfolio Value" strokeWidth={2} />
                <Area type="step" dataKey="invested" stroke="#9ca3af" strokeDasharray="5 5" fill="none" name="Invested Capital" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
