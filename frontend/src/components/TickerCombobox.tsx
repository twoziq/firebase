import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface TickerComboboxProps {
  onSearch: (ticker: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const PRESETS = [
  { symbol: '^IXIC', name: 'NASDAQ Composite' },
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI', name: 'Dow Jones Industrial' },
  { symbol: '^KS11', name: 'KOSPI Composite' },
  { symbol: 'SCHD', name: 'Schwab US Dividend ETF' },
];

export const TickerCombobox = ({ onSearch, isLoading, placeholder = "Enter symbol (e.g., AAPL)" }: TickerComboboxProps) => {
  const [value, setValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim()) {
      onSearch(value.toUpperCase());
      setIsOpen(false);
    }
  };

  const handleSelect = (symbol: string) => {
    setValue(symbol);
    onSearch(symbol);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-md" ref={wrapperRef}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 text-muted-foreground" size={18} />
          
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full bg-background border border-input rounded-lg py-2 pl-10 pr-10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 p-1 hover:bg-muted rounded-md transition-colors"
          >
            <ChevronDown size={16} className="text-muted-foreground" />
          </button>
        </div>
      </form>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
              Popular Indices
            </div>
            {PRESETS.map((preset) => (
              <button
                key={preset.symbol}
                onClick={() => handleSelect(preset.symbol)}
                className="w-full text-left px-3 py-2.5 hover:bg-accent hover:text-accent-foreground flex items-center justify-between group transition-colors"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{preset.symbol}</span>
                  <span className="text-xs text-muted-foreground">{preset.name}</span>
                </div>
                {value.toUpperCase() === preset.symbol && (
                  <Check size={16} className="text-primary" />
                )}
              </button>
            ))}
            
            {value && !PRESETS.some(p => p.symbol === value.toUpperCase()) && (
              <button
                onClick={() => handleSubmit()}
                className="w-full text-left px-3 py-2.5 hover:bg-accent hover:text-accent-foreground border-t border-border mt-1"
              >
                <span className="text-sm text-foreground">
                  Search for <span className="font-bold text-primary">"{value.toUpperCase()}"</span>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
