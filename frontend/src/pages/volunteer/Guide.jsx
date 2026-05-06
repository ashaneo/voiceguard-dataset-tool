export default function Guide() {
  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Recording Guide</div>
          <div className="page-sub">How to record and submit your calls</div>
        </div>
      </div>
      <div className="content">
        <div className="panel"><div className="panel-body">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Before you record</h3>
          <ol style={{ paddingLeft: 18, color: 'var(--text2)', fontSize: 13, lineHeight: 2 }}>
            <li>Make sure your consent form has been signed and confirmed by the research team.</li>
            <li>Install <strong style={{ color: 'var(--text)' }}>Cube ACR</strong> on your Android phone for automatic call recording.</li>
            <li>Read through your assigned script completely before making the call.</li>
            <li>Coordinate with your partner — one is Speaker 1, one is Speaker 2.</li>
            <li>Find a quiet location with minimal background noise.</li>
          </ol>
          <hr className="divider" />
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>During the call</h3>
          <ol style={{ paddingLeft: 18, color: 'var(--text2)', fontSize: 13, lineHeight: 2 }}>
            <li>Follow the script as closely as possible.</li>
            <li>Note the approximate time (in seconds) when each phase starts.</li>
            <li>Do not laugh or break character — realistic delivery is essential for the dataset.</li>
            <li>Allow natural pauses between turns.</li>
          </ol>
          <hr className="divider" />
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Phase timestamps (vishing calls only)</h3>
          <div className="timestamp-grid">
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>GREETING</div>
              <div style={{ fontSize: 12, color: 'var(--teal)' }}>When does Speaker 1 say hello? (≈ 0–8s)</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>SETUP</div>
              <div style={{ fontSize: 12, color: 'var(--amber)' }}>When does the problem get introduced?</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>ESCALATION</div>
              <div style={{ fontSize: 12, color: '#E07A30' }}>When do threats / pressure start?</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>HARVEST</div>
              <div style={{ fontSize: 12, color: 'var(--coral)' }}>When does Speaker 1 ask for payment?</div>
            </div>
          </div>
          <hr className="divider" />
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>After the call</h3>
          <ol style={{ paddingLeft: 18, color: 'var(--text2)', fontSize: 13, lineHeight: 2 }}>
            <li>Locate the recording file on your phone (usually in <span className="mono" style={{ color: 'var(--text)' }}>Internal Storage / CallRecordings</span>).</li>
            <li>Click <strong style={{ color: 'var(--text)' }}>"Submit Recording"</strong> on your assigned script.</li>
            <li>Upload the file and fill in the timestamps and quality information.</li>
            <li>The research team will review within 48 hours.</li>
          </ol>
        </div></div>
      </div>
    </>
  )
}
