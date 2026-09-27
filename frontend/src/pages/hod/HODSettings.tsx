import { useState, useEffect } from 'react';
import { settingsApi } from '@/api/index';
import { toast } from 'sonner';

const DEFAULT_CAPS: Record<string, number> = {
  'Assistant Professor': 18,
  'Associate Professor': 16,
  'Professor': 12,
  'Professor & HOD': 12,
};

export default function HODSettings() {
  const [caps, setCaps] = useState<Record<string, number>>(DEFAULT_CAPS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    settingsApi.getCaps()
      .then(data => { if (data && Object.keys(data).length > 0) setCaps(data); })
      .catch(() => { /* Use defaults */ })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsApi.updateCaps(caps);
      toast.success('Hour caps saved successfully!');
    } catch {
      toast.error('Failed to save caps. Using local values.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Configure workload hour caps per designation. Caps are warnings only — saving is never blocked.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '540px' }}>
        <div className="card-header">
          <span style={{ fontWeight: 700, color: '#0F172A' }}>⚙️ Hour Cap Configuration</span>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>Default values from PRD v0.2</span>
        </div>
        <div className="card-body">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 12 }} />)
          ) : (
            <>
              <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px', lineHeight: 1.6 }}>
                These caps are checked against each faculty's total hours across all programmes in the semester type.
                Exceeding a cap shows a warning inline — it never blocks saving.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.entries(caps).map(([designation, cap]) => (
                  <div key={designation} className="form-group">
                    <label className="form-label">{designation}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ maxWidth: '140px' }}
                        value={cap}
                        min={1}
                        max={40}
                        onChange={e => setCaps(prev => ({ ...prev, [designation]: Number(e.target.value) }))}
                      />
                      <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>hours/week</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : '💾 Save Caps'}
                </button>
                <button className="btn btn-ghost" onClick={() => setCaps(DEFAULT_CAPS)}>
                  Reset to Defaults
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
