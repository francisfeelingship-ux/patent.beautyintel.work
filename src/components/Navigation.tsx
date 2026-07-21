interface NavigationProps {
  activeTab: 'analytics' | 'families' | 'landscape' | 'workflow';
  onTabChange: (tab: 'analytics' | 'families' | 'landscape' | 'workflow') => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="nav-tabs">
      <button 
        className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
        onClick={() => onTabChange('analytics')}
      >
        <i className="fa-solid fa-chart-line"></i> Global Analytics Overview
      </button>
      <button 
        className={`tab-btn ${activeTab === 'families' ? 'active' : ''}`}
        onClick={() => onTabChange('families')}
      >
        <i className="fa-solid fa-diagram-project"></i> Featured Patent Families
      </button>
      <button 
        className={`tab-btn ${activeTab === 'landscape' ? 'active' : ''}`}
        onClick={() => onTabChange('landscape')}
      >
        <i className="fa-solid fa-cube"></i> Technology Landscape
      </button>
      <button 
        className={`tab-btn ${activeTab === 'workflow' ? 'active' : ''}`}
        onClick={() => onTabChange('workflow')}
      >
        <i className="fa-solid fa-robot"></i> Research Workflow
      </button>
    </nav>
  );
}
