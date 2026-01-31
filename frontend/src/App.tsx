import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { MarketValuation } from './pages/MarketValuation';
import { DcaSimulator } from './pages/DcaSimulator';
import { RiskReturnMap } from './pages/RiskReturnMap';
import { DeepQuantAnalysis } from './pages/DeepQuantAnalysis';
import { ThemeProvider } from './components/ThemeProvider';
import { LanguageProvider } from './components/LanguageProvider';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="twoziq-theme">
      <LanguageProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<MarketValuation />} />
              <Route path="/dca" element={<DcaSimulator />} />
              <Route path="/risk" element={<RiskReturnMap />} />
              <Route path="/deep" element={<DeepQuantAnalysis />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;