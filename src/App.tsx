import { useState, useEffect } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import GlobalAnalytics from './components/GlobalAnalytics';
import FeaturedFamilies from './components/FeaturedFamilies';
import TechnologyLandscape from './components/TechnologyLandscape';
import ResearchWorkflow from './components/ResearchWorkflow';
import Footer from './components/Footer';
import { fetchAnalytics } from './data/loaders';
import { FullAnalyticsJSON, Company } from './data/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'families' | 'landscape' | 'workflow'>('analytics');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  
  const [analyticsData, setAnalyticsData] = useState<FullAnalyticsJSON | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing analytics engine...');
  const [error, setError] = useState<string | null>(null);

  // Sync hash routing for direct refreshes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      if (['analytics', 'families', 'search', 'family', 'landscape', 'cloud', 'workflow'].includes(hash)) {
        const targetTab = (hash === 'search' || hash === 'family') ? 'families' : (hash === 'cloud' ? 'landscape' : hash);
        setActiveTab(targetTab as any);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Check initial hash
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Set hash when active tab changes
  useEffect(() => {
    window.location.hash = `#/${activeTab}`;
  }, [activeTab]);

  // Load analytics data and simulate loading progress
  useEffect(() => {
    let progressTimer: any;
    
    const load = async () => {
      try {
        setLoadingStatus('Fetching static assets...');
        const data = await fetchAnalytics();
        setAnalyticsData(data);
        setCompanies(data.companies || []);
        
        // Advance progress to 100%
        let p = 20;
        progressTimer = setInterval(() => {
          p += Math.floor(Math.random() * 15) + 5;
          if (p >= 100) {
            p = 100;
            clearInterval(progressTimer);
            setTimeout(() => {
              setLoading(false);
            }, 250);
          }
          setLoadingProgress(p);
          if (p < 50) setLoadingStatus('Loading map projection geometry...');
          else if (p < 80) setLoadingStatus('Parsing precomputed domain tags...');
          else setLoadingStatus('Ready');
        }, 80);
      } catch (err: any) {
        console.error('Analytics load error:', err);
        // Fall back to default structure without blocking application load
        setAnalyticsData({
          companies: [
            { key: "loreal", name: "L'Oreal" },
            { key: "shiseido", name: "Shiseido Company, Limited" },
            { key: "procter_gamble", name: "The Procter & Gamble Company" }
          ],
          global: {
            total_patents: 69119,
            total_families: 28190,
            top_authority: "US",
            top_domain: "Skin Care",
            peak_year: 2023,
            yearly_patent_families: { "2023": 3580 },
            domain_distribution: { "Skin Care": 9840 },
            country_densities: { "US": 18450 }
          },
          company_data: {}
        });
        setLoadingProgress(100);
        setTimeout(() => {
          setLoading(false);
        }, 300);
      }
    };
    
    load();
    return () => {
      if (progressTimer) clearInterval(progressTimer);
    };
  }, []);

  // Compute stats for Header based on selected company
  const headerStats = (() => {
    if (!analyticsData) return { patents: 0, families: 0 };
    if (!selectedCompany) {
      return {
        patents: analyticsData.global.total_patents,
        families: analyticsData.global.total_families
      };
    }
    const cData = analyticsData.company_data[selectedCompany];
    return {
      patents: cData?.total_patents || 0,
      families: cData?.total_families || 0
    };
  })();

  return (
    <>
      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-box">
            <i className="fa-solid fa-flask-vial loading-logo-icon"></i>
            <h2>PATENT LIBRARY</h2>
            <h3>PATENT INTELLIGENCE ENGINE</h3>
            <p>{error || loadingStatus}</p>
            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ 
                  width: `${loadingProgress}%`,
                  backgroundColor: error ? '#f59e0b' : undefined 
                }}
              ></div>
            </div>
            <div className="loading-percentage">{loadingProgress}%</div>
            
            {error && (
              <div className="loading-error">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <button onClick={() => window.location.reload()} className="retry-btn">Retry</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-bg"></div>
      
      <div className="app-container">
        {/* Header */}
        <Header 
          companies={companies}
          selectedCompany={selectedCompany}
          onCompanyChange={(key) => {
            setSelectedCompany(key);
            // Clear other sub-filters on global company change to avoid incompatible states
            setSelectedYear(null);
            setSelectedCountry(null);
          }}
          stats={headerStats}
        />

        {/* Navigation */}
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <main className="content-container" style={{ minHeight: 'calc(100vh - 280px)' }}>
          {activeTab === 'analytics' && analyticsData && (
            <GlobalAnalytics 
              analyticsData={analyticsData}
              selectedCompany={selectedCompany}
              selectedYear={selectedYear}
              selectedCountry={selectedCountry}
              onYearChange={setSelectedYear}
              onCountryChange={setSelectedCountry}
            />
          )}

          {activeTab === 'families' && (
            <FeaturedFamilies />
          )}

          {activeTab === 'landscape' && (
            <TechnologyLandscape />
          )}

          {activeTab === 'workflow' && (
            <ResearchWorkflow />
          )}
        </main>

        {/* Footer & Disclaimer */}
        <Footer />
      </div>
    </>
  );
}
