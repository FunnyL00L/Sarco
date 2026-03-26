import React, { useState, useEffect } from 'react';
import { validateTokenAPI, getQuestionsAPI, submitScoreAPI } from '../services/quizService';
import { StudentData, QuizQuestion } from '../types';
import { X, HelpCircle, AlertTriangle, CheckCircle, Loader2, Trophy } from 'lucide-react';

type QuizStage = 'TOKEN' | 'LOADING' | 'CONFIRM' | 'PLAYING' | 'RESULT';

interface QuizOverlayProps {
  onClose: () => void;
}

export default function QuizOverlay({ onClose }: QuizOverlayProps) {
  const [stage, setStage] = useState<QuizStage>('TOKEN');
  const [token, setToken] = useState('');
  const [student, setStudent] = useState<StudentData | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const handleValidateToken = async () => {
    if (!token.trim()) {
      setError('Token tidak boleh kosong');
      return;
    }
    
    setError(null);
    setStage('LOADING');
    setLoadingMessage('Memvalidasi token...');
    
    try {
      const studentData = await validateTokenAPI(token);
      setStudent(studentData);
      setStage('CONFIRM');
    } catch (err: any) {
      setError(err.message || 'Gagal memvalidasi token');
      setStage('TOKEN');
    }
  };

  const handleStartQuiz = async () => {
    if (!student) return;
    
    setError(null);
    setStage('LOADING');
    setLoadingMessage('Mengambil soal...');
    
    try {
      const fetchedQuestions = await getQuestionsAPI(student.gameId);
      if (fetchedQuestions.length === 0) {
        throw new Error('Tidak ada soal yang tersedia');
      }
      setQuestions(fetchedQuestions);
      setCurrentQuestionIndex(0);
      setScore(0);
      setStage('PLAYING');
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil soal');
      setStage('CONFIRM');
    }
  };

  const handleAnswer = (isCorrect: boolean, points: number) => {
    if (isCorrect) {
      setScore(prev => prev + points);
    }
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishQuiz(score + (isCorrect ? points : 0));
    }
  };

  const finishQuiz = async (finalScore: number) => {
    if (!student) return;
    
    setStage('LOADING');
    setLoadingMessage('Menyimpan nilai...');
    
    try {
      await submitScoreAPI(student.token, finalScore, student.gameId);
      setScore(finalScore);
      setStage('RESULT');
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan nilai');
      setScore(finalScore);
      setStage('RESULT');
    }
  };

  const renderToken = () => (
    <div className="flex flex-col items-center text-center w-full max-w-sm">
      <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
        <HelpCircle size={32} className="text-blue-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Quiz Sejarah</h2>
      <p className="text-zinc-400 mb-6 text-sm">Masukkan token untuk memulai quiz</p>
      
      <input
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Masukkan Token"
        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors mb-4 text-center font-mono text-lg"
        onKeyDown={(e) => e.key === 'Enter' && handleValidateToken()}
      />
      
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      
      <button
        onClick={handleValidateToken}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
      >
        Lanjut
      </button>
    </div>
  );

  const renderLoading = () => (
    <div className="flex flex-col items-center text-center">
      <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
      <p className="text-zinc-300 font-medium">{loadingMessage}</p>
    </div>
  );

  const renderConfirm = () => {
    if (!student) return null;
    
    return (
      <div className="flex flex-col items-center text-center w-full max-w-sm">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
          <CheckCircle size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-6">Data Peserta</h2>
        
        <div className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 mb-6 text-left space-y-3">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Nama</p>
            <p className="text-white font-medium">{student.name}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Kelas</p>
            <p className="text-white font-medium">{student.className}</p>
          </div>
        </div>

        {student.gameId === 'SARCO_AR' && (
          <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3 text-left">
            <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/80">
              Perhatian: Token ini terdaftar untuk SARCO_AR. Quiz mungkin berisi pertanyaan umum.
            </p>
          </div>
        )}
        
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        
        <button
          onClick={handleStartQuiz}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
        >
          Mulai Quiz
        </button>
      </div>
    );
  };

  const renderPlaying = () => {
    if (questions.length === 0) return null;
    const currentQ = questions[currentQuestionIndex];
    
    return (
      <div className="flex flex-col w-full max-w-xl">
        <div className="flex justify-between items-center mb-6">
          <span className="text-sm font-medium text-zinc-400">
            Pertanyaan {currentQuestionIndex + 1} / {questions.length}
          </span>
          <span className="text-sm font-bold text-blue-400">
            {score} Poin
          </span>
        </div>
        
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-6">
          <h3 className="text-xl font-medium text-white leading-relaxed">
            {currentQ.question}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {currentQ.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleAnswer(opt.isCorrect, currentQ.points)}
              className="w-full p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 rounded-xl text-left text-white transition-all active:scale-[0.98]"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderResult = () => (
    <div className="flex flex-col items-center text-center w-full max-w-sm">
      <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-yellow-500/10 border border-yellow-500/30">
        <Trophy size={40} className="text-yellow-400" />
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">Quiz Selesai!</h2>
      <p className="text-zinc-400 mb-8">Terima kasih telah berpartisipasi</p>
      
      <div className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-8">
        <p className="text-sm text-zinc-400 uppercase tracking-wider font-semibold mb-1">Skor Akhir</p>
        <p className="text-5xl font-bold text-white">{score}</p>
      </div>
      
      {error && <p className="text-red-400 text-sm mb-6">{error}</p>}
      
      <button
        onClick={onClose}
        className="w-full py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-colors"
      >
        Tutup
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0 bg-zinc-900/95 backdrop-blur-md flex items-center justify-center z-50 p-6 pointer-events-auto">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-zinc-400 hover:text-white transition-colors"
      >
        <X size={28} />
      </button>
      
      {stage === 'TOKEN' && renderToken()}
      {stage === 'LOADING' && renderLoading()}
      {stage === 'CONFIRM' && renderConfirm()}
      {stage === 'PLAYING' && renderPlaying()}
      {stage === 'RESULT' && renderResult()}
    </div>
  );
}
