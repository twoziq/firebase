import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { TrendAnalysis } from './pages/TrendAnalysis';
import { Simulation } from './pages/Simulation';
import { QuantAnalysis } from './pages/QuantAnalysis';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trend" element={<TrendAnalysis />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/quant" element={<QuantAnalysis />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;