import React, { useState, useEffect, useRef } from 'react';
import { Question, UserAnswer, QuizMode, ExamHistoryItem } from '../types';
import { ChevronLeft, ChevronRight, Bookmark, ArrowLeft, Send, Check, X, Timer, HelpCircle, Activity, Award, LogOut, RefreshCw, Eye, EyeOff, Maximize2, Minimize2, Type, Printer, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuizEngineProps {
  questions: Question[];
  mode: QuizMode;
  questionCount: number;
  selectedCategories: string[];
  shuffle: boolean;
  durationMinutes: number;
  onExit: () => void;
  onSaveHistory: (item: Omit<ExamHistoryItem, 'id' | 'date'>) => void;
  onPrintReport?: (data: any) => void;
}

export default function QuizEngine({
  questions,
  mode,
  questionCount,
  selectedCategories,
  shuffle,
  durationMinutes,
  onExit,
  onSaveHistory,
  onPrintReport
}: QuizEngineProps) {
  // Prep question array on startup
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  
  // Timer states
  const [timeRemaining, setTimeRemaining] = useState<number>(durationMinutes * 60);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter keys for feedback review
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect' | 'flagged'>('all');

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Focus & size optimization states
  const [isFocusMode, setIsFocusMode] = useState<boolean>(true); // default to true to increase concentration immediately
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl' | '2xl'>('xl'); // default to 'xl' for bold and distinct readability

  // Sync fullscreen change listener to support Esc key exits gracefully
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => {
          console.warn("Fullscreen request rejected. Using simulated full-viewport focus state instead.", err);
          setIsFullscreen(!isFullscreen); // Toggle simulated mode
        });
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => {
          console.warn("Error exiting fullscreen. Toggling simulated state.", err);
          setIsFullscreen(false);
        });
    }
  };

  // Initialize questions
  useEffect(() => {
    // 1. Filter by category
    let pool = [...questions];
    
    // 2. Shuffle if requested
    if (shuffle) {
      pool = pool.sort(() => Math.random() - 0.5);
    } else {
      // Sort by STT
      pool = pool.sort((a,b) => a.stt - b.stt);
    }

    // 3. Take the count
    const limit = questionCount === -1 ? pool.length : Math.min(questionCount, pool.length);
    const selected = pool.slice(0, limit);
    
    setSessionQuestions(selected);
    
    // Initialize answers map
    const initialAnswers: Record<string, UserAnswer> = {};
    selected.forEach(q => {
      initialAnswers[q.id] = {
        questionId: q.id,
        selectedOptionKey: null,
        isCorrect: null,
        isFlagged: false
      };
    });
    setAnswers(initialAnswers);
    setCurrentIndex(0);
    setIsCompleted(false);
    setTimeRemaining(durationMinutes * 60);
    setTimeSpent(0);

    // Build timer
    if (mode === 'exam') {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleForceSubmit();
            return 0;
          }
          return prev - 1;
        });
        setTimeSpent(prev => prev + 1);
      }, 1000);
    } else {
      // Just track elapsed time for practice
      timerRef.current = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [questions, mode, questionCount, selectedCategories, shuffle, durationMinutes]);

  const handleForceSubmit = () => {
    setIsCompleted(true);
  };

  // Option selection
  const handleSelectOption = (optionKey: string) => {
    if (isCompleted) return;
    const currentQ = sessionQuestions[currentIndex];
    if (!currentQ) return;

    const isCorrect = optionKey.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

    // In practice mode, users can click to answer.
    // In exam mode, they can do same, but we show no correctness colors until completed.
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        selectedOptionKey: optionKey,
        isCorrect: mode === 'practice' ? isCorrect : null
      }
    }));
  };

  // Flag toggle
  const toggleFlag = () => {
    const currentQ = sessionQuestions[currentIndex];
    if (!currentQ) return;
    
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        isFlagged: !prev[currentQ.id]?.isFlagged
      }
    }));
  };

  // Submit test
  const handleSubmitTest = () => {
    // Check if unanswered questions exist
    const totalQ = sessionQuestions.length;
    const answeredCount = (Object.values(answers) as UserAnswer[]).filter(a => a.selectedOptionKey !== null).length;
    const unansweredCount = totalQ - answeredCount;

    if (unansweredCount > 0) {
      const confirmSubmit = window.confirm(
        `Bạn vẫn còn ${unansweredCount} câu hỏi chưa trả lời. Bạn có chắc chắn muốn nộp bài thi?`
      );
      if (!confirmSubmit) return;
    } else {
      const confirmSubmit = window.confirm("Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?");
      if (!confirmSubmit) return;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    // Calculate score
    let correctCount = 0;
    const finalizedAnswers = { ...answers };

    sessionQuestions.forEach(q => {
      const ansObj = finalizedAnswers[q.id];
      const isCorrect = ansObj?.selectedOptionKey?.trim().toLowerCase() === q.answer.trim().toLowerCase();
      ansObj.isCorrect = isCorrect;
      if (isCorrect) {
        correctCount++;
      }
    });

    setAnswers(finalizedAnswers);
    setIsCompleted(true);

    // Convert score out of 10
    const rawScore = (correctCount / totalQ) * 10;
    const roundedScore = Math.round(rawScore * 10) / 10;
    const passed = roundedScore >= 7.0; // 7.0 passing grade standard Vietnamese rating

    // Save detailed results for PDF export
    try {
      const detailedReport = {
        date: new Date().toISOString(),
        mode: mode,
        categoryName: selectedCategories.length === 4 ? "Tất cả" : selectedCategories.join(', '),
        totalQuestions: totalQ,
        correctAnswersCount: correctCount,
        score: roundedScore,
        timeSpentSeconds: timeSpent,
        passed: passed,
        questions: sessionQuestions,
        answers: finalizedAnswers
      };
      localStorage.setItem('vccs_recent_exam_details', JSON.stringify(detailedReport));
    } catch (err) {
      console.error('Lỗi lưu báo cáo chi tiết:', err);
    }

    // Save to server/local history
    onSaveHistory({
      mode: mode,
      categoryName: selectedCategories.length === 4 ? "Tất cả" : selectedCategories.join(', '),
      totalQuestions: totalQ,
      correctAnswersCount: correctCount,
      score: roundedScore,
      timeSpentSeconds: timeSpent,
      passed: passed
    });
  };

  // Time format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = sessionQuestions[currentIndex];
  const totalQuestionsCount = sessionQuestions.length;
  
  if (!currentQuestion) {
    return (
      <div className="flex justify-center items-center h-96 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // Question navigation list
  const activeAnswer = answers[currentQuestion.id];
  const isSelected = activeAnswer?.selectedOptionKey !== null;

  // Grade Screen layout
  if (isCompleted) {
    // Generate overall results
    const totalQ = sessionQuestions.length;
    const correctCount = (Object.values(answers) as UserAnswer[]).filter(a => a.isCorrect === true).length;
    const finalScore = Math.round(((correctCount / totalQ) * 10) * 10) / 10;
    const ratioPercentage = Math.round((correctCount / totalQ) * 100);
    const passed = finalScore >= 7.0;

    // Filtered questions for the feedback list
    const filteredReviewQuestions = sessionQuestions.filter(q => {
      const ansObj = answers[q.id];
      if (reviewFilter === 'all') return true;
      if (reviewFilter === 'correct') return ansObj && ansObj.isCorrect === true;
      if (reviewFilter === 'incorrect') return ansObj && (ansObj.isCorrect === false || ansObj.selectedOptionKey === null);
      if (reviewFilter === 'flagged') return ansObj && ansObj.isFlagged === true;
      return true;
    });

    const displayMinsSpent = Math.floor(timeSpent / 60);
    const displaySecsSpent = timeSpent % 60;

    // Scroll to detail handler
    const handleScrollToQuestion = (questionId: string, isCorrect: boolean, isUnanswered: boolean) => {
      // Guarantee visibility by adjusting filter if the question isn't present
      if (reviewFilter !== 'all') {
        if (reviewFilter === 'correct' && !isCorrect) {
          setReviewFilter('all');
        } else if (reviewFilter === 'incorrect' && isCorrect) {
          setReviewFilter('all');
        }
      }

      // Wait a frame for React state update before querying DOM
      setTimeout(() => {
        const el = document.getElementById(`review-card-${questionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Clear any active highlights
          document.querySelectorAll('.flash-highlight-active').forEach(item => {
            item.classList.remove('ring-4', 'ring-indigo-500/50', 'bg-indigo-50/10', 'flash-highlight-active');
          });
          
          // Apply highlight visual effect
          el.classList.add('ring-4', 'ring-indigo-500/50', 'bg-indigo-50/10', 'flash-highlight-active');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-indigo-500/50', 'bg-indigo-50/10', 'flash-highlight-active');
          }, 3500);
        }
      }, 80);
    };

    return (
      <div className="space-y-6" id="quiz-completed-review-root">
        {/* Exam Results Scorecard Hero */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 md:p-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center lg:text-left">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                passed 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : 'bg-rose-50 text-rose-700 border border-rose-100'
              }`}>
                {passed ? 'ĐẠT YÊU CẦU' : 'CHƯA ĐẠT HẠNG'}
              </span>
              
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">
                {passed 
                  ? 'Chúc Mừng! Bạn Đã Vượt Qua Học Phần 🎉' 
                  : 'Tiếc Quá! Hãy Xem Lại Và Cố Gắng Thêm Lần Sau 💪'
                }
              </h2>
              <p className="text-sm text-slate-500 max-w-xl">
                Bạn đã hoàn thành bài {mode === 'practice' ? 'luyện tập tự do' : 'thi thử tính giờ'} gồm {totalQ} câu hỏi. Dưới đây là thống kê chi tiết hiệu suất trả lời câu hỏi và kết quả đánh giá kỹ năng của bạn.
              </p>

              <div className="pt-2 flex flex-wrap justify-center lg:justify-start gap-4">
                <div className="bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Thời gian học</span>
                  <span className="text-sm font-bold text-slate-700">{displayMinsSpent} phút {displaySecsSpent === 0 ? '' : `${displaySecsSpent} giây`}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Chế độ bài làm</span>
                  <span className="text-sm font-bold text-slate-700 uppercase">{mode === 'practice' ? 'Luyện tập' : 'Thi thử'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Số câu chính xác</span>
                  <span className="text-sm font-bold text-slate-700">{correctCount} / {totalQ} câu</span>
                </div>
              </div>
            </div>

            {/* Score Ring circular visual chart element */}
            <div className="flex flex-col items-center justify-center bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 relative min-w-[200px]">
              <div className="relative flex items-center justify-center w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    stroke={passed ? '#10b981' : '#f43f5e'}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 * (1 - ratioPercentage / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center text-center">
                  <span className="text-3xl font-extrabold text-slate-800 font-mono">{finalScore.toFixed(1)}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">ĐIỂM SỐ</span>
                </div>
              </div>
              <div className="mt-3 text-center">
                <span className="text-xs font-bold text-slate-500 font-mono uppercase block">{ratioPercentage}% Trả lời đúng</span>
              </div>
            </div>
          </div>

          {/* Interactive Bảng Thống Kê / Bản Đồ Tổng Hợp Chi Tiết */}
          <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Bản đồ hiệu suất làm bài chi tiết
              </h4>
              <p className="text-[10px] text-slate-400">Nhấp vào từng câu để di chuyển nhanh đến phần giải thích đáp án và lỗi sai</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
              <div className="bg-emerald-50 border border-emerald-100/80 rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">✓</span>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block leading-none">Đáp án đúng</span>
                  <span className="text-xs font-bold text-emerald-800">{correctCount} câu</span>
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-100/80 rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">✗</span>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block leading-none">Đáp án sai</span>
                  <span className="text-xs font-bold text-rose-800">{(Object.values(answers) as UserAnswer[]).filter(a => a.selectedOptionKey !== null && a.isCorrect === false).length} câu</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100/80 rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs">⚪</span>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block leading-none">Chưa trả lời</span>
                  <span className="text-xs font-bold text-amber-800">{(Object.values(answers) as UserAnswer[]).filter(a => a.selectedOptionKey === null).length} câu</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-3">
              {sessionQuestions.map((q, idx) => {
                const ans = answers[q.id];
                const isCorrect = ans?.isCorrect === true;
                const isUnanswered = ans?.selectedOptionKey === null;

                let cellStyle = "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300";
                let badgeChar = "✗";

                if (isUnanswered) {
                  cellStyle = "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:border-slate-300";
                  badgeChar = "—";
                } else if (isCorrect) {
                  cellStyle = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300";
                  badgeChar = "✓";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleScrollToQuestion(q.id, isCorrect, isUnanswered)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${cellStyle}`}
                  >
                    <span>Câu {idx + 1}</span>
                    <span className="opacity-80 font-extrabold">{badgeChar}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Footer Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-3 justify-center lg:justify-start">
            <button
              onClick={onExit}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay Lại Trang Chủ
            </button>

            {/* Download PDF button */}
            <button
              onClick={() => {
                const reportData = {
                  date: new Date().toISOString(),
                  mode: mode,
                  categoryName: selectedCategories.length === 4 ? "Tất cả" : selectedCategories.join(', '),
                  totalQuestions: totalQ,
                  correctAnswersCount: correctCount,
                  score: finalScore,
                  timeSpentSeconds: timeSpent,
                  passed: passed,
                  questions: sessionQuestions,
                  answers: answers
                };
                if (onPrintReport) {
                  onPrintReport(reportData);
                }
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              title="Xuất bảng điểm kết quả thi thành PDF chuẩn A4"
            >
              <FileText className="w-4 h-4 text-emerald-100 animate-pulse" />
              Xuất PDF Kết Quả
            </button>

            <button
              onClick={() => {
                // Trigger reload of identical session configuration
                setIsCompleted(false);
                setCurrentIndex(0);
                // Reset state triggers reload inside useEffect
                setAnswers({});
                setTimeSpent(0);
                setTimeRemaining(durationMinutes * 60);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              Làm Lại Đợt Khác
            </button>
          </div>
        </div>

        {/* Detailed Question Review List */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                Đáp Án &amp; Xem Lại Câu Hỏi Chi Tiết
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Phân tích từng câu hỏi đã trả lời để học sâu, nhớ kỹ từ lỗi sai</p>
            </div>

            {/* Filter tags toolbar */}
            <div className="flex flex-wrap bg-white border border-slate-200/60 p-1 rounded-xl">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  reviewFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tất cả ({totalQ})
              </button>
              <button
                onClick={() => setReviewFilter('correct')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  reviewFilter === 'correct' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Đúng ({correctCount})
              </button>
              <button
                onClick={() => setReviewFilter('incorrect')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  reviewFilter === 'incorrect' ? 'bg-rose-50 text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sai / Chưa Làm ({totalQ - correctCount})
              </button>
            </div>
          </div>

          {/* Render target review cards */}
          {filteredReviewQuestions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 border-dashed p-12 text-center text-slate-400 text-xs">
              Mục này hiện đang trống. Hãy kiểm tra bộ lọc khác.
            </div>
          ) : (
            <div className="space-y-4" id="review-cards-accordion">
              {filteredReviewQuestions.map((q, qIndex) => {
                const ans = answers[q.id];
                const isUserCorrect = ans?.isCorrect === true;
                
                return (
                  <div 
                    key={q.id} 
                    id={`review-card-${q.id}`}
                    className={`bg-white rounded-2xl border p-5 md:p-6 shadow-sm transition-all duration-200 ${
                      ans?.selectedOptionKey === null 
                        ? 'border-amber-200 bg-amber-50/10'
                        : isUserCorrect 
                          ? 'border-emerald-100 bg-emerald-50/5' 
                          : 'border-rose-100 bg-rose-50/5'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">
                          Câu {sessionQuestions.indexOf(q) + 1}
                        </span>
                        <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                          {q.category}
                        </span>
                      </div>

                      {/* Display Status tag */}
                      <div>
                        {ans?.selectedOptionKey === null ? (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                            Chưa trả lời
                          </span>
                        ) : isUserCorrect ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-250 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase inline-flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Trả lời đúng
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 border border-rose-250 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase inline-flex items-center gap-0.5">
                            <X className="w-3 h-3" /> Trả lời sai
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-slate-800 font-semibold mt-4 text-sm leading-relaxed">
                      {q.title}
                    </h4>

                    {/* Options list static render */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map(opt => {
                        const isChosen = ans?.selectedOptionKey === opt.key;
                        const isCorrectKey = q.answer.trim().toLowerCase() === opt.key.trim().toLowerCase();

                        let optCardStyle = 'bg-slate-50 text-slate-600 border-slate-100';
                        let optCircleStyle = 'bg-slate-200 text-slate-600';

                        if (isCorrectKey) {
                          // Correct option is always green
                          optCardStyle = 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold';
                          optCircleStyle = 'bg-emerald-500 text-white';
                        } else if (isChosen && !isUserCorrect) {
                          // Wrong user choice is highlighted red
                          optCardStyle = 'bg-rose-50 border-rose-200 text-rose-900 font-semibold';
                          optCircleStyle = 'bg-rose-500 text-white';
                        }

                        return (
                          <div 
                            key={opt.key} 
                            className={`flex items-start gap-3 p-3 rounded-xl border text-xs transition-all ${optCardStyle}`}
                          >
                            <span className={`w-6 h-6 rounded-lg font-mono font-bold flex items-center justify-center text-[10px] uppercase flex-shrink-0 ${optCircleStyle}`}>
                              {opt.key}
                            </span>
                            <span className="leading-relaxed">{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-dashed border-slate-100 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <span>Khoá đáp án chính xác: </span>
                        <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase font-mono font-bold">
                          {q.answer}
                        </strong>
                      </div>
                      
                      {ans?.selectedOptionKey && !isUserCorrect && (
                        <div className="text-rose-600 font-medium">
                          Bạn đã chọn mã: <strong className="uppercase font-mono font-bold bg-rose-50 px-2 py-0.5 rounded">{ans.selectedOptionKey}</strong>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- ACTIVE QUIZ TEST SESSION SCREEN ---
  const questionFontClass = {
    base: 'text-base font-semibold leading-relaxed text-slate-850',
    lg: 'text-lg md:text-xl font-bold leading-relaxed text-slate-900',
    xl: 'text-xl md:text-2xl font-black tracking-tight leading-relaxed text-indigo-950',
    '2xl': 'text-2xl md:text-3xl font-black tracking-tight leading-relaxed text-slate-900 border-b border-indigo-100 pb-2'
  }[fontSize];

  const optionFontClass = {
    base: 'text-xs md:text-sm text-slate-700 leading-relaxed mt-0.5',
    lg: 'text-sm md:text-base font-semibold text-slate-850 leading-relaxed mt-0.5',
    xl: 'text-base md:text-lg font-black text-slate-900 leading-relaxed mt-0.5',
    '2xl': 'text-lg md:text-xl font-black text-slate-950 leading-relaxed mt-0.5'
  }[fontSize];

  return (
    <div 
      className={`transition-all duration-300 ${
        isFullscreen 
          ? 'fixed inset-0 z-[999] bg-slate-50 overflow-y-auto px-6 py-8 md:p-12' 
          : 'space-y-6'
      }`} 
      id="active-quiz-engine-root"
    >
      <div className={`space-y-6 ${isFullscreen ? 'max-w-7xl mx-auto w-full' : ''}`}>
        {/* Top Fullscreen Focal Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl shadow-sm gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                {mode === 'practice' ? 'Chế độ luyện tập lý thuyết' : 'Kỳ thi thử trắc nghiệm'}
              </h3>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold font-mono mt-1">
                Làm bài tập trung • Tối đa hóa hiệu năng và khả năng tập trung
              </p>
            </div>
          </div>

          {/* Interactive controls for Focus and font custom sizing */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* 1. Font Size Cycle resizer */}
            <button
              onClick={() => {
                const order: ('base' | 'lg' | 'xl' | '2xl')[] = ['base', 'lg', 'xl', '2xl'];
                const nextIdx = (order.indexOf(fontSize) + 1) % order.length;
                setFontSize(order[nextIdx]);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer select-none"
              title="Nhấp để thay đổi cỡ chữ hiển thị"
            >
              <Type className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Chữ:</span>
              <span className="font-mono bg-indigo-100 text-indigo-950 px-1.5 py-0.5 rounded text-[9px] uppercase font-black">
                {fontSize === 'base' ? 'Thường' : fontSize === 'lg' ? 'Lớn' : fontSize === 'xl' ? 'To' : 'Cực Đại'}
              </span>
            </button>

            {/* 2. Focus Toggle button */}
            <button
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition cursor-pointer ${
                isFocusMode 
                  ? 'bg-indigo-600 text-white border-indigo-600' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title={isFocusMode ? "Tắt chế độ tối giản tập trung" : "Bật chế độ tối giản tập trung"}
            >
              {isFocusMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-indigo-650" />}
              <span>{isFocusMode ? 'Đóng tối giản' : 'Tối giản (Tập trung)'}</span>
            </button>

            {/* 3. Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 hover:bg-slate-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Bật toàn màn hình tập trung'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span className="hidden sm:inline">Thoát Toàn Màn</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Toàn Màn Hình</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Focus Mode horizontal statistics and mini controllers */}
        {isFocusMode && (
          <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-medium shadow-sm transition-all">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Thời gian làm bài:</span>
              <span className={`font-mono font-black text-sm bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 ${
                mode === 'exam' && timeRemaining < 180 
                  ? 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse' 
                  : 'text-slate-700'
              }`}>
                {mode === 'practice' ? formatTime(timeSpent) : formatTime(timeRemaining)}
              </span>
            </div>
            
            <div className="flex items-center gap-3 flex-1 w-full max-w-sm">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">Tiến độ thi:</span>
              <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden border border-slate-100">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300" 
                  style={{ width: `${((Object.values(answers) as UserAnswer[]).filter(a => a.selectedOptionKey !== null).length / totalQuestionsCount) * 100}%` }}
                />
              </div>
              <span className="font-mono font-black text-slate-700 whitespace-nowrap bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 text-[11px]">
                {((Object.values(answers) as UserAnswer[]).filter(a => a.selectedOptionKey !== null).length)} / {totalQuestionsCount}
              </span>
            </div>

            {/* Quick action maps inside Focus Mode */}
            <div className="flex gap-2 self-stretch sm:self-auto justify-end">
              <button
                onClick={() => {
                  const el = document.getElementById("collapsible-matrix-panel");
                  if (el) {
                    el.classList.toggle("hidden");
                  }
                }}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold rounded-xl border border-indigo-150 transition-all text-[11px] cursor-pointer"
              >
                Hiện Sơ Đồ Câu
              </button>
              <button
                onClick={() => {
                  if(window.confirm("Bạn có chắc chắn muốn rời khỏi lượt thi này? Mọi câu trả lời chưa nộp sẽ bị mất.")) {
                    onExit();
                  }
                }}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-100 font-bold transition-all text-[11px] cursor-pointer"
              >
                Huỷ Bài Thi
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Question matrix inside focus mode to support frictionless traversal */}
        {isFocusMode && (
          <div id="collapsible-matrix-panel" className="hidden bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4 animate-fade-in transition-all">
            <div className="flex items-center justify-between border-b border-slate-55 pb-2">
              <div>
                <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  📁 Sơ Đồ Câu Hỏi Tập Trung
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Nhấp vào ô số để di chuyển nhanh. Ô có gạch vàng dưới là cần xem lại.</p>
              </div>
              <button 
                onClick={() => document.getElementById("collapsible-matrix-panel")?.classList.add("hidden")}
                className="text-slate-400 hover:text-slate-600 font-black cursor-pointer p-1 text-xs"
              >
                Đóng [X]
              </button>
            </div>
            
            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 gap-2 max-h-48 overflow-y-auto pr-1">
              {sessionQuestions.map((q, qIdx) => {
                const ansObj = answers[q.id];
                const isAns = ansObj?.selectedOptionKey !== null;
                const isFlag = ansObj?.isFlagged === true;
                const isCurrent = currentIndex === qIdx;

                let cellStyle = 'bg-slate-50 text-slate-500 border-slate-150 hover:bg-slate-100 hover:border-slate-300';
                if (isAns) cellStyle = 'bg-indigo-50 border-indigo-250 text-indigo-700 font-black';
                if (isFlag) cellStyle = 'bg-amber-100 border-amber-300 text-amber-800 font-black';
                if (isCurrent) cellStyle = 'ring-2 ring-indigo-600 font-black border-indigo-600 bg-white text-indigo-600 scale-105';

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(qIdx);
                      document.getElementById("collapsible-matrix-panel")?.classList.add("hidden");
                    }}
                    className={`aspect-square cursor-pointer flex flex-col items-center justify-center rounded-full text-xs font-bold border font-mono transition-all duration-150 ${cellStyle}`}
                  >
                    <span>{qIdx + 1}</span>
                    {isFlag && <span className="w-1 h-1 rounded-full bg-amber-500 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT: Question Matrix Grid Navigation (Sidebar style on lg to keep it robust) */}
      <div className={`transition-all duration-300 ${isFocusMode ? 'lg:col-span-12 max-w-3xl mx-auto w-full' : 'lg:col-span-8'} order-2 lg:order-1 space-y-6`}>
        
        {/* Active Question Panel */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            {/* Index label / Category */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold font-mono bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-xl">
                Câu Hỏi {currentIndex + 1} / {totalQuestionsCount}
              </span>
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-xl">
                {currentQuestion.category}
              </span>
              {currentQuestion.stt && (
                <span className="text-[10px] font-mono font-bold bg-slate-50 border border-slate-200 text-slate-400 px-2 py-0.5 rounded-lg">
                  STT: {currentQuestion.stt}
                </span>
              )}
            </div>

            {/* Bookmark flag review selection */}
            <button
              onClick={toggleFlag}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                activeAnswer?.isFlagged 
                  ? 'bg-amber-500 border-amber-500 text-white shadow-md' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
              id="btn-flag-question-form"
            >
              <Bookmark className={`w-3.5 h-3.5 ${activeAnswer?.isFlagged ? 'fill-white' : ''}`} />
              {activeAnswer?.isFlagged ? 'Đã lưu xem lại' : 'Đánh dấu câu hỏi'}
            </button>
          </div>

          {/* Question text block */}
          <div className="space-y-4">
            <h3 className={`${questionFontClass} pt-2`}>
              {currentQuestion.title}
            </h3>
          </div>

          {/* Interactive Option Selection cards */}
          <div className="grid grid-cols-1 gap-3.5 pt-2" id={`active-question-options-${currentQuestion.id}`}>
            {currentQuestion.options.map(option => {
              const optChosen = activeAnswer?.selectedOptionKey === option.key;
              const isCorrectAnswerKey = option.key === currentQuestion.answer;

              // Styles resolver
              let colStyle = 'border-slate-100 hover:border-slate-350 hover:bg-slate-50 bg-slate-50/40 text-slate-700';
              let badgeStyle = 'bg-slate-200 text-slate-600';
              let iconElement = null;

              if (mode === 'practice') {
                if (isSelected) {
                  if (isCorrectAnswerKey) {
                    // Correct options light green
                    colStyle = 'border-emerald-400 bg-emerald-50 text-emerald-950 font-bold shadow-sm shadow-emerald-50';
                    badgeStyle = 'bg-emerald-600 text-white';
                    iconElement = <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 animate-bounce" />;
                  } else if (optChosen) {
                    // Selected wrong light red
                    colStyle = 'border-rose-400 bg-rose-50 text-rose-950 font-bold shadow-sm shadow-rose-50';
                    badgeStyle = 'bg-rose-600 text-white';
                    iconElement = <X className="w-5 h-5 text-rose-600 flex-shrink-0" />;
                  } else {
                    // Options that have not been selected and are not correct
                    colStyle = 'border-slate-100 bg-slate-50/50 text-slate-400 pointer-events-none opacity-50';
                    badgeStyle = 'bg-slate-100 text-slate-300';
                  }
                } else if (optChosen) {
                  // User has hovered/tentatively parsed
                  colStyle = 'border-indigo-400 bg-indigo-50/30 text-indigo-950';
                  badgeStyle = 'bg-indigo-600 text-white';
                }
              } else {
                // Exam Mode: simple selected border
                if (optChosen) {
                  colStyle = 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-bold scale-[1.01] shadow-sm shadow-indigo-100';
                  badgeStyle = 'bg-indigo-650 text-white';
                }
              }

              // Map padding based on fontSize
              const btnPaddingClass = {
                base: 'p-3.5 rounded-xl',
                lg: 'p-4 rounded-2xl',
                xl: 'p-5 rounded-2xl md:p-5.5',
                '2xl': 'p-6 rounded-3xl'
              }[fontSize];

              return (
                <button
                  key={option.key}
                  onClick={() => handleSelectOption(option.key)}
                  disabled={mode === 'practice' && isSelected}
                  className={`w-full cursor-pointer flex items-center justify-between text-left border transition-all duration-150 ${btnPaddingClass} ${colStyle}`}
                  id={`option-${currentQuestion.id}-${option.key}`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <span className={`w-8 h-8 rounded-xl font-mono font-black flex items-center justify-center text-xs uppercase flex-shrink-0 transition-colors ${badgeStyle}`}>
                      {option.key}
                    </span>
                    <span className={`leading-relaxed flex-1 ${optionFontClass}`}>{option.text}</span>
                  </div>
                  {iconElement}
                </button>
              );
            })}
          </div>

          {/* Feedback Info Box for practice Mode */}
          {mode === 'practice' && isSelected && (
            <div className={`p-4 rounded-2xl text-xs leading-relaxed flex items-start gap-3 mt-4 border ${
              activeAnswer?.isCorrect 
                ? 'bg-emerald-50/40 border-emerald-100 text-emerald-900' 
                : 'bg-rose-50/40 border-rose-100 text-rose-900'
            }`}>
              <HelpCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${activeAnswer?.isCorrect ? 'text-emerald-550' : 'text-rose-550'}`} />
              <div>
                <strong className="block font-bold mb-0.5">
                  {activeAnswer?.isCorrect ? '✓ Đáp án hoàn toàn chính xác!' : '✗ Rất tiếc, đáp án chưa chuẩn!'}
                </strong>
                Phương án chính xác là <strong className="uppercase font-mono font-extrabold bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded text-xs">{currentQuestion.answer}</strong>. Hãy ghi nhớ kiến thức lý thuyết này để tích lũy cho lần thi thư tiếp theo.
              </div>
            </div>
          )}

          {/* Question Footer Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 disabled:text-slate-300 disabled:hover:bg-white border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Câu Trước
            </button>

            {currentIndex === totalQuestionsCount - 1 ? (
              <button
                onClick={handleSubmitTest}
                className="flex items-center gap-1.5 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Nộp Bài Thi
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex(prev => Math.min(totalQuestionsCount - 1, prev + 1))}
                className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Câu Tiếp
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT: Stats / Timer & Questions Grid mapping */}
      <div className="lg:col-span-4 order-1 lg:order-2 space-y-6">
        
        {/* Stats card holding Timer / Progress info */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              {mode === 'practice' ? 'Thời gian tích lũy' : 'Thời gian làm bài'}
            </span>
            
            <div className={`flex items-center gap-1.5 font-mono font-bold text-sm bg-slate-50 px-3 py-1.5 rounded-xl border ${
              mode === 'exam' && timeRemaining < 180 
                ? 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse' 
                : 'text-slate-700 border-slate-200/60'
            }`}>
              <Timer className="w-4 h-4 text-indigo-600" />
              <span>{mode === 'practice' ? formatTime(timeSpent) : formatTime(timeRemaining)}</span>
            </div>
          </div>

          {/* Simple progress metric */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Tiến độ bài thi:</span>
              <span className="font-bold font-mono text-slate-700">
                {(Object.values(answers) as UserAnswer[]).filter(a => a.selectedOptionKey !== null).length} / {totalQuestionsCount} câu
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-300" 
                style={{ width: `${((Object.values(answers) as UserAnswer[]).filter(a => a.selectedOptionKey !== null).length / totalQuestionsCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-2">
            <button
              onClick={() => {
                if(window.confirm("Bạn có chắc chắn muốn rời khỏi lượt thi này? Mọi câu trả lời chưa nộp sẽ bị mất.")) {
                  onExit();
                }
              }}
              className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-rose-50 hover:bg-rose-100/70 text-rose-600 rounded-xl text-xs font-semibold border border-rose-100 transition-all cursor-pointer"
              id="btn-quit-quiz-session"
            >
              <LogOut className="w-3.5 h-3.5" />
              Thoát Bài
            </button>

            {mode === 'exam' && (
              <button
                onClick={handleSubmitTest}
                className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Nộp Bài Sớm
              </button>
            )}
          </div>
        </div>

        {/* Question Switch Quick Map */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 space-y-4">
          <div>
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-600" />
              Sơ Đồ Câu Trực Quan
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Nhấp vào ô số để di chuyển nhanh tới câu hỏi tương ứng</p>
          </div>

          {/* Circular/Square clickable grids */}
          <div className="grid grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1" id="question-navigation-matrix">
            {sessionQuestions.map((q, qIdx) => {
              const ansObj = answers[q.id];
              const isAns = ansObj?.selectedOptionKey !== null;
              const isFlag = ansObj?.isFlagged === true;
              const isCurrent = currentIndex === qIdx;

              let cellStyle = 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100 hover:border-slate-300';
              
              if (isAns) {
                // Answered questions list color
                cellStyle = 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100/80';
              }
              if (isFlag) {
                // Flagged takes amber hierarchy
                cellStyle = 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-700';
              }
              if (isCurrent) {
                // Bold current active cell
                cellStyle = 'ring-2 ring-indigo-600 font-bold border-indigo-600 bg-white text-indigo-600';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(qIdx)}
                  className={`aspect-square cursor-pointer flex flex-col items-center justify-center rounded-full text-xs font-bold border font-mono transition-all duration-150 ${cellStyle}`}
                  title={`Câu hỏi ${qIdx + 1}${isFlag ? ' (Đã đánh dấu)' : ''}${isAns ? ' (Đã trả lời)' : ''}`}
                >
                  <span>{qIdx + 1}</span>
                  {isFlag && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick legend */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1.5 text-[9px] text-slate-400 font-medium">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-slate-50 border border-slate-100 rounded-full" />
              <span>Chưa làm</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-indigo-50 border border-indigo-200 rounded-full" />
              <span>Đã làm</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded-full" />
              <span>Cần xem lại</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 ring-2 ring-indigo-600 rounded-full bg-white" style={{boxShadow: 'none'}} />
              <span>Đang chọn</span>
            </div>
          </div>
        </div>

      </div>

    </div>
    </div>
    </div>
  );
}
