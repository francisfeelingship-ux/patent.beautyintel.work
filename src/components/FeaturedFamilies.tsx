import { useState, useEffect } from 'react';
import { fetchFamiliesIndex, fetchFamilyDetails } from '../data/loaders';
import { PatentFamily, GraphNode } from '../data/types';
import FamilyNetwork from './FamilyNetwork';

export default function FeaturedFamilies() {
  const [families, setFamilies] = useState<any[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [familyDetails, setFamilyDetails] = useState<PatentFamily | null>(null);
  
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerData, setDrawerData] = useState<GraphNode | null>(null);

  // Fetch paginated families from live D1 database
  useEffect(() => {
    let isSubscribed = true;
    const getList = async () => {
      setLoadingList(true);
      setError(null);
      try {
        const res = await fetchFamiliesIndex({
          page,
          limit: 20,
          company: selectedCompanyFilter || undefined,
          q: searchQuery || undefined,
        });

        if (!isSubscribed) return;

        setFamilies(res.families || []);
        setTotalPages(res.total_pages || 1);
        setTotalCount(res.total || 0);

        if (res.families && res.families.length > 0) {
          // If current selected is not in list, select first
          const exists = res.families.some((f: any) => f.family_id === selectedFamilyId || f.public_id === selectedFamilyId);
          if (!exists) {
            setSelectedFamilyId(res.families[0].family_id || res.families[0].public_id || '');
          }
        } else {
          setSelectedFamilyId('');
          setFamilyDetails(null);
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        console.error(err);
        setError('Failed to query Cloudflare D1 database.');
      } finally {
        if (isSubscribed) setLoadingList(false);
      }
    };

    const timer = setTimeout(getList, 300);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [page, selectedCompanyFilter, searchQuery]);

  // Load details on selection change
  useEffect(() => {
    if (!selectedFamilyId) return;

    let isSubscribed = true;
    const getDetails = async () => {
      setLoadingDetails(true);
      try {
        const details = await fetchFamilyDetails(selectedFamilyId);
        if (isSubscribed) setFamilyDetails(details);
      } catch (err: any) {
        console.error(err);
        if (isSubscribed) setFamilyDetails(null);
      } finally {
        if (isSubscribed) setLoadingDetails(false);
      }
    };
    getDetails();

    return () => {
      isSubscribed = false;
    };
  }, [selectedFamilyId]);

  const handleNodeClick = (node: GraphNode) => {
    setDrawerData(node);
    setDrawerOpen(true);
  };

  const COMPANY_OPTIONS = [
    { key: '', name: 'All Companies' },
    { key: 'loreal', name: "L'Oreal" },
    { key: 'shiseido', name: 'Shiseido Company, Limited' },
    { key: 'procter_gamble', name: 'The Procter & Gamble Company' },
    { key: 'unilever', name: 'Unilever' },
    { key: 'henkel', name: 'Henkel' },
    { key: 'amorepacific', name: 'Amorepacific' },
    { key: 'kao', name: 'KAO Corp' },
    { key: 'kenvue', name: 'Kenvue' },
    { key: 'colgate_palmolive', name: 'Colgate-Palmolive Company' },
    { key: 'basf', name: 'BASF' },
  ];

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
            <i className="fa-solid fa-database" style={{ color: 'var(--accent-blue)', marginRight: '8px' }}></i> Live D1 Patent Search ({totalCount.toLocaleString()})
          </h3>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}></i>
            <input 
              type="text" 
              placeholder="Live D1 text search title, abstract, pub#..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
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
            onChange={(e) => {
              setSelectedCompanyFilter(e.target.value);
              setPage(1);
            }}
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
            {COMPANY_OPTIONS.map(c => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* List items */}
        {loadingList ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', color: 'var(--accent-blue)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.5rem', marginRight: '8px' }}></i>
            <span>Executing D1 query...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '15px', color: 'var(--color-warning)', textAlign: 'center', fontSize: '0.8rem' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.2rem', marginBottom: '6px' }}></i>
            <p>{error}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {families.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.8rem' }}>
                No patent families match the search query in D1 database.
              </div>
            ) : (
              families.map((fam: any) => {
                const fid = fam.family_id || fam.public_id;
                const isSelected = selectedFamilyId === fid;
                return (
                  <div 
                    key={fid}
                    onClick={() => setSelectedFamilyId(fid)}
                    style={{
                      background: isSelected ? 'rgba(59, 130, 246, 0.14)' : 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent-blue)' : 'var(--glass-border)',
                      borderRadius: 'var(--border-radius-sm)',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    className="family-list-card"
                  >
                    <h4 style={{ color: 'var(--text-bright)', fontSize: '0.88rem', marginBottom: '6px', fontFamily: 'Outfit, sans-serif', fontWeight: 600, lineHeight: '1.3' }}>
                      {fam.display_title || fam.displayName}
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div>Assignee: <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{fam.company_name || fam.company}</span></div>
                      <div>Primary Rep: <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>{fam.public_id || fam.family_id}</span></div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', color: 'var(--text-muted)' }}>
                        <span><i className="fa-solid fa-calendar-days"></i> {fam.priority_date ? fam.priority_date.slice(0, 4) : 'N/A'}</span>
                        <span><i className="fa-solid fa-network-wired"></i> Members: {fam.member_count}</span>
                        <span><i className="fa-solid fa-globe"></i> Off: {fam.jurisdiction_count}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button 
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '4px',
                    color: page <= 1 ? 'var(--text-muted)' : 'var(--text-bright)',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  &laquo; Prev
                </button>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Page {page} of {totalPages}
                </span>

                <button 
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '4px',
                    color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-bright)',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Next &raquo;
                </button>
              </div>
            )}
          </div>
        )}
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
            <span>Fetching live D1 family graph & members...</span>
          </div>
        ) : familyDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: '1', height: '100%' }}>
            
            {/* Top header details */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {(familyDetails as any).company_name || (familyDetails as any).company} &bull; Priority Date: {(familyDetails as any).priority_date || 'N/A'}
                  </div>
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.3rem', margin: '4px 0 6px 0' }}>
                    {(familyDetails as any).display_title || (familyDetails as any).displayName}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Representative ID: <strong style={{ color: 'var(--text-bright)' }}>{(familyDetails as any).public_id || (familyDetails as any).family_id}</strong>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 14px', borderRadius: '6px', textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>{(familyDetails.members || []).length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>D1 PUBLICATIONS</div>
                </div>
              </div>
              
              {(familyDetails as any).display_abstract && (
                <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--accent-blue)', lineHeight: '1.4' }}>
                  {(familyDetails as any).display_abstract}
                </div>
              )}
            </div>

            {/* D3 Family Network Visualization */}
            <div style={{ flex: '1', position: 'relative', minHeight: '380px' }}>
              <FamilyNetwork 
                family={familyDetails} 
                onNodeSelect={handleNodeClick}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: '1', color: 'var(--text-muted)' }}>
            Select a family from the D1 database list on the left to inspect its lineage.
          </div>
        )}
      </div>

      {/* Detail Drawer overlay when a node in graph is clicked */}
      {drawerOpen && drawerData && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '360px',
            height: '100%',
            background: '#0d1117',
            borderLeft: '1px solid var(--accent-blue)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
            zIndex: 100,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', fontWeight: 700, textTransform: 'uppercase' }}>
              Publication Inspector
            </span>
            <i 
              className="fa-solid fa-xmark" 
              onClick={() => setDrawerOpen(false)}
              style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.1rem' }}
            ></i>
          </div>

          <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.05rem', margin: 0 }}>
            {drawerData.label || drawerData.id}
          </h3>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>Title: <span style={{ color: 'var(--text-bright)' }}>{drawerData.title}</span></div>
            <div>Authority: <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{drawerData.country || drawerData.type}</span></div>
            <div>Assignee: <span>{drawerData.assignee || 'Standard'}</span></div>
          </div>
        </div>
      )}
    </section>
  );
}
