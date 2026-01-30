import { TrendingUp, Activity, PieChart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const FeatureCard = ({ icon: Icon, title, description, to }: { icon: any, title: string, description: string, to: string }) => (
  <Link 
    to={to} 
    className="block p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-all hover:bg-gray-800/50 group"
  >
    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
      <Icon className="text-primary" size={24} />
    </div>
    <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-primary transition-colors">{title}</h3>
    <p className="text-gray-400 text-sm mb-4">{description}</p>
    <div className="flex items-center text-primary text-sm font-medium">
      Start Analysis <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
    </div>
  </Link>
);

export const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to Twoziq</h1>
        <p className="text-gray-400">Advanced financial analysis powered by Monte Carlo simulations and Quant logic.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureCard 
          icon={TrendingUp}
          title="Trend Analysis"
          description="Analyze log-linear trends and standard deviation bands to identify overbought/oversold conditions."
          to="/trend"
        />
        <FeatureCard 
          icon={Activity}
          title="Market Simulation"
          description="Run Monte Carlo simulations to project future price paths and calculate win rates."
          to="/simulation"
        />
        <FeatureCard 
          icon={PieChart}
          title="Quant Scoring"
          description="Evaluate stocks using statistical Z-scores and historical return percentile rankings."
          to="/quant"
        />
      </div>

      <div className="mt-12 p-6 bg-gray-900/50 rounded-xl border border-gray-800">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Start Guide</h2>
        <ul className="space-y-3 text-gray-400">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-300">1</span>
            Select an analysis tool from the sidebar or cards above.
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-300">2</span>
            Enter a valid US stock ticker (e.g., AAPL, TSLA, SPY).
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-300">3</span>
            View real-time generated charts and statistical data.
          </li>
        </ul>
      </div>
    </div>
  );
};
