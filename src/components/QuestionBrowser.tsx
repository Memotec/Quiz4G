import React, { useState, useMemo } from 'react';
import { Search, BookOpen, CheckCircle, Eye, EyeOff, LayoutGrid, Check, Info } from 'lucide-react';
import { Question } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface QuestionBrowserProps {
  questions: Question[];
  categories: string[];
}

export default function QuestionBrowser({ questions, categories }: QuestionBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  // Filter questions based on search term and category
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchCategory = selectedCategory === 'Tất cả' || q.category === selectedCategory;
      const matchSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          q.options.some(opt => opt.text.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          q.stt.toString() === searchTerm;
      return matchCategory && matchSearch;
    });
  }, [questions, selectedCategory, searchTerm]);

  const toggleRevealAnswer = (id: string) => {
    setRevealedAnswers(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'TCP/IP Căn bản':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Khai thác đầu cuối CWP':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Phần cứng':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Cấu hình':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6" id="question-browser-root">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 animate-pulse" />
            Ngân Hàng Câu Hỏi Ôn Tập
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu và học trực tiếp toàn bộ {questions.length} câu hỏi lý thuyết cùng đáp án chính xác.
          </p>
        </div>
        
        {/* Toggle all button */}
        <button
          onClick={() => {
            setShowAllAnswers(!showAllAnswers);
            // Reset individual reveals
            setRevealedAnswers({});
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            showAllAnswers 
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          id="btn-toggle-all-answers"
        >
          {showAllAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showAllAnswers ? 'Ẩn tất cả đáp án' : 'Hiện tất cả đáp án'}
        </button>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã số, nội dung câu hỏi hoặc đáp án..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm"
            id="input-search-questions"
          />
        </div>

        {/* Categories filters scroll */}
        <div className="flex flex-wrap gap-2 pt-1" id="categories-filter-container">
          <button
            onClick={() => setSelectedCategory('Tất cả')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              selectedCategory === 'Tất cả'
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tất cả ({questions.length})
          </button>
          {categories.map(cat => {
            const count = questions.filter(q => q.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-150 text-slate-600 hover:bg-indigo-50 hover:border-indigo-100'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Search results summary */}
      <div className="text-xs text-slate-500 flex justify-between items-center px-1">
        <span>Đang hiển thị <strong className="text-slate-800">{filteredQuestions.length}</strong> trên sản phẩm {questions.length} câu hỏi</span>
        {searchTerm && <span>Từ khóa: "{searchTerm}"</span>}
      </div>

      {/* Questions list */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 px-4 text-center">
          <LayoutGrid className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700">Không tìm thấy câu hỏi phù hợp</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Hãy thử tìm bằng từ khóa khác hoặc chuyển danh mục hiển thị.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4" id="questions-grid-container">
          <AnimatePresence mode="popLayout">
            {filteredQuestions.map((question, index) => {
              const isRevealed = showAllAnswers || !!revealedAnswers[question.id];
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={question.id}
                  className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200"
                >
                  <div className="flex justify-between items-start gap-4">
                    {/* Category Label */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                        # {question.stt}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${getCategoryColor(question.category)}`}>
                        {question.category}
                      </span>
                    </div>

                    {/* Eye toggle for this question */}
                    {!showAllAnswers && (
                      <button
                        onClick={() => toggleRevealAnswer(question.id)}
                        className={`p-1.5 rounded-lg border hover:bg-slate-50 transition-all ${
                          isRevealed ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-slate-400 border-slate-200'
                        }`}
                        title={isRevealed ? "Ẩn đáp án" : "Xem đáp án"}
                      >
                        {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {/* Question Content */}
                  <h3 className="text-slate-800 font-semibold mt-4 text-base leading-relaxed">
                    {question.title}
                  </h3>

                  {/* Options List */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5" id={`options-grid-${question.id}`}>
                    {question.options.map(option => {
                      const isCorrectAnswer = option.key === question.answer;
                      return (
                        <div
                          key={option.key}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all text-sm ${
                            isRevealed && isCorrectAnswer
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium'
                              : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold font-mono transition-all uppercase ${
                            isRevealed && isCorrectAnswer
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-slate-200/80 text-slate-600'
                          }`}>
                            {option.key}
                          </span>
                          <span className="leading-relaxed">{option.text}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Revealed Badge & Answer Info */}
                  <AnimatePresence>
                    {isRevealed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-3 border-t border-dashed border-emerald-100 flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 animate-bounce" />
                          <span>Mã đáp án đúng:</span>
                          <span className="uppercase text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md font-mono text-sm leading-none flex items-center gap-1">
                            {question.answer} <Check className="w-3 h-3 text-emerald-600" />
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
