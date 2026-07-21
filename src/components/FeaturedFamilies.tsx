import { useState, useEffect } from 'react';
import { fetchFamiliesIndex, fetchFamilyDetails } from '../data/loaders';
import { PatentFamilyIndexItem, PatentFamily, GraphNode } from '../data/types';
import FamilyNetwork from './FamilyNetwork';

export default function FeaturedFamilies() {
  const [families, setFamilies] = useState<PatentFamilyIndexItem[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [familyDetails, setFamilyDetails] = useState<PatentFamily | null>(null);
  
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
        <span>Loading families list...</span>
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
    <section className="tab-content active" style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
      
      {/* Left panel: Families List */}
      <div 
        className="results-panel" 
        style={{ 
          flex: '0 0 380px', 
          background: 'var(--glass-bg)', 
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--border-radius-md)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxHeight: 'calc(100vh - 280px)',
          overflowY: 'auto'
        }}
      >
        <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          Featured Families
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {families.map((fam) => (
            <div 
              key={fam.familyPublicId}
              onClick={() => setSelectedFamilyId(fam.familyPublicId)}
              style={{
                background: selectedFamilyId === fam.familyPublicId ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: '1px solid',
                borderColor: selectedFamilyId === fam.familyPublicId ? 'var(--accent-blue)' : 'var(--glass-border)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all var(--transition-speed) ease'
              }}
              className="family-list-card"
            >
              <h4 style={{ color: 'var(--text-bright)', fontSize: '0.92rem', marginBottom: '6px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                {fam.displayName}
              </h4>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexFlow: 'column', gap: '4px' }}>
                <div>Assignee: <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{fam.company}</span></div>
                <div>Primary Pub: <span style={{ color: 'var(--text-bright)' }}>{fam.representative.publicationNumber}</span></div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', color: 'var(--text-muted)' }}>
                  <span><i className="fa-solid fa-calendar-days"></i> {fam.priorityYear || 'N/A'}</span>
                  <span><i className="fa-solid fa-network-wired"></i> Size: {fam.familySize}</span>
                  <span><i className="fa-solid fa-globe"></i> Jurisdictions: {fam.jurisdictionCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: Details view */}
      <div 
        className="graph-panel" 
        style={{ 
          flex: '1', 
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--border-radius-md)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 280px)',
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
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.35rem', margin: '4px 0 6px 0' }}>
                    {familyDetails.displayName}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Representative: <strong style={{ color: 'var(--text-bright)' }}>{familyDetails.representative.publicationNumber}</strong> - {familyDetails.representative.title}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '6px', textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>{familyDetails.members.length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>GLOBAL MEMBERS</div>
                </div>
              </div>
              
              <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--accent-blue)', lineHeight: '1.4' }}>
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: 'var(--accent-pink)', borderRadius: '50%' }}></span> Equivalent</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: 'var(--accent-purple)', borderRadius: '50%' }}></span> Citation</span>
                </div>
              </div>
              
              {/* Embed D3 Network */}
              <FamilyNetwork family={familyDetails} onNodeSelect={handleNodeClick} />
            </div>

            {/* Members table */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
              <h4 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '0.9rem', marginBottom: '8px' }}>
                Family Members list
              </h4>
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 8px' }}>Publication Number</th>
                      <th style={{ padding: '6px 8px' }}>Office</th>
                      <th style={{ padding: '6px 8px' }}>Kind</th>
                      <th style={{ padding: '6px 8px' }}>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyDetails.members.map((m) => (
                      <tr 
                        key={m.publicationNumber} 
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-primary)' }}
                        className="member-row"
                        onClick={() => {
                          const matchingNode = familyDetails.nodes.find(n => n.id === m.publicationNumber);
                          if (matchingNode) handleNodeClick(matchingNode);
                        }}
                      >
                        <td style={{ padding: '6px 8px', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600 }}>{m.publicationNumber}</td>
                        <td style={{ padding: '6px 8px' }}>{m.jurisdiction}</td>
                        <td style={{ padding: '6px 8px' }}><span className={`kind-badge ${m.kind}`}>{m.kind.toUpperCase()}</span></td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{m.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: '1', color: 'var(--text-secondary)' }}>
            <span>Select a family on the left to explore network details.</span>
          </div>
        )}

        {/* Drawer overlay */}
        {drawerOpen && (
          <div 
            className="drawer-overlay" 
            style={{ display: 'block', opacity: 1 }}
            onClick={() => setDrawerOpen(false)}
          ></div>
        )}

        {/* Node detail drawer */}
        <div 
          className={`detail-drawer ${drawerOpen ? 'open' : ''}`}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '380px',
            height: '100%',
            background: '#0b101b',
            borderLeft: '1px solid var(--glass-border)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.8)',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {drawerData && (
            <>
              <div 
                className="drawer-header"
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.01)'
                }}
              >
                <div 
                  className="drawer-badge"
                  style={{
                    background: 'rgba(0, 210, 255, 0.1)',
                    border: '1px solid var(--accent-blue)',
                    color: 'var(--accent-blue)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                    fontWeight: 700
                  }}
                >
                  {drawerData.id}
                </div>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              
              <div className="drawer-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: '1' }}>
                <div>
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.2rem', fontWeight: 700, lineHeight: '1.4', marginBottom: '4px' }}>
                    {drawerData.title}
                  </h2>
                </div>
                
                <div className="drawer-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="meta-item">
                    <span className="meta-lbl" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Country</span>
                    <span className="meta-val" style={{ color: 'var(--text-bright)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <i className="fa-solid fa-location-dot" style={{ color: 'var(--accent-blue)', marginRight: '4px' }}></i> {drawerData.country}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-lbl" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Role Type</span>
                    <span className="meta-val" style={{ color: 'var(--text-bright)', fontSize: '0.85rem', fontWeight: 600 }}>
                      {drawerData.type.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
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
                      fontSize: '0.8rem', 
                      color: 'var(--text-secondary)', 
                      lineHeight: '1.5',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px dashed rgba(255,255,255,0.06)'
                    }}
                  >
                    <i className="fa-solid fa-lock" style={{ marginRight: '6px', color: 'var(--color-warning)' }}></i>
                    Full description, abstracts, claims, and semantic embeddings are omitted in this public demonstration. 
                    Full text retrieval is available in the production Patent Librarian environment.
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
