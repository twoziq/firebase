import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Wallet, Map as MapIcon, LineChart, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { ModeToggle } from './ModeToggle';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from './LanguageProvider';

interface LayoutProps {
  children: React.ReactNode;
}

const SidebarItem = ({ icon: Icon, label, to, active }: { icon: any, label: string, to: string, active: boolean }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
      active 
        ? "bg-primary/10 text-primary" 
        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
    )}
  >
    <Icon size={20} className={cn("transition-colors", active ? "text-primary" : "text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100")} />
    <span className="font-medium">{label}</span>
  </Link>
);

export const Layout = ({ children }: LayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { icon: BarChart3, label: t('market'), path: '/' },
    { icon: Wallet, label: t('dca'), path: '/dca' },
    { icon: MapIcon, label: t('risk'), path: '/risk' },
    { icon: LineChart, label: t('deep'), path: '/deep' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
          !isSidebarOpen && "-translate-x-full lg:hidden"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Twoziq
            </h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <SidebarItem 
                key={item.path} 
                icon={item.icon} 
                label={item.label} 
                to={item.path} 
                active={location.pathname === item.path}
              />
            ))}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">System Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-foreground">API Operational</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-muted-foreground hover:text-foreground lg:hidden"
            >
              <Menu size={24} />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
             <LanguageToggle />
             <ModeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
