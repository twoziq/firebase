import { useState, useEffect, useCallback } from 'react';
import { TickerCombobox } from '../components/TickerCombobox';
import { api } from '../lib/api';
import type { DcaData } from '../lib/types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useLanguage } from '../components/LanguageProvider';

export const DcaSimulator = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<DcaData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [ticker, setTicker] = useState('^IXIC');
  const [startDate, setStartDate] = useState('2021-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(1000);
  const [frequency, setFrequency] = useState('monthly');

  const handleSearch = useCallback((selectedTicker: string = ticker) => {
    setLoading(true);
    if (selectedTicker !== ticker) setTicker(selectedTicker);
    
    console.log(`[DCA] Fetching for ${selectedTicker} from ${startDate} to ${endDate}`);
    api.get(`/api/dca`, {
      params: { 
        ticker: selectedTicker,
        start_date: startDate, 
        end_date: endDate, 
        amount: Number(amount), 
        frequency 
      }
    })
      .then(res => {
        console.log('[DCA] Success:', res.data.ticker);
        setData(res.data);
      })
      .catch(err => {
        const errorDetail = err.response?.data?.detail || err.message;
        console.error(`[DCA] Error: ${JSON.stringify(errorDetail)}`);
        alert(`DCA Analysis failed: ${JSON.stringify(errorDetail)}`);
      })
      .finally(() => setLoading(false));
  }, [ticker, startDate, endDate, amount, frequency]);

  useEffect(() => { handleSearch('^IXIC'); }, []);

  const chartData = data?.dates?.map((date, i) => ({
    date, 
    invested: data.invested_curve[i], 
    value: data.valuation_curve[i],
    price: data.prices?.[i]
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground uppercase">{t('start_date')}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground" />
        </div>
        <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground uppercase">{t('end_date')}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground" />
        </div>
        <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground uppercase">{t('amount')}</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground" />
        </div>
        <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground uppercase">{t('freq')}</label>
          <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground">
            <option value="daily">{t('daily')}</option>
            <option value="weekly">{t('weekly')}</option>
            <option value="monthly">{t('monthly')}</option>
          </select>
        </div>
        <button onClick={() => handleSearch()} disabled={loading} className="md:col-span-4 bg-primary text-primary-foreground py-2 rounded-lg font-bold hover:opacity-90 transition-opacity">
          {loading ? '...' : t('analyze')}
        </button>
      </div>

      {data && !loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 bg-card border border-border rounded-xl shadow-sm"><p className="text-xs text-muted-foreground uppercase font-bold">{t('total_invested')}</p><p className="text-2xl font-black text-foreground">${data.total_invested?.toLocaleString()}</p></div>
            <div className="p-6 bg-card border border-border rounded-xl shadow-sm"><p className="text-xs text-muted-foreground uppercase font-bold">{t('final_value')}</p><p className={`text-2xl font-black ${data.final_value >= data.total_invested ? 'text-green-500' : 'text-red-500'}`}>${data.final_value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></div>
            <div className="p-6 bg-card border border-border rounded-xl shadow-sm"><p className="text-xs text-muted-foreground uppercase font-bold">{t('return_pct')}</p><p className={`text-2xl font-black ${data.return_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>{data.return_pct > 0 ? '+' : ''}{data.return_pct?.toFixed(1)}%</p></div>
          </div>
          <div className="h-[450px] bg-card border border-border rounded-2xl p-6 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickFormatter={(val) => val?.slice(2)} minTickGap={50} />
                <YAxis yAxisId="left" stroke="#9ca3af" fontSize={10} tickFormatter={(val) => `$${val/1000}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={10} tickFormatter={(val) => `$${val}`} hide={false} />
                <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '12px'}} formatter={(value: any, name: string) => [name === 'Actual Price' ? `$${value}` : `$${(value || 0).toLocaleString()}`, name]} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" name="Portfolio Value" strokeWidth={2} />
                <Area yAxisId="left" type="step" dataKey="invested" stroke="#22c55e" strokeDasharray="5 5" fill="none" name="Invested Capital" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="price" stroke="#6b7280" fill="none" strokeOpacity={0.3} name="Actual Price" strokeWidth={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
