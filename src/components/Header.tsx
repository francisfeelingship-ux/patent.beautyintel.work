import { Company } from '../data/types';

interface HeaderProps {
  companies: Company[];
  selectedCompany: string;
  onCompanyChange: (key: string) => void;
  stats: { patents: number; families: number };
}

export default function Header({ companies, selectedCompany, onCompanyChange, stats }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-logo" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <i className="fa-solid fa-flask-vial logo-icon"></i>
        <div className="logo-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 id="header-main-title" style={{ margin: 0 }}>PATENT LIBRARY</h1>
            <span 
              className="public-demo-badge"
              style={{
                background: 'rgba(0, 210, 255, 0.15)',
                border: '1px solid #00d2ff',
                color: '#00d2ff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}
            >
              PROD ENGINE
            </span>
          </div>
          <span id="header-sub-title">GLOBAL ANALYTICS & INTELLIGENCE</span>
        </div>
      </div>
      
      {/* Global Company Filter */}
      <div className="header-filters">
        <div className="filter-dropdown-wrapper">
          <i className="fa-solid fa-building filter-icon"></i>
          <select 
            id="company-select" 
            className="glass-select"
            value={selectedCompany}
            onChange={(e) => onCompanyChange(e.target.value)}
          >
            <option value="">All Companies (83,438 Patents)</option>
            {companies.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Stats display */}
      <div className="header-stats">
        <div className="stat-bubble">
          <span className="stat-num" id="stat-total-patents">
            {stats.patents.toLocaleString()}
          </span>
          <span className="stat-label">Total Patents</span>
        </div>
        <div className="stat-bubble">
          <span className="stat-num" id="stat-total-families">
            {stats.families.toLocaleString()}
          </span>
          <span className="stat-label">Patent Families</span>
        </div>
      </div>
    </header>
  );
}
