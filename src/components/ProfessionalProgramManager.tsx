import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
  Video,
  Volume2,
  X,
  BarChart3,
  Download,
  Eye
} from 'lucide-react';
import { ToastType } from './ToastSystem';
import { friendlyError } from '../utils/friendlyError';

interface ProResource {
  id: number;
  type: 'material' | 'audio' | 'video' | 'roster';
  name: string;
  status: string;
  is_available?: boolean;
  professional_program_id?: number | null;
  professional_course_id?: number | null;
  professional_program_name?: string | null;
  professional_course_title?: string | null;
}

interface ProCourse {
  id: number;
  title: string;
  code?: string | null;
  description?: string | null;
  contents?: ProResource[];
}

interface ProProgram {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  coordinator_name?: string | null;
  price: number;
  is_published: boolean;
  course_count: number;
  student_count: number;
  certification_count: number;
  courses: ProCourse[];
}

interface ProStudent {
  id?: number;
  roster_id: number;
  user_id?: number | null;
  name: string;
  email: string;
  phone?: string | null;
  matric_number: string;
  professional_program_id?: number | null;
  program_name?: string | null;
  program_code?: string | null;
  assessment_count: number;
  avg_score?: number | null;
  certificate_id?: string | null;
  completion?: {
    percent: number;
    isComplete: boolean;
    completedCourses: number;
    courseCount: number;
  } | null;
}

interface Props {
  addToast: (msg: string, type: ToastType) => void;
  token: string | null;
}

const money = (value: number | string | undefined | null) => `N${Number(value || 0).toLocaleString()}`;

const resourceIcon = (type: string) => {
  if (type === 'video') return Video;
  if (type === 'audio') return Volume2;
  return FileText;
};

export default function ProfessionalProgramManager({ addToast, token }: Props) {
  const [programs, setPrograms] = useState<ProProgram[]>([]);
  const [resources, setResources] = useState<ProResource[]>([]);
  const [students, setStudents] = useState<ProStudent[]>([]);
  const [analytics, setAnalytics] = useState<ProStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | 'new' | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [newProgram, setNewProgram] = useState({ name: '', code: '', price: '0', coordinator_name: '', description: '' });
  const [programEdits, setProgramEdits] = useState<Record<number, { price: string; coordinator_name: string; description: string }>>({});
  const [courseForms, setCourseForms] = useState<Record<number, { title: string; code: string; description: string }>>({});

  const withHub = (url: string) => `${url}${url.includes('?') ? '&' : '?'}hub=professional`;

  const selectedProgram = useMemo(
    () => programs.find(program => program.id === selectedProgramId) || programs[0] || null,
    [programs, selectedProgramId]
  );

  const inventory = useMemo(
    () => resources.filter(resource => resource.type !== 'roster' && resource.status === 'ready'),
    [resources]
  );

  const fetchAll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [programRes, resourceRes, rosterRes, analyticsRes] = await Promise.all([
        fetch(withHub('/api/pro-hub/programs'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(withHub('/api/resources'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(withHub('/api/courses/roster'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(withHub('/api/pro-hub/students/analytics'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const programData = await programRes.json();
      const resourceData = await resourceRes.json();
      const rosterData = await rosterRes.json();
      const analyticsData = await analyticsRes.json();

      if (!programRes.ok) throw new Error(programData.error || 'Failed to load professional programs');
      const nextPrograms = programData.programs || [];
      setPrograms(nextPrograms);
      setResources(Array.isArray(resourceData) ? resourceData : []);
      setStudents(Array.isArray(rosterData) ? rosterData : []);
      setAnalytics(analyticsData.students || []);
      setProgramEdits(Object.fromEntries(nextPrograms.map((program: ProProgram) => [
        program.id,
        {
          price: String(program.price || 0),
          coordinator_name: program.coordinator_name || '',
          description: program.description || ''
        }
      ])));
      if (!selectedProgramId && nextPrograms.length > 0) setSelectedProgramId(nextPrograms[0].id);
    } catch (err: any) {
      addToast(friendlyError(err, 'generic'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [token]);

  const createProgram = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProgram.name.trim()) return addToast('Program name is required', 'error');
    setSaving('new');
    try {
      const res = await fetch(withHub('/api/pro-hub/programs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...newProgram, price: parseInt(newProgram.price) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Program creation failed');
      addToast('Professional program created', 'success');
      setNewProgram({ name: '', code: '', price: '0', coordinator_name: '', description: '' });
      setSelectedProgramId(data.program.id);
      fetchAll();
    } catch (err: any) {
      addToast(friendlyError(err, 'save'), 'error');
    } finally {
      setSaving(null);
    }
  };

  const updateProgram = async (program: ProProgram, fields: Record<string, any>) => {
    setSaving(program.id);
    try {
      const edit = programEdits[program.id] || { price: String(program.price || 0), coordinator_name: '', description: '' };
      const body = {
        price: parseInt(edit.price) || 0,
        coordinator_name: edit.coordinator_name,
        description: edit.description,
        ...fields,
      };
      const res = await fetch(withHub(`/api/pro-hub/programs/${program.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      addToast('Program updated', 'success');
      fetchAll();
    } catch (err: any) {
      addToast(friendlyError(err, 'save'), 'error');
    } finally {
      setSaving(null);
    }
  };

  const deleteProgram = async (program: ProProgram) => {
    if (!window.confirm(`Delete "${program.name}" and detach its courses/content?`)) return;
    setSaving(program.id);
    try {
      const res = await fetch(withHub(`/api/pro-hub/programs/${program.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      addToast('Program deleted', 'info');
      setSelectedProgramId(null);
      fetchAll();
    } catch (err: any) {
      addToast(friendlyError(err, 'delete'), 'error');
    } finally {
      setSaving(null);
    }
  };

  const createCourse = async (program: ProProgram) => {
    const form = courseForms[program.id] || { title: '', code: '', description: '' };
    if (!form.title.trim()) return addToast('Course title is required', 'error');
    setSaving(program.id);
    try {
      const res = await fetch(withHub(`/api/pro-hub/programs/${program.id}/courses`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Course creation failed');
      setCourseForms(prev => ({ ...prev, [program.id]: { title: '', code: '', description: '' } }));
      addToast('Course added', 'success');
      fetchAll();
    } catch (err: any) {
      addToast(friendlyError(err, 'save'), 'error');
    } finally {
      setSaving(null);
    }
  };

  const deleteCourse = async (course: ProCourse) => {
    if (!window.confirm(`Delete course "${course.title}"?`)) return;
    try {
      const res = await fetch(withHub(`/api/pro-hub/courses/${course.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      addToast('Course deleted', 'info');
      fetchAll();
    } catch (err: any) {
      addToast(friendlyError(err, 'delete'), 'error');
    }
  };

  const assignResource = async (resourceId: number, programId: number | null, courseId: number | null) => {
    try {
      const res = await fetch(withHub(`/api/pro-hub/resources/${resourceId}/course`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ program_id: programId, course_id: courseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Content assignment failed');
      addToast(programId && courseId ? 'Content linked to course' : 'Content removed from course', 'success');
      fetchAll();
    } catch (err: any) {
      addToast(friendlyError(err, 'save'), 'error');
    }
  };

  const assignStudent = async (rosterId: number, programId: string) => {
    try {
      const res = await fetch(withHub(`/api/pro-hub/students/${rosterId}/program`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ program_id: programId ? parseInt(programId) : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Student assignment failed');
      addToast('Student program updated', 'success');
      fetchAll();
    } catch (err: any) {
      addToast(friendlyError(err, 'save'), 'error');
    }
  };

  const downloadUrl = (url: string) => `${withHub(url)}&token=${encodeURIComponent(token || '')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin" />
        <span className="text-xs font-black uppercase tracking-widest">Loading Professional Hub...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid xl:grid-cols-[420px_1fr] gap-8">
        <div className="space-y-6">
          <form onSubmit={createProgram} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <GraduationCap size={21} />
              </div>
              <div>
                <h3 className="font-black text-slate-900">Create Program</h3>
                <p className="text-xs text-slate-500 font-medium">One price unlocks all courses and content.</p>
              </div>
            </div>
            <input value={newProgram.name} onChange={e => setNewProgram(p => ({ ...p, name: e.target.value }))} placeholder="Program name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400" />
            <div className="grid grid-cols-2 gap-3">
              <input value={newProgram.code} onChange={e => setNewProgram(p => ({ ...p, code: e.target.value }))} placeholder="Code" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400" />
              <input type="number" min="0" value={newProgram.price} onChange={e => setNewProgram(p => ({ ...p, price: e.target.value }))} placeholder="Price" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400" />
            </div>
            <input value={newProgram.coordinator_name} onChange={e => setNewProgram(p => ({ ...p, coordinator_name: e.target.value }))} placeholder="Coordinator name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400" />
            <textarea value={newProgram.description} onChange={e => setNewProgram(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Program description" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400 resize-none" />
            <button disabled={saving === 'new'} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
              {saving === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Add Program
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-4 shadow-sm">
            <p className="px-2 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Programs</p>
            <div className="space-y-2">
              {programs.length === 0 && <p className="p-6 text-center text-slate-400 text-sm font-bold">No professional programs yet.</p>}
              {programs.map(program => (
                <button
                  key={program.id}
                  onClick={() => setSelectedProgramId(program.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedProgram?.id === program.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-blue-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-sm">{program.name}</p>
                      <p className={`text-[10px] font-black uppercase mt-1 ${selectedProgram?.id === program.id ? 'text-white/50' : 'text-slate-400'}`}>{program.code || 'No code'} - {money(program.price)}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${program.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {program.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div className={`grid grid-cols-3 gap-2 mt-4 text-center ${selectedProgram?.id === program.id ? 'text-white' : 'text-slate-700'}`}>
                    <MiniStat label="Courses" value={program.course_count} />
                    <MiniStat label="Students" value={program.student_count} />
                    <MiniStat label="Certs" value={program.certification_count} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {selectedProgram ? (
          <div className="space-y-6">
            <motion.div layout className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-6">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl font-black text-slate-900">{selectedProgram.name}</h3>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${selectedProgram.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {selectedProgram.is_published ? 'Visible to students' : 'Draft only'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium mt-1">{selectedProgram.code || 'No code'} - Program price {money(programEdits[selectedProgram.id]?.price ?? selectedProgram.price)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateProgram(selectedProgram, { is_published: !selectedProgram.is_published })} disabled={saving === selectedProgram.id} className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${selectedProgram.is_published ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                    {selectedProgram.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => deleteProgram(selectedProgram)} className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100" title="Delete program">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Program Price</label>
                  <input type="number" min="0" value={programEdits[selectedProgram.id]?.price ?? String(selectedProgram.price || 0)} onChange={e => setProgramEdits(prev => ({ ...prev, [selectedProgram.id]: { ...prev[selectedProgram.id], price: e.target.value } }))} className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Coordinator</label>
                  <input value={programEdits[selectedProgram.id]?.coordinator_name ?? ''} onChange={e => setProgramEdits(prev => ({ ...prev, [selectedProgram.id]: { ...prev[selectedProgram.id], coordinator_name: e.target.value } }))} className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => updateProgram(selectedProgram, {})} disabled={saving === selectedProgram.id} className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
                    {saving === selectedProgram.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Program
                  </button>
                </div>
              </div>
            </motion.div>

            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="font-black text-slate-900 flex items-center gap-2"><BookOpen size={19} className="text-blue-600" /> Courses and Content</h3>
                  <p className="text-xs text-slate-500 font-medium">Assign uploaded files, audio, and videos to the exact course.</p>
                </div>
              </div>

              <div className="grid md:grid-cols-[1fr_160px_140px] gap-3 mb-6">
                <input value={courseForms[selectedProgram.id]?.title || ''} onChange={e => setCourseForms(prev => ({ ...prev, [selectedProgram.id]: { ...(prev[selectedProgram.id] || { title: '', code: '', description: '' }), title: e.target.value } }))} placeholder="Course title" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400" />
                <input value={courseForms[selectedProgram.id]?.code || ''} onChange={e => setCourseForms(prev => ({ ...prev, [selectedProgram.id]: { ...(prev[selectedProgram.id] || { title: '', code: '', description: '' }), code: e.target.value } }))} placeholder="Course code" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400" />
                <button onClick={() => createCourse(selectedProgram)} className="bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Course
                </button>
              </div>

              <div className="space-y-4">
                {selectedProgram.courses.length === 0 && (
                  <div className="p-10 text-center bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 font-bold">
                    Create courses before publishing this program.
                  </div>
                )}
                {selectedProgram.courses.map(course => (
                  <div key={course.id} className="border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="font-black text-slate-900">{course.title}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{course.code || 'No code'} - {(course.contents || []).length} content item(s)</p>
                      </div>
                      <button onClick={() => deleteCourse(course)} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50" title="Delete course">
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="grid md:grid-cols-[1fr_150px] gap-2 mb-4">
                      <select onChange={e => { if (e.target.value) assignResource(parseInt(e.target.value), selectedProgram.id, course.id); e.currentTarget.value = ''; }} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none">
                        <option value="">Add uploaded content to this course...</option>
                        {inventory.map(resource => (
                          <option key={resource.id} value={resource.id}>
                            {resource.name} ({resource.type}){resource.professional_course_id ? ` - assigned to ${resource.professional_course_title || 'course'}` : ''}
                          </option>
                        ))}
                      </select>
                      <span className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                        80% video rule
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(course.contents || []).length === 0 && <p className="text-xs text-slate-400 font-bold px-2">No content assigned yet.</p>}
                      {(course.contents || []).map(content => {
                        const Icon = resourceIcon(content.type);
                        return (
                          <div key={content.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                            <Icon size={17} className={content.type === 'video' ? 'text-violet-600' : content.type === 'audio' ? 'text-rose-600' : 'text-amber-600'} />
                            <span className="flex-1 text-sm font-bold text-slate-800">{content.name}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{content.type}</span>
                            <button onClick={() => assignResource(content.id, null, null)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Remove from course">
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-16 text-center text-slate-400 font-bold">
            Create your first professional program to start building courses.
          </div>
        )}
      </div>

      <div className="grid xl:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
          <h3 className="font-black text-slate-900 flex items-center gap-2 mb-5"><Users size={19} className="text-indigo-600" /> Student Program Assignment</h3>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {students.length === 0 && <p className="text-slate-400 font-bold text-sm">Upload professional students first.</p>}
            {students.map(student => (
              <div key={student.id || student.roster_id} className="grid md:grid-cols-[1fr_220px] gap-3 p-3 bg-slate-50 rounded-2xl">
                <div className="min-w-0">
                  <p className="font-black text-slate-900 text-sm truncate">{student.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold truncate">{student.email} - {student.matric_number}</p>
                </div>
                <select value={student.professional_program_id || ''} onChange={e => assignStudent(student.id || student.roster_id, e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none">
                  <option value="">No program</option>
                  {programs.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
          <h3 className="font-black text-slate-900 flex items-center gap-2 mb-5"><BarChart3 size={19} className="text-emerald-600" /> Performance and Certification</h3>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {analytics.length === 0 && <p className="text-slate-400 font-bold text-sm">No professional performance data yet.</p>}
            {analytics.map(student => (
              <div key={student.roster_id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900 text-sm">{student.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{student.program_name || 'No program assigned'} - {student.matric_number}</p>
                  </div>
                  <span className="text-xl font-black text-emerald-600">{student.completion?.percent || 0}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 my-4">
                  <MiniStat label="Avg" value={student.avg_score !== null && student.avg_score !== undefined ? `${student.avg_score}%` : '-'} />
                  <MiniStat label="Assess" value={student.assessment_count || 0} />
                  <MiniStat label="Courses" value={`${student.completion?.completedCourses || 0}/${student.completion?.courseCount || 0}`} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {student.user_id && (
                    <a href={downloadUrl(`/api/transcripts/student/${student.user_id}`)} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-blue-100">
                      <Download size={12} /> Transcript
                    </a>
                  )}
                  {student.user_id && student.professional_program_id && (
                    <a href={downloadUrl(`/api/pro-hub/students/${student.user_id}/programs/${student.professional_program_id}/certificate`)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${student.completion?.isComplete ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 pointer-events-none'}`}>
                      <Award size={12} /> Certificate
                    </a>
                  )}
                  {student.certificate_id && (
                    <a href={`/verify/${student.certificate_id}`} target="_blank" rel="noreferrer" className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:border-blue-200">
                      <Eye size={12} /> Verify
                    </a>
                  )}
                  {student.completion?.isComplete && <span className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 size={12} /> Complete</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/60 border border-slate-100 px-2 py-2">
      <p className="font-black text-sm">{value}</p>
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  );
}
