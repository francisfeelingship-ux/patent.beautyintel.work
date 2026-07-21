import { useState } from 'react';

interface ProjectCard {
  title: string;
  question: string;
  scope: string;
  steps: string[];
  sampleOutput: string;
}

export default function ResearchWorkflow() {
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);

  const projects: ProjectCard[] = [
    {
      title: "Ingredient Patent Risk Review",
      question: "Analyze L'Oreal's patent layout in UV filters over the last 15 years.",
      scope: "All patent families containing UV filter active ingredients (e.g., avobenzone, mexoryl, octocrylene) matched with formulation claims.",
      steps: [
        "Keyword & Vector similarity extraction targeting chemical names.",
        "SURF-based filtration for topical skin application limits.",
        "FTS5 claims audit to locate target concentrations (0.1% to 10.0%).",
        "Synthesis report drafting highlighting formulation freedom-to-operate gaps."
      ],
      sampleOutput: `### Executive Summary - UV Filter Layout
- **Target Portfolio**: L'Oreal SA UV Filter stabilization patents (2010 - 2025).
- **Core Findings**: Identified 4 key patent clusters protecting avobenzone-mexoryl stabilization networks. High density in oil-in-water emulsions.
- **Freedom to Operate**: Strong coverage of avobenzone combined with specific diester stabilizers (US20180123A1, EP3140502B1). Emerging gaps identified in mineral sunscreen dispersions combined with peptide actives.`
    },
    {
      title: "Company Ownership & Assignee Review",
      question: "Determine Beiersdorf's ownership changes and assignee alias alignments.",
      scope: "Corporate registry matches, subsidiary alignment, legal transfer records, and joint assignee listings for Nivea and Eucerin patent lines.",
      steps: [
        "Co-assignee normalization across multiple spelling variations (e.g., Beiersdorf AG, Beiersdorf S.A.).",
        "USPTO assignee transaction tracking for legal transfers.",
        "Portfolio ownership timeline mapping (1998 - 2024)."
      ],
      sampleOutput: `### Executive Summary - Beiersdorf Assignee Normalization
- **Normalized Assignees**: Beiersdorf AG consolidated with 12 child entities (e.g., La Prairie, Eucerin research division).
- **Transaction Flow**: Identified transfer of 45 formulation patents from joint ventures.
- **Key Holdings**: Primary holdings remain concentrated under core German filings (EP, DE) with subsequent extension into US and CN markets.`
    },
    {
      title: "Technology Landscape Study",
      question: "Identify emerging formulation domains for skin barrier restoration peptides.",
      scope: "Global cosmetic patents filed between 2018 and 2024 with cell-stimulation peptides and moisturizing carrier systems.",
      steps: [
        "3D vector cluster grouping of active peptide formulations.",
        "K-means domain tagging for application axes (e.g., skin barrier, collagen booster).",
        "Filings trend analysis identifying peak research windows."
      ],
      sampleOutput: `### Executive Summary - Peptide Formulation Landscape
- **Cluster Density**: High concentration in dermal barrier repair peptides (32% of active peptide families).
- **Filing Growth**: Compound Annual Growth Rate (CAGR) of 14.2% since 2019, driven by ceramides-peptide synergies.
- **Leading Jurisdictions**: EP and US lead in active applications, with CN showing a 40% increase in utility model filings since 2021.`
    }
  ];

  return (
    <section className="tab-content active" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Capability presentation header */}
      <div 
        className="research-input-panel" 
        style={{ 
          background: 'var(--glass-bg)', 
          border: '1px solid var(--glass-border)', 
          padding: '24px', 
          borderRadius: 'var(--border-radius-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}
      >
        <div>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-robot" style={{ color: 'var(--accent-purple)' }}></i> Multi-Agent Research Workflow
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Product capability demonstration of our recursive multi-agent research pipeline. 
          </p>
        </div>
        
        <span 
          style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid var(--accent-purple)',
            color: 'var(--accent-purple)',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '1px'
          }}
        >
          CAPABILITY DEMO - NOT ACTIVE
        </span>
      </div>

      {/* Main Workflow layout grid */}
      <div className="research-layout" style={{ display: 'flex', flexDirection: 'row', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Left column: Capability description & Log simulation */}
        <div className="research-logs-panel" style={{ flex: '1 1 450px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '20px 24px', borderRadius: 'var(--border-radius-md)' }}>
          <div className="panel-header-custom" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.05rem' }}>
              Multi-Agent Collaboration Pipeline
            </h3>
            <span className="workflow-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
              Precomputed Flow
            </span>
          </div>

          {/* Workflow Steps Indicator */}
          <div className="workflow-steps-indicator" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <div className="step-indicator-item active" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', borderLeft: '3px solid var(--accent-blue)' }}>
              <span className="step-circle" style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)', color: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>1</span>
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-bright)', fontWeight: 600 }}>Stage 1: Evidence Retrieval Agent</h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Executes recursive SQL, vector, and FTS5 matches to gather raw evidence.</p>
              </div>
            </div>
            
            <div className="step-indicator-item active" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', borderLeft: '3px solid var(--accent-purple)' }}>
              <span className="step-circle" style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--accent-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>2</span>
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-bright)', fontWeight: 600 }}>Stage 2: Writing & Synthesis Agent</h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Drafts the report, checking evidence coverage and highlighting gaps.</p>
              </div>
            </div>
            
            <div className="step-indicator-item active" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', borderLeft: '3px solid var(--accent-pink)' }}>
              <span className="step-circle" style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--accent-pink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>3</span>
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-bright)', fontWeight: 600 }}>Stage 3: Evidence Auditor Agent</h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Verifies claims against source document extracts to eliminate hallucination.</p>
              </div>
            </div>
          </div>

          {/* Terminal log console mockup */}
          <div className="terminal-log-wrapper">
            <div className="terminal-header">
              <span className="terminal-dot red-dot"></span>
              <span className="terminal-dot yellow-dot"></span>
              <span className="terminal-dot green-dot"></span>
              <span className="terminal-title">Demonstration log console (Active simulation disabled)</span>
            </div>
            <div 
              className="terminal-body" 
              style={{ 
                fontFamily: 'Consolas, Courier New, monospace', 
                fontSize: '0.72rem', 
                lineHeight: '1.4', 
                color: '#10b981', 
                background: '#04060a', 
                padding: '14px', 
                borderRadius: '0 0 8px 8px',
                height: '240px',
                overflowY: 'auto'
              }}
            >
              <div style={{ color: '#9ca3af' }}>[INFO] [2026-07-21 11:55] Initializing agent thread conversation-9049-661a</div>
              <div style={{ color: '#3b82f6' }}>[RETRIEVAL] [2026-07-21 11:55] Running semantic query: "moisturizing carrier system UV filter stabilization"</div>
              <div style={{ color: '#3b82f6' }}>[RETRIEVAL] Found 4 candidate families. Performing FTS5 claims scan...</div>
              <div style={{ color: '#8b5cf6' }}>[SYNTHESIS] Analyzing 12 claims matching avobenzone stabilization limits.</div>
              <div style={{ color: '#8b5cf6' }}>[SYNTHESIS] Drafting segment: "Formulation active UV filter stabilization matrix"</div>
              <div style={{ color: '#ec4899' }}>[AUDIT] Launching fact audit. Validating report claims against EP3140502B1...</div>
              <div style={{ color: '#10b981' }}>[AUDIT] Audit success: 100% of claims match source publications. No hallucinations detected.</div>
              <div style={{ color: '#9ca3af' }}>[INFO] Report finalized and saved. Task task-9049 complete.</div>
            </div>
          </div>
        </div>

        {/* Right column: Project capability cards */}
        <div className="research-report-panel" style={{ flex: '1 1 500px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '20px 24px', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.05rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
            Example Capability Projects (Select one)
          </h3>
          
          {/* Card selection tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {projects.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setActiveCardIndex(idx)}
                style={{
                  background: activeCardIndex === idx ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid',
                  borderColor: activeCardIndex === idx ? 'var(--accent-purple)' : 'var(--glass-border)',
                  color: activeCardIndex === idx ? 'var(--text-bright)' : 'var(--text-secondary)',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                {p.title}
              </button>
            ))}
          </div>

          {/* Selected project details */}
          <div 
            style={{ 
              background: 'rgba(0,0,0,0.15)', 
              border: '1px solid rgba(255,255,255,0.03)', 
              borderRadius: '8px', 
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '0.8rem'
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block' }}>Research Question</span>
              <strong style={{ color: 'var(--text-bright)', fontSize: '0.88rem' }}>"{projects[activeCardIndex].question}"</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block' }}>Data Scope</span>
              <span style={{ color: 'var(--text-secondary)' }}>{projects[activeCardIndex].scope}</span>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Workflow Steps</span>
              <ul style={{ paddingLeft: '18px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {projects[activeCardIndex].steps.map((s, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{s}</li>
                ))}
              </ul>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
              <span style={{ color: 'var(--accent-blue)', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '6px', fontWeight: 700 }}>
                Sample Capability Report Excerpt
              </span>
              <pre 
                style={{ 
                  background: '#04060a', 
                  color: '#9ca3af', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.76rem',
                  lineHeight: '1.4',
                  border: '1px solid rgba(255,255,255,0.03)'
                }}
              >
                {projects[activeCardIndex].sampleOutput}
              </pre>
            </div>

            <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.7rem', fontStyle: 'italic', marginTop: '4px' }}>
              Status: Example Workflow Representation Only
            </div>
          </div>

        </div>

      </div>

    </section>
  );
}
