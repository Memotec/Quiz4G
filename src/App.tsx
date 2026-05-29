import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, 
  LayoutDashboard, 
  BookOpen, 
  Award, 
  RefreshCw, 
  Github, 
  Compass, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { syncQuestionsFromSheet } from './utils/sync';
import { Question, QuizMode, ExamHistoryItem, AppStats } from './types';
import Dashboard from './components/Dashboard';
import QuestionBrowser from './components/QuestionBrowser';
import QuizEngine from './components/QuizEngine';
import HistoryStats from './components/HistoryStats';
import ExamReportPDF from './components/ExamReportPDF';

export default function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [syncSource, setSyncSource] = useState<'google_sheets' | 'local_backup' | string>('local_backup');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard'); // dashboard, browser, stats

  // Google Sheet integration sync callback
  const handleGoogleSheetSyncComplete = (newQuestions: Question[], sourceName: string) => {
    setQuestions(newQuestions);
    setSyncSource(sourceName);
    setSyncError(null);
  };
  
  // Active quiz session states
  const [activeSession, setActiveSession] = useState<{
    mode: QuizMode;
    questionCount: number;
    selectedCategories: string[];
    shuffle: boolean;
    durationMinutes: number;
  } | null>(null);

  // Score History state
  const [history, setHistory] = useState<ExamHistoryItem[]>([]);
  const [printData, setPrintData] = useState<any>(null);

  // Unique categories list
  const categories = useMemo(() => {
    if (questions.length === 0) return [];
    return Array.from(new Set(questions.map(q => q.category)));
  }, [questions]);

  // Sync questions from Google Sheet
  const loadQuestions = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsLoading(true);
    const result = await syncQuestionsFromSheet();
    setQuestions(result.questions);
    setSyncSource(result.source);
    setSyncError(result.error);
    setIsLoading(false);
  };

  // On mount: load questions and local history
  useEffect(() => {
    loadQuestions();
    
    // Load local history
    try {
      const stored = localStorage.getItem('vccs_quiz_history_v2');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch sử làm bài từ localStorage:', err);
    }
  }, []);

  // Save history item handler
  const handleSaveHistory = (newItem: Omit<ExamHistoryItem, 'id' | 'date'>) => {
    const freshItem: ExamHistoryItem = {
      ...newItem,
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: new Date().toISOString()
    };
    
    const updatedHistory = [...history, freshItem];
    setHistory(updatedHistory);
    
    try {
      localStorage.setItem('vccs_quiz_history_v2', JSON.stringify(updatedHistory));
    } catch (err) {
      console.warn('Lỗi lưu lịch sử làm bài:', err);
    }
  };

  // Clean / Clear history log
  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('vccs_quiz_history_v2');
    } catch (err) {
      console.error('Lỗi làm sạch dữ liệu:', err);
    }
  };

  // Compute aggregated statistics from history
  const stats = useMemo((): AppStats => {
    const practices = history.filter(h => h.mode === 'practice');
    const exams = history.filter(h => h.mode === 'exam');
    
    // Avg exam score calculation
    const totalExamScores = exams.reduce((acc, h) => acc + h.score, 0);
    const avgScore = exams.length > 0 ? totalExamScores / exams.length : 0;
    
    // Passing count rate
    const passedCount = exams.filter(h => h.passed).length;
    const passRate = exams.length > 0 ? (passedCount / exams.length) * 100 : 0;

    // Correct rates breakdown by categories based on questions
    // Map of Category -> { correctCount, totalAnsweredPool }
    const catRate: Record<string, { correct: number; total: number }> = {};
    
    // Populate with categories we found
    categories.forEach(cat => {
      catRate[cat] = { correct: 0, total: 0 };
    });

    // Populate using quiz statistics or just simple default structure
    // Let's compute weights based on actual exams completed
    history.forEach(item => {
      // For each item, add the correct count to its specified category name
      // If it is "Tất cả", distribute proportional or add to each
      const catsInvolved = item.categoryName === 'Tất cả' ? categories : item.categoryName.split(',').map(s => s.trim());
      
      catsInvolved.forEach(catName => {
        if (catRate[catName]) {
          // Approximate distributed correctness
          const proportionAnswered = item.totalQuestions / catsInvolved.length;
          const proportionCorrect = item.correctAnswersCount / catsInvolved.length;
          
          catRate[catName].total += Math.round(proportionAnswered);
          catRate[catName].correct += Math.round(proportionCorrect);
        }
      });
    });

    // Ensure we don't have zeros if categories lists have no records yet
    categories.forEach(cat => {
      if (catRate[cat].total === 0) {
        // Set zero default
        catRate[cat] = { correct: 0, total: 0 };
      }
    });

    return {
      totalPractices: practices.length,
      totalExams: exams.length,
      averageExamScore: avgScore,
      passingRate: passRate,
      categoryCorrectRate: catRate
    };
  }, [history, categories]);

  // Navigation tab switcher template helper
  const handleStartSession = (mode: QuizMode, options: { 
    selectedCategories: string[]; 
    questionCount: number; 
    shuffle: boolean;
    durationMinutes: number;
  }) => {
    setActiveSession({
      mode,
      ...options
    });
  };

  const handleExitSession = () => {
    setActiveSession(null);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-indigo-500 selection:text-white" id="main-app-container">
      
      {/* Sleek Header / Navigation Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          
          {/* Logo Heading left side */}
          <div 
            onClick={() => {
              if (activeSession) {
                if (confirm("Bạn sẽ hủy bỏ bài làm hiện tại. Tiếp tục quay lại trang chủ?")) {
                  setActiveSession(null);
                }
              }
              setActiveTab('dashboard');
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 leading-none">
                VCCS Quiz 4G
              </h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                Trắc Nghiệm Lý Thuyết
              </span>
            </div>
          </div>

          {/* Tab Selection controller (Only visible if NOT in active quiz session) */}
          {!activeSession && (
            <nav className="flex items-center gap-1 md:gap-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'dashboard' 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-50/55' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Trang Chủ</span>
              </button>
              
              <button
                onClick={() => setActiveTab('browser')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'browser' 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-50/55' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Kho Câu Hỏi</span>
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'stats' 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-50/55' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>Thống Kê</span>
              </button>

              {/* Refresh / Dynamic Sync Button */}
              <button
                onClick={() => loadQuestions(true)}
                title="Đồng bộ lại từ Google Sheets"
                className="p-2 ml-1 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50/50 transition-colors"
                id="btn-sync-google-sheets"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </nav>
          )}

          {/* Active session back button overlay */}
          {activeSession && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase font-mono">
                <Compass className="w-3.5 h-3.5 text-indigo-600" />
                Chế độ {activeSession.mode === 'practice' ? 'Luyện tập' : 'Thi thử'}
              </div>
            </div>
          )}

        </div>
      </header>

      {/* Main Body content area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6" id="main-content-layout">
        {isLoading ? (
          <div className="py-24 text-center flex flex-col items-center justify-center space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
              <GraduationCap className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Đang Đồng Bộ Ngân Hàng Câu Hỏi...</h3>
              <p className="text-xs text-slate-400 mt-1">Đang nạp dữ liệu câu hỏi lý thuyết trực tiếp từ Google Sheets của bạn</p>
            </div>
          </div>
        ) : activeSession ? (
          /* Active test taking simulation takes precedence */
          <QuizEngine
            questions={questions}
            mode={activeSession.mode}
            questionCount={activeSession.questionCount}
            selectedCategories={activeSession.selectedCategories}
            shuffle={activeSession.shuffle}
            durationMinutes={activeSession.durationMinutes}
            onExit={handleExitSession}
            onSaveHistory={handleSaveHistory}
            onPrintReport={setPrintData}
          />
        ) : (
          /* Main tab routers */
          <div>
            {activeTab === 'dashboard' && (
              <Dashboard
                questions={questions}
                categories={categories}
                onStartQuiz={handleStartSession}
                syncSource={syncSource}
                syncError={syncError}
                onSelectTab={setActiveTab}
                stats={stats}
                onSyncComplete={handleGoogleSheetSyncComplete}
                onPrintReport={setPrintData}
              />
            )}
            
            {activeTab === 'browser' && (
              <QuestionBrowser
                questions={questions}
                categories={categories}
              />
            )}

            {activeTab === 'stats' && (
              <HistoryStats
                history={history}
                stats={stats}
                onClearHistory={handleClearHistory}
                onSelectTab={setActiveTab}
                onPrintReport={setPrintData}
              />
            )}
          </div>
        )}
      </main>

      {/* Polished Site Footer */}
      <footer className="bg-white border-t border-slate-100 mt-12 py-6 text-xs text-slate-400 font-medium" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 uppercase font-mono tracking-wider font-bold text-[10px] text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Nguồn cấp dữ liệu:</span>
            <span className="text-indigo-600">{syncSource === 'google_sheets' ? 'Google Sheets Live Cloud' : 'Bộ lưu trữ dự phòng Offline'}</span>
          </div>
          
          <div className="text-center md:text-right space-y-1">
            <p>© {new Date().getFullYear()} - Hệ Thống Trắc Nghiệm Đào Tạo Công Nghệ VCCS 4G.</p>
            <p className="text-[10px] text-slate-300">Thiết kế tinh tế theo phong cách Swiss UI • Chạy ổn định ngoại tuyến.</p>
          </div>
        </div>
      </footer>

      {printData && (
        <ExamReportPDF 
          data={printData} 
          onClose={() => setPrintData(null)} 
        />
      )}

    </div>
  );
}
