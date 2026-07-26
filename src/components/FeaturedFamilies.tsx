import { useState, useEffect, useMemo } from 'react';
import { fetchFamiliesIndex, fetchFamilyDetails } from '../data/loaders';
import { PatentFamilyIndexItem, PatentFamily, GraphNode } from '../data/types';
import FamilyNetwork from './FamilyNetwork';

export default function FeaturedFamilies() {
  const [families, setFamilies] = useState<PatentFamilyIndexItem[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [familyDetails, setFamilyDetails] = useState<PatentFamily | null>(null);
  
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerData, setDrawerData] = useState<GraphNode | null>(null);

  // Load index list
  useEffect(() => {
    const getList = async () => {
      try {
        const list = await fetchFamiliesIndex();
        setFamilies(list);
        if (list.length > 0) {
          setSelectedFamilyId(list[0].familyPublicId);
        }
      } catch (err: any) {
        console.error(err);
        setError('Failed to load featured families list.');
      } finally {
        setLoadingList(false);
      }
    };
    getList();
  }, []);

  // Compute unique companies list
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    families.forEach(f => set.add(f.company));
    return Array.from(set).sort();
  }, [families]);

  // Filtered families based on search and company dropdown
  const filteredFamilies = useMemo(() => {
    return families.filter(f => {
      const matchCompany = !selectedCompanyFilter || f.company === selectedCompanyFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || f.displayName.toLowerCase().includes(q) || f.representative.publicationNumber.toLowerCase().includes(q) || f.familyPublicId.toLowerCase().includes(q);
      return matchCompany && matchQuery;
    });
  }, [families, selectedCompanyFilter, searchQuery]);

  // Load details on selection change
  useEffect(() => {
    if (!selectedFamilyId) return;

    const getDetails = async () => {
      setLoadingDetails(true);
      try {
        const details = await fetchFamilyDetails(selectedFamilyId);
        setFamilyDetails(details);
      } catch (err: any) {
        console.error(err);
        setFamilyDetails(null);
      } finally {
        setLoadingDetails(false);
      }
    };
    getDetails();
  }, [selectedFamilyId]);

  const handleNodeClick = (node: GraphNode) => {
    setDrawerData(node);
    setDrawerOpen(true);
  };

  if (loadingList) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', color: 'var(--accent-blue)' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginRight: '10px' }}></i>
        <span>Loading patent families portfolio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '30px', color: 'var(--color-warning)', textAlign: 'center' }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <section className="tab-content active" style={{ display: 'flex', flexDirection: 'row', gap: '20px', flexWrap: 'wrap' }}>
      
      {/* Left panel: Families List */}
      <div 
        className="results-panel" 
        style={{ 
          flex: '0 0 400px', 
          background: 'var(--glass-bg)', 
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--border-radius-md)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: 'calc(100vh - 260px)',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.1rem', margin: 0 }}>
            <i className="fa-solid fa-diagram-project" style={{ color: 'var(--accent-blue)', marginRight: '8px' }}></i> Patent Families ({filteredFamilies.length})
          </h3>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}></i>
            <input 
              type="text" 
              placeholder="Search title, pub#, family ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--glass-border)',
                borderRadius: '6px',
                color: 'var(--text-bright)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </div>

          <select
            value={selectedCompanyFilter}
            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'var(--text-bright)',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          >
            <option value="">All Companies ({companyOptions.length})</option>
            {companyOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* List items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          {filteredFamilies.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.8rem' }}>
              No patent families match the filter criteria.
            </div>
          ) : (
            filteredFamilies.map((fam) => (
              <div 
                key={fam.familyPublicId}
                onClick={() => setSelectedFamilyId(fam.familyPublicId)}
                style={{
                  background: selectedFamilyId === fam.familyPublicId ? 'rgba(59, 130, 246, 0.14)' : 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid',
                  borderColor: selectedFamilyId === fam.familyPublicId ? 'var(--accent-blue)' : 'var(--glass-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                className="family-list-card"
              >
                <h4 style={{ color: 'var(--text-bright)', fontSize: '0.9rem', marginBottom: '6px', fontFamily: 'Outfit, sans-serif', fontWeight: 600, lineHeight: '1.3' }}>
                  {fam.displayName}
                </h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div>Assignee: <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{fam.company}</span></div>
                  <div>Primary Pub: <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>{fam.representative.publicationNumber}</span></div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px', color: 'var(--text-muted)' }}>
                    <span><i className="fa-solid fa-calendar-days"></i> {fam.priorityYear || 'N/A'}</span>
                    <span><i className="fa-solid fa-network-wired"></i> Size: {fam.familySize}</span>
                    <span><i className="fa-solid fa-globe"></i> Jurisdictions: {fam.jurisdictionCount}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Details view */}
      <div 
        className="graph-panel" 
        style={{ 
          flex: '1 1 500px', 
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--border-radius-md)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 260px)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {loadingDetails ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: '1', color: 'var(--accent-blue)', flexDirection: 'column', gap: '10px' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem' }}></i>
            <span>Loading family network structure...</span>
          </div>
        ) : familyDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: '1', height: '100%' }}>
            
            {/* Top header details */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {familyDetails.company} &bull; Priority Year: {familyDetails.priorityYear || 'N/A'}
                  </div>
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.3rem', margin: '4px 0 6px 0' }}>
                    {familyDetails.displayName}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Representative: <strong style={{ color: 'var(--text-bright)' }}>{familyDetails.representative.publicationNumber}</strong> - {familyDetails.representative.title}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 14px', borderRadius: '6px', textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>{familyDetails.members.length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>GLOBAL MEMBERS</div>
                </div>
              </div>
              
              <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--accent-blue)', lineHeight: '1.4' }}>
                <strong>Technology Overview:</strong> {familyDetails.summary}
              </div>
            </div>

            {/* D3 Graph container */}
            <div style={{ flex: '1', minHeight: '380px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div 
                style={{ 
                  padding: '8px 24px', 
                  borderBottom: '1px solid rgba(255,255,255,0.03)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.05)',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)'
                }}
              >
                <span>Interactive Equivalents & Citation Network (Click node to inspect)</span>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: 'var(--accent-blue)', borderRadius: '50%' }}></span> Core</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: 'var(--accent-purple)', borderRadius: '50%' }}></span> Member</span>
                </div>
              </div>

              <div style={{ flex: '1', width: '100%', minHeight: '320px' }}>
                <FamilyNetwork family={familyDetails} onNodeSelect={handleNodeClick} />
              </div>
            </div>

            {/* Bottom: Members table */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', maxHeight: '180px', overflowY: 'auto' }}>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--text-bright)', marginBottom: '8px', fontWeight: 600 }}>
                <i className="fa-solid fa-list-ul" style={{ color: 'var(--accent-blue)', marginRight: '6px' }}></i> Family Lineage Members ({familyDetails.members.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {familyDetails.members.map((m, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem' }}>
                    <div style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{m.publicationNumber} ({m.jurisdiction})</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{m.kind}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : null}

        {/* Drawer for node details */}
        <div 
          className={`family-drawer ${drawerOpen ? 'open' : ''}`}
          style={{
            position: 'absolute',
            top: 0,
            right: drawerOpen ? 0 : '-360px',
            width: '340px',
            height: '100%',
            background: 'rgba(10, 14, 23, 0.95)',
            backdropFilter: 'blur(12px)',
            borderLeft: '1px solid var(--glass-border)',
            padding: '20px',
            boxSizing: 'border-box',
            transition: 'right 0.3s ease',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.5)'
          }}
        >
          {drawerData && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="drawer-badge" style={{ background: 'rgba(0,210,255,0.1)', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                  {drawerData.is_representative ? 'REPRESENTATIVE PUBLICATION' : 'FAMILY EQUIVALENT'}
                </span>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  &times;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Publication Number</h3>
                  <p style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '1.1rem' }}>{drawerData.id}</p>
                </div>

                <div className="drawer-divider" style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>

                <div>
                  <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Title</h3>
                  <p style={{ color: 'var(--text-bright)', fontSize: '0.85rem', lineHeight: '1.4' }}>{drawerData.title}</p>
                </div>

                <div className="drawer-divider" style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>

                <div>
                  <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Assignee</h3>
                  <p style={{ fontWeight: 600, color: 'var(--accent-blue)', fontSize: '0.9rem' }}>{drawerData.assignee}</p>
                </div>

                <div className="drawer-divider" style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>

                <div>
                  <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Abstract Description</h3>
                  <div 
                    style={{ 
                      fontSize: '0.78rem', 
                      color: 'var(--text-secondary)', 
                      lineHeight: '1.5',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    Cosmetic active composition for targeted dermal delivery and active stabilization. Includes priority filing claims, jurisdiction equivalents, and full claims structure mapped across global patent offices.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

    </section>
  );
}
