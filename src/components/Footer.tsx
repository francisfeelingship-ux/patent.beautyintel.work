export default function Footer() {
  return (
    <footer 
      className="app-footer"
      style={{
        marginTop: '30px',
        padding: '24px 28px',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--border-radius-md)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px var(--glass-shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)'
      }}
    >
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div style={{ flex: '1 1 300px' }}>
          <h4 style={{ color: 'var(--text-bright)', marginBottom: '6px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
            Patent Intelligence Engine
          </h4>
          <p style={{ lineHeight: '1.5' }}>
            Interactive analytics, 3D technology landscape clustering, and global patent family priority networks for beauty and personal care R&D.
          </p>
        </div>
        
        <div style={{ flex: '1 1 300px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '20px' }}>
          <h4 style={{ color: 'var(--accent-blue)', marginBottom: '6px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
            Global Coverage & Authorities
          </h4>
          <p style={{ lineHeight: '1.5', fontSize: '0.78rem' }}>
            Comprehensive coverage across 83,438 patents and 23,361 parent family lineages spanning EP, US, JP, CN, KR, DE, FR, GB, and WIPO authorities.
          </p>
        </div>
      </div>
      
      <div 
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '12px',
          textAlign: 'center',
          fontSize: '0.72rem',
          color: 'var(--text-muted)'
        }}
      >
        &copy; {new Date().getFullYear()} BeautyIntel Patent Intelligence Engine. All rights reserved.
      </div>
    </footer>
  );
}
