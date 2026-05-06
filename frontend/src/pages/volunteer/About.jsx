export default function About() {
  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">About the Research</div>
          <div className="page-sub">VoiceGuard dataset collection project</div>
        </div>
      </div>
      <div className="content">
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header"><span className="panel-title">Project Overview</span></div>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--text2)' }}>
            <p style={{ marginBottom: 14 }}>
              <strong style={{ color: 'var(--text)' }}>VoiceGuard</strong> is a research project focused on building the first large-scale, richly-labelled dataset of voice phishing (vishing) calls. Voice phishing is a growing form of social-engineering fraud where attackers impersonate banks, government agencies, or tech-support services over the phone to steal money or personal information.
            </p>
            <p>
              Existing fraud-detection systems rely primarily on text (SMS, email) or metadata. VoiceGuard targets the acoustic and linguistic patterns in the call audio itself, enabling real-time detection at the network or device level.
            </p>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header"><span className="panel-title">Why We Need Volunteers</span></div>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--text2)' }}>
            <p style={{ marginBottom: 14 }}>
              Machine-learning models for audio classification require large quantities of labelled audio examples. Real vishing recordings are rare, legally sensitive, and ethically problematic to collect. Instead, we use trained volunteers to perform scripted role-plays that closely mirror real attacks across multiple categories:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="stat-card blue"><div className="stat-label">IRS / Tax Scam</div><div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>Impersonating tax authorities</div></div>
              <div className="stat-card amber"><div className="stat-label">Bank Fraud Alert</div><div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>Fake account security calls</div></div>
              <div className="stat-card coral"><div className="stat-label">Tech Support</div><div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>Remote access / virus scam</div></div>
              <div className="stat-card teal"><div className="stat-label">Benign Calls</div><div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>Normal calls for contrast</div></div>
            </div>
            <p>Each call is recorded, timestamped by phase (greeting → setup → escalation → harvest), and reviewed by the research team before being added to the dataset.</p>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header"><span className="panel-title">Call Structure</span></div>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--text2)' }}>
            <p style={{ marginBottom: 12 }}>Vishing calls in the dataset follow a four-phase structure that mirrors real-world attack patterns:</p>
            <div className="timestamp-grid" style={{ marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600, marginBottom: 4 }}>GREETING</div>
                <div>The caller establishes rapport and introduces themselves as an authority figure.</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600, marginBottom: 4 }}>SETUP</div>
                <div>A problem is introduced — a tax debt, a compromised account, a virus detected.</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#E07A30', fontWeight: 600, marginBottom: 4 }}>ESCALATION</div>
                <div>Urgency and pressure are applied — threats of arrest, account closure, or legal action.</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--coral)', fontWeight: 600, marginBottom: 4 }}>HARVEST</div>
                <div>The caller requests payment, gift cards, remote access, or personal information.</div>
              </div>
            </div>
            <p>These phase timestamps are what you provide when submitting a recording — they allow the dataset to be used for phase-level classification, not just binary fraud detection.</p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span className="panel-title">Your Contribution</span></div>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--text2)' }}>
            <p style={{ marginBottom: 14 }}>
              Each recording you submit directly expands a dataset that researchers will use to train and benchmark vishing-detection models. High-quality recordings with accurate timestamps are especially valuable.
            </p>
            <p>
              The resulting dataset, once complete, will be made available to the academic research community (under appropriate ethical agreements) to advance the field of phone fraud detection.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
