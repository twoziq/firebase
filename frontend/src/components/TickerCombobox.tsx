import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface TickerComboboxProps {
  onSearch: (ticker: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  initialValue?: string;
}

const PRESETS = [
  { symbol: '^IXIC', name: 'NASDAQ Composite' },
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI', name: 'Dow Jones Industrial' },
  { symbol: '^KS11', name: 'KOSPI Composite' },
  { symbol: 'SCHD', name: 'Schwab US Dividend ETF' },
];

export const TickerCombobox = ({ onSearch, isLoading, placeholder = "Enter symbol", initialValue = '' }: TickerComboboxProps) => {
  const [value, setValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (initialValue) setValue(initialValue); }, [initialValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim()) { onSearch(value.toUpperCase()); setIsOpen(false); }
  };

  return (
    <div className="relative w-full max-w-md" ref={wrapperRef} style={{ zIndex: 9999 }}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 text-muted-foreground" size={18} />
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={isLoading}
            autoComplete="off"
            className="w-full bg-card border border-input rounded-lg py-2 pl-10 pr-10 text-foreground focus:ring-2 focus:ring-primary !opacity-100"
            style={{ backgroundColor: 'hsl(var(--card))', opacity: 1 }}
          />
          <button type="button" onClick={() => !isLoading && setIsOpen(!isOpen)} className="absolute right-2 p-1 hover:bg-muted rounded-md">
            <ChevronDown size={16} className="text-muted-foreground" />
          </button>
        </div>
      </form>

      {isOpen && !isLoading && (
        <div 
          className="absolute left-0 right-0 z-[10000] mt-2 border border-border rounded-lg shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'hsl(var(--card))', opacity: 1 }}
        >
          <div className="py-1" style={{ backgroundColor: 'hsl(var(--card))' }}>
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50">Presets</div>
            {PRESETS.map((p) => (
              <button key={p.symbol} onClick={() => { setValue(p.symbol); onSearch(p.symbol); setIsOpen(false); }} className="w-full text-left px-3 py-2.5 hover:bg-accent flex items-center justify-between group">
                <div className="flex flex-col"><span className="font-medium text-foreground">{p.symbol}</span><span className="text-xs text-muted-foreground">{p.name}</span></div>
                {value.toUpperCase() === p.symbol && <Check size={16} className="text-primary" />}
              </button>
            ))}
            {value && !PRESETS.some(p => p.symbol === value.toUpperCase()) && (
              <button onClick={() => handleSubmit()} className="w-full text-left px-3 py-2.5 hover:bg-accent border-t border-border">
                Search <span className="font-bold text-primary">"{value.toUpperCase()}"</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};