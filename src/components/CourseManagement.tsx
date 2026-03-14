import React, { useState } from 'react';
import { Upload, FileDown, Users, BookOpen, BrainCircuit, CheckCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { ToastType } from './ToastSystem';

interface AdminCourseManagementProps {
    addToast: (msg: string, type: ToastType) => void;
}

export default function AdminCourseManagement({ addToast }: AdminCourseManagementProps) {
    const [rosterFile, setRosterFile] = useState<File | null>(null);
    const [materialFile, setMaterialFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [assessmentType, setAssessmentType] = useState<'exam' | 'test' | 'assignment'>('exam');
    
    // Dynamic Application State
    const [activeStudents, setActiveStudents] = useState(0);
    const [generatedQuizzes, setGeneratedQuizzes] = useState(0);
    const [materialsUploaded, setMaterialsUploaded] = useState(0);

    const handleRosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setRosterFile(e.target.files[0]);
            addToast(`Roster ${e.target.files[0].name} selected`, 'info');
        }
    };

    const handleMaterialUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setMaterialFile(e.target.files[0]);
            addToast(`Material ${e.target.files[0].name} selected`, 'info');
        }
    };

    const handleSaveRoster = async () => {
        if (!rosterFile) return;
        setIsProcessing(true);
        // Simulate parsing Excel/CSV
        setTimeout(() => {
            const simulatedCount = Math.floor(Math.random() * 50) + 20; // Generate fake counts dynamically
            setIsProcessing(false);
            setRosterFile(null);
            setActiveStudents(prev => prev + simulatedCount);
            addToast(`Successfully registered ${simulatedCount} students to the whitelist.`, 'success');
        }, 1500);
    };

    const handleGenerateAIQuiz = async () => {
        if (!materialFile) return;
        setIsProcessing(true);
        // Simulate AI Parsing Document
        setTimeout(() => {
            const simulatedQs = Math.floor(Math.random() * 15) + 15;
            setIsProcessing(false);
            setMaterialFile(null);
            setMaterialsUploaded(prev => prev + 1);
            setGeneratedQuizzes(prev => prev + 1);
            addToast(`AI generated ${simulatedQs} questions from the lecture material.`, 'success');
        }, 2500);
    };

    return (
        <div className="space-y-8 max-w-5xl">
            <header className="mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    Course & Quiz Management <ShieldCheck className="text-amber-500" />
                </h2>
                <p className="text-slate-500 font-medium">Whitelist students and generate AI quizzes from lecture notes.</p>
            </header>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Roster Management Card */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-2xl mb-6">
                        <Users size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Student Whitelist</h3>
                    <p className="text-sm text-slate-500 mb-6">Upload a CSV or Excel file containing student Matriculation Numbers to strictly control portal access.</p>
                    
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
                        <input 
                            type="file" 
                            accept=".csv, .xlsx, .xls"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleRosterUpload}
                        />
                        <Upload className="mx-auto text-slate-400 mb-3" size={24} />
                        <p className="font-bold text-slate-700 text-sm">
                            {rosterFile ? rosterFile.name : 'Click or drag roster file here'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">.csv or .xlsx (Max 5MB)</p>
                    </div>

                    <button 
                        onClick={handleSaveRoster}
                        disabled={!rosterFile || isProcessing}
                        className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                    >
                        <CheckCircle size={18} /> Register Students
                    </button>
                    
                     <button className="w-full mt-2 text-indigo-600 text-xs font-bold py-2 hover:bg-indigo-50 rounded-xl transition-colors flex justify-center items-center gap-2">
                        <FileDown size={14} /> Download CSV Template
                    </button>
                </div>

                {/* AI Quiz Generation Card */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 flex items-center justify-center rounded-2xl mb-6 relative z-10">
                        <BrainCircuit size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 relative z-10">AI Assessment Builder</h3>
                    <p className="text-sm text-slate-500 mb-6 relative z-10">Upload PDF lecture notes. Neural AI will automatically extract context and set MCQs or Tasks.</p>

                    {/* Type Selector */}
                    <div className="flex p-1 bg-slate-100 rounded-2xl mb-6 relative z-10 border border-slate-200 shadow-inner">
                        {(['exam', 'test', 'assignment'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setAssessmentType(type)}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                    assessmentType === type ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors relative cursor-pointer z-10">
                        <input 
                            type="file" 
                            accept=".pdf, .docx"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleMaterialUpload}
                        />
                        <BookOpen className="mx-auto text-slate-400 mb-3" size={24} />
                        <p className="font-bold text-slate-700 text-sm">
                            {materialFile ? materialFile.name : 'Click to upload lecture notes'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">.pdf or .docx (Max 15MB)</p>
                    </div>

                    <button 
                        onClick={handleGenerateAIQuiz}
                        disabled={!materialFile || isProcessing}
                        className="w-full mt-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors flex justify-center items-center gap-2 relative z-10 shadow-lg shadow-amber-500/20"
                    >
                        <BrainCircuit size={18} /> Generate {assessmentType.toUpperCase()}
                    </button>
                </div>
            </div>
            
            {/* Statistics Preview */}
            <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-8">
                <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active Students</p>
                    <p className="text-2xl font-black text-slate-900">{activeStudents}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Generated Quizzes</p>
                    <p className="text-2xl font-black text-slate-900">{generatedQuizzes}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Materials Uploaded</p>
                    <p className="text-2xl font-black text-slate-900">{materialsUploaded}</p>
                </div>
            </div>
        </div>
    );
}

