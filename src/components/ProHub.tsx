import React, { useState } from 'react';
import { Briefcase, Users, BookOpen, Mic, Video, ClipboardCheck, FileUp, GraduationCap, Layers3 } from 'lucide-react';
import ResourceHub from './ResourceHub';
import AcademicManagement from './AcademicManagement';
import ProfessionalProgramManager from './ProfessionalProgramManager';
import { ToastType } from './ToastSystem';

interface ProHubProps {
  addToast: (msg: string, type: ToastType) => void;
  token: string | null;
}

type ProHubSection = 'programs' | 'students' | 'materials' | 'records' | 'videos' | 'tests' | 'assignments' | 'exams';

const sections: Array<{ id: ProHubSection; label: string; icon: React.ComponentType<any> }> = [
  { id: 'programs', label: 'Programs', icon: Layers3 },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'materials', label: 'Materials', icon: BookOpen },
  { id: 'records', label: 'Audio', icon: Mic },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'tests', label: 'Tests', icon: ClipboardCheck },
  { id: 'assignments', label: 'Assignments', icon: FileUp },
  { id: 'exams', label: 'Exams', icon: GraduationCap },
];

export default function ProHub({ addToast, token }: ProHubProps) {
  const [section, setSection] = useState<ProHubSection>('programs');

  const renderSection = () => {
    if (section === 'programs') {
      return <ProfessionalProgramManager addToast={addToast} token={token} />;
    }
    if (section === 'students') {
      return <div key="pro-students"><ResourceHub addToast={addToast} token={token} hub="professional" initialUploadType="roster" /></div>;
    }
    if (section === 'videos') {
      return <div key="pro-videos"><ResourceHub addToast={addToast} token={token} hub="professional" initialUploadType="video" /></div>;
    }
    return <AcademicManagement mode={section} addToast={addToast} token={token} hub="professional" />;
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
            <Briefcase size={27} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Professional Hub</h2>
            <p className="text-slate-500 font-medium">
              Separate professional-course workspace with system-generated student IDs.
            </p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {renderSection()}
    </div>
  );
}
