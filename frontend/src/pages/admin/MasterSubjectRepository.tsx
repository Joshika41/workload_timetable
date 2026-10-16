import { useState, useEffect } from 'react';
import { academicApi } from '@/api/index';
import { toast } from 'sonner';

interface MasterSubject {
  id: number;
  course_code: string;
  course_name: string;
  category: string;
  category_label: string;
  course_type: string;
  theory_hours: number;
  practical_hours: number;
  total_hours: number;
  credits: number;
}

export default function MasterSubjectRepository() {
  const [subjects, setSubjects] = useState<MasterSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State for New / Edit Subject
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    course_code: '',
    course_name: '',
    category: 'CORE',
    theory_hours: 3,
    practical_hours: 0,
    credits: 3,
    programme_id: 6, // Default MCA
    semester: 1,
  });

  const loadSubjects = () => {
    setIsLoading(true);
    const params: { search?: string; category?: string } = {};
    if (searchTerm.trim()) params.search = searchTerm.trim();
    if (selectedCategory !== 'ALL') params.category = selectedCategory;
    academicApi.getMasterSubjects(params)
      .then(data => {
        setSubjects(data || []);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load master subjects');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadSubjects();
  }, [searchTerm, selectedCategory]);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData({
      course_code: '',
      course_name: '',
      category: 'CORE',
      theory_hours: 3,
      practical_hours: 0,
      credits: 3,
      programme_id: 6,
      semester: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sub: MasterSubject) => {
    setEditingId(sub.id);
    setFormData({
      course_code: sub.course_code,
      course_name: sub.course_name,
      category: sub.category,
      theory_hours: sub.theory_hours,
      practical_hours: sub.practical_hours,
      credits: sub.credits,
      programme_id: 6,
      semester: 1,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.course_code.trim() || !formData.course_name.trim()) {
      toast.error('Please enter course code and course title.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await academicApi.updateMasterSubject(editingId, {
          course_code: formData.course_code,
          course_name: formData.course_name,
          category: formData.category,
          theory_hours: Number(formData.theory_hours),
          practical_hours: Number(formData.practical_hours),
          credits: Number(formData.credits),
        });
        toast.success(`Subject ${formData.course_code} updated successfully.`);
      } else {
        await academicApi.createMasterSubject({
          ...formData,
          theory_hours: Number(formData.theory_hours),
          practical_hours: Number(formData.practical_hours),
          credits: Number(formData.credits),
          programme_id: Number(formData.programme_id),
          semester: Number(formData.semester),
        });
        toast.success(`Master Subject ${formData.course_code} registered successfully.`);
      }
      setIsModalOpen(false);
      loadSubjects();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to save subject.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`Are you sure you want to delete Master Subject ${code}? This will remove it from all offerings.`)) {
      return;
    }
    try {
      await academicApi.deleteMasterSubject(id);
      toast.success(`Subject ${code} deleted.`);
      loadSubjects();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete subject.');
    }
  };

  // Stats
  const totalCount = subjects.length;
  const coreCount = subjects.filter(s => s.category === 'CORE' || s.category_label?.includes('Core')).length;
  const electiveCount = subjects.filter(s => s.category?.includes('ELECTIVE') || s.category_label?.includes('Elective')).length;
  const practicalCount = subjects.filter(s => s.course_type?.includes('Practical') || s.course_type?.includes('Integrated')).length;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 className="page-title" style={{ margin: 0 }}>Universal Master Subject Repository</h2>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(201,168,76,0.18)', color: '#002147' }}>
              Super Admin Authority
            </span>
          </div>
          <p className="page-subtitle">
            Central repository of all campus courses, regulations, theory/practical breakdown, and curriculum mapping.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleOpenCreateModal}
          style={{ height: '42px', padding: '0 20px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>➕</span> Add Master Subject
        </button>
      </div>

      {/* KPI Stats Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            TOTAL MASTER SUBJECTS
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#002147', marginTop: '4px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            Campus wide active subjects
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            PROFESSIONAL CORE
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1D4ED8', marginTop: '4px' }}>
            {coreCount}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            Foundational mandatory courses
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ELECTIVE COURSES
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {electiveCount}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            Discipline & generic electives
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            PRACTICAL / INTEGRATED
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
            {practicalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            Requires computer lab allocation
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flex: 1, minWidth: '280px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '12px', color: '#94A3B8', fontSize: '16px' }}>🔍</span>
            <input
              type="text"
              className="form-control"
              placeholder="Search by subject code (e.g. PCA25C01J) or title..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '40px', height: '42px', fontSize: '14px', borderRadius: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
              Filter Category:
            </label>
            <select
              className="form-control"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ height: '42px', fontSize: '13px', fontWeight: 600, minWidth: '180px', borderRadius: '8px' }}
            >
              <option value="ALL">All Categories</option>
              <option value="CORE">Professional Core</option>
              <option value="ELECTIVE">Discipline Elective</option>
              <option value="OTHER">Skill / Ability Enhancement / Project</option>
            </select>
          </div>
        </div>
      </div>

      {/* Master Subjects Table */}
      <div className="card" style={{ border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ width: '140px', padding: '12px 16px' }}>CODE</th>
                <th style={{ padding: '12px 16px' }}>SUBJECT NAME</th>
                <th style={{ width: '220px', padding: '12px 16px' }}>CATEGORY</th>
                <th style={{ width: '150px', padding: '12px 16px' }}>TYPE</th>
                <th style={{ width: '70px', textAlign: 'center', padding: '12px' }}>L</th>
                <th style={{ width: '70px', textAlign: 'center', padding: '12px' }}>P</th>
                <th style={{ width: '80px', textAlign: 'center', padding: '12px' }}>CREDITS</th>
                <th style={{ width: '120px', textAlign: 'center', padding: '12px 16px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#002147' }}>Loading Master Subjects...</div>
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                    No subjects found matching your search.
                  </td>
                </tr>
              ) : (
                subjects.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#002147', fontFamily: 'monospace' }}>
                      {s.course_code}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>
                      {s.course_name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                        {s.category_label || s.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: s.course_type.includes('Integrated') ? '#EFF6FF' : s.course_type.includes('Practical') ? '#F0FDF4' : '#F8FAFC',
                        color: s.course_type.includes('Integrated') ? '#1D4ED8' : s.course_type.includes('Practical') ? '#15803D' : '#475569',
                        border: '1px solid rgba(0,0,0,0.06)'
                      }}>
                        {s.course_type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px', fontWeight: 700, color: '#475569' }}>
                      {s.theory_hours}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px', fontWeight: 700, color: '#475569' }}>
                      {s.practical_hours}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px', fontWeight: 800, color: '#C9A84C' }}>
                      {s.credits}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                            borderRadius: '4px', color: '#002147', fontSize: '13px'
                          }}
                          title="Edit Subject"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.course_code)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                            borderRadius: '4px', color: '#DC2626', fontSize: '13px'
                          }}
                          title="Delete Subject"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,15,35,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px'
        }}>
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#FAFCFE' }}>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#002147' }}>
                {editingId ? `✏️ Edit Master Subject (${formData.course_code})` : '➕ Register New Master Subject'}
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                    COURSE CODE *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. PCA25C01J"
                    value={formData.course_code}
                    onChange={e => setFormData({ ...formData, course_code: e.target.value.toUpperCase() })}
                    style={{ fontWeight: 700, fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                    COURSE TITLE *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Object Oriented Programming using Java"
                    value={formData.course_name}
                    onChange={e => setFormData({ ...formData, course_name: e.target.value })}
                    style={{ fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                  CATEGORY
                </label>
                <select
                  className="form-control"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  style={{ fontWeight: 600 }}
                >
                  <option value="CORE">Professional Core (CORE)</option>
                  <option value="ELECTIVE">Discipline / Generic Elective (ELECTIVE)</option>
                  <option value="OTHER">Skill Enhancement / Ability Enhancement / Project (OTHER)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                    THEORY HRS (L)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    className="form-control"
                    value={formData.theory_hours}
                    onChange={e => setFormData({ ...formData, theory_hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                    PRACTICAL HRS (P)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    className="form-control"
                    value={formData.practical_hours}
                    onChange={e => setFormData({ ...formData, practical_hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                    CREDITS (C)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    className="form-control"
                    value={formData.credits}
                    onChange={e => setFormData({ ...formData, credits: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              {!editingId && (
                <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                    OPTIONAL: CURRICULUM OFFERING LINK
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>TARGET PROGRAMME</label>
                      <select
                        className="form-control"
                        value={formData.programme_id}
                        onChange={e => setFormData({ ...formData, programme_id: Number(e.target.value) })}
                        style={{ fontSize: '12px' }}
                      >
                        <option value={6}>MCA (Postgraduate Dept of Computer Applications)</option>
                        <option value={7}>MCA GEN AI</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>SEMESTER</label>
                      <select
                        className="form-control"
                        value={formData.semester}
                        onChange={e => setFormData({ ...formData, semester: Number(e.target.value) })}
                        style={{ fontSize: '12px' }}
                      >
                        <option value={1}>Semester I</option>
                        <option value={2}>Semester II</option>
                        <option value={3}>Semester III</option>
                        <option value={4}>Semester IV</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingId ? 'Update Subject' : 'Register Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
