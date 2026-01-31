import { useState, useEffect } from 'react';
import { TickerCombobox } from '../components/TickerCombobox';
import { api } from '../lib/api';
import type { DcaData } from '../lib/types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useLanguage } from '../components/LanguageProvider';
import { useTheme } from '../components/ThemeProvider';

export const DcaSimulator = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [data, setData] = useState<DcaData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [ticker, setTicker] = useState('^IXIC');
  const [startDate, setStartDate] = useState('2021-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(1000);
  const [frequency, setFrequency] = useState('monthly');

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const priceColor = isDark ? "#e5e5e5" : "#4b5563";

  const handleSearch = (selectedTicker: string = ticker) => {
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
  };

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

      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Time Period */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border pb-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Period Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('start_date')}</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="w-full h-11 bg-background border border-input rounded-lg px-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
                />
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

          {/* Right: Investment Params */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border pb-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Investment Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('amount')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(Number(e.target.value))} 
                    className="w-full h-11 bg-background border border-input rounded-lg pl-7 pr-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('freq')}</label>
                <select 
                  value={frequency} 
                  onChange={e => setFrequency(e.target.value)} 
                  className="w-full h-11 bg-background border border-input rounded-lg px-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="daily">{t('daily')}</option>
                  <option value="weekly">{t('weekly')}</option>
                  <option value="monthly">{t('monthly')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button 
            onClick={() => handleSearch()} 
            disabled={loading} 
            className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
          >
            {loading ? 'Running Simulation...' : t('analyze')}
          </button>
        </div>
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
                {/* Secondary YAxis for Price - Scale to data range (dataMin/dataMax) to fill height */}
                <YAxis yAxisId="right" orientation="right" domain={['dataMin', 'dataMax']} hide={true} />
                <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', borderRadius: '12px'}} formatter={(value: any, name: any) => [name === 'Actual Price' ? `$${value}` : `$${(value || 0).toLocaleString()}`, name]} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" name="Portfolio Value" strokeWidth={2} />
                <Area yAxisId="left" type="step" dataKey="invested" stroke="#22c55e" strokeDasharray="5 5" fill="none" name="Invested Capital" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="price" stroke={priceColor} fill="none" strokeOpacity={0.5} name="Actual Price" strokeWidth={1} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};