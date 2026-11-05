import React, { useState } from 'react';
import {
  CustomEventForm,
  FormQuestion,
  QuestionType,
  QUESTION_TYPES,
} from '../../../lib/customFormTypes';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Settings,
  Image as ImageIcon,
  Check,
  ChevronDown,
  X,
  Type,
  AlignLeft,
  CheckCircle2,
  CheckSquare,
  Calendar,
  Clock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface Props {
  initialForm?: CustomEventForm | null;
  onSave: (form: CustomEventForm) => Promise<void>;
  onCancel: () => void;
}

export default function CustomFormBuilder({ initialForm, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initialForm?.title || 'Formulir Pendaftaran Acara');
  const [description, setDescription] = useState(
    initialForm?.description || 'Silakan lengkapi formulir pendaftaran berikut dengan data yang benar.'
  );
  const [showOnHomepage, setShowOnHomepage] = useState(initialForm?.showOnHomepage ?? true);
  const [active, setActive] = useState(initialForm?.active ?? true);
  const [headerBannerUrl, setHeaderBannerUrl] = useState(initialForm?.headerBannerUrl || '');

  const [questions, setQuestions] = useState<FormQuestion[]>(() => {
    if (initialForm && initialForm.questions && initialForm.questions.length > 0) {
      return initialForm.questions;
    }
    // Default initial template resembling Google Form event registration
    return [
      {
        id: crypto.randomUUID(),
        title: 'Nama Lengkap',
        type: 'short_text',
        required: true,
        placeholder: 'Jawaban Anda',
      },
      {
        id: crypto.randomUUID(),
        title: 'Nomor WhatsApp / Telepon',
        type: 'short_text',
        required: true,
        placeholder: '08xxxxxxxxxx',
      },
      {
        id: crypto.randomUUID(),
        title: 'Apakah Anda akan hadir?',
        type: 'radio',
        required: true,
        options: ['Ya, saya akan hadir', 'Maaf, saya tidak bisa hadir'],
      },
      {
        id: crypto.randomUUID(),
        title: 'Jumlah anggota keluarga / orang yang ikut serta',
        type: 'short_text',
        required: false,
        placeholder: 'Contoh: 3 orang',
      },
    ];
  });

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    questions[0]?.id || null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add new question
  const addQuestion = (type: QuestionType = 'short_text') => {
    const newQ: FormQuestion = {
      id: crypto.randomUUID(),
      title: 'Pertanyaan Tanpa Judul',
      type,
      required: false,
      options: ['radio', 'checkbox', 'dropdown'].includes(type)
        ? ['Opsi 1', 'Opsi 2']
        : undefined,
      placeholder: '',
    };
    setQuestions(prev => [...prev, newQ]);
    setActiveQuestionId(newQ.id);
  };

  // Duplicate question
  const duplicateQuestion = (q: FormQuestion) => {
    const clone: FormQuestion = {
      ...q,
      id: crypto.randomUUID(),
      title: `${q.title} (Salinan)`,
      options: q.options ? [...q.options] : undefined,
    };
    const index = questions.findIndex(item => item.id === q.id);
    const nextList = [...questions];
    nextList.splice(index + 1, 0, clone);
    setQuestions(nextList);
    setActiveQuestionId(clone.id);
  };

  // Delete question
  const deleteQuestion = (id: string) => {
    if (questions.length <= 1) {
      alert('Formulir setidaknya harus memiliki minimal 1 pertanyaan.');
      return;
    }
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Move question
  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const nextList = [...questions];
    const temp = nextList[idx];
    nextList[idx] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    setQuestions(nextList);
  };

  // Update question
  const updateQuestion = (id: string, patch: Partial<FormQuestion>) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== id) return q;
        const updated = { ...q, ...patch };
        // if type changes to choice and has no options
        if (['radio', 'checkbox', 'dropdown'].includes(updated.type) && (!updated.options || updated.options.length === 0)) {
          updated.options = ['Opsi 1'];
        }
        return updated;
      })
    );
  };

  // Options editor
  const addOption = (qId: string) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== qId) return q;
        const opts = q.options ? [...q.options] : [];
        opts.push(`Opsi ${opts.length + 1}`);
        return { ...q, options: opts };
      })
    );
  };

  const updateOption = (qId: string, optIdx: number, val: string) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== qId) return q;
        const opts = q.options ? [...q.options] : [];
        opts[optIdx] = val;
        return { ...q, options: opts };
      })
    );
  };

  const deleteOption = (qId: string, optIdx: number) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== qId) return q;
        const opts = (q.options || []).filter((_, i) => i !== optIdx);
        return { ...q, options: opts.length > 0 ? opts : ['Opsi 1'] };
      })
    );
  };

  // Helper icon for type
  const renderTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'short_text': return <Type size={16} className="text-blue-500" />;
      case 'paragraph':  return <AlignLeft size={16} className="text-emerald-500" />;
      case 'radio':      return <CheckCircle2 size={16} className="text-purple-500" />;
      case 'checkbox':   return <CheckSquare size={16} className="text-indigo-500" />;
      case 'dropdown':   return <ChevronDown size={16} className="text-amber-500" />;
      case 'date':       return <Calendar size={16} className="text-rose-500" />;
      case 'time':       return <Clock size={16} className="text-sky-500" />;
    }
  };

  const handleSaveForm = async () => {
    if (!title.trim()) {
      setError('Judul formulir tidak boleh kosong');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const formId = initialForm?.id || crypto.randomUUID();
      const slug =
        initialForm?.slug ||
        title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 50) + `-${Math.floor(1000 + Math.random() * 9000)}`;

      const dataToSave: CustomEventForm = {
        id: formId,
        title: title.trim(),
        description: description.trim(),
        slug,
        active,
        showOnHomepage,
        headerBannerUrl: headerBannerUrl.trim() || undefined,
        questions,
        createdAt: initialForm?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSave(dataToSave);
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan formulir');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Top action bar */}
      <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 -mx-4 mb-6 flex items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm">
            GF
          </div>
          <span className="font-bold text-sm truncate">
            {initialForm ? 'Edit Formulir Pendaftaran' : 'Buat Formulir Pendaftaran Baru'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold hover:bg-slate-800 text-slate-300 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveForm}
            disabled={saving}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <span>Menyimpan...</span>
            ) : (
              <>
                <Check size={14} />
                <span>Publikasikan Formulir</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <X size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Header Container (Like Google Form Top Card) */}
      <div className="rounded-2xl border-t-8 border-t-indigo-600 bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 mb-5 transition-all">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Judul Formulir Pendaftaran (misal: Pendaftaran Natal 2026, Retret Paskah)"
          className="w-full text-2xl sm:text-3xl font-extrabold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none pb-2 transition-all"
        />

        <textarea
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Deskripsi formulir / informasi acara (lokasi, tanggal, ketentuan)..."
          className="w-full mt-3 text-sm text-slate-600 border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none pb-2 resize-none transition-all leading-relaxed"
        />

        {/* Form settings: show on homepage & active */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showOnHomepage}
                onChange={e => setShowOnHomepage(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="flex items-center gap-1">
                <span>Tampilkan di Homepage Website Jemaat</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold">
                  Event Terkini
                </span>
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Pendaftaran Sedang Dibuka</span>
            </label>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Sparkles size={14} className="text-amber-500" />
            <span>Versi Google Form Web GBI Jelambar Timur</span>
          </div>
        </div>
      </div>

      {/* Questions Stack */}
      <div className="space-y-4">
        {questions.map((q, qIndex) => {
          const isSelected = activeQuestionId === q.id;

          return (
            <div
              key={q.id}
              onClick={() => setActiveQuestionId(q.id)}
              className={`rounded-2xl bg-white border shadow-xs transition-all duration-200 overflow-hidden relative ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-md pl-5 border-l-8 border-l-indigo-600'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="p-5 sm:p-6">
                {/* Question title & type dropdown row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between mb-4">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      value={q.title}
                      onChange={e => updateQuestion(q.id, { title: e.target.value })}
                      placeholder="Pertanyaan"
                      className="w-full font-bold text-slate-800 text-base sm:text-lg border-b border-slate-200 focus:border-indigo-600 focus:outline-none pb-1 transition-all"
                    />
                  </div>

                  {/* Type selector */}
                  <div className="relative shrink-0 w-full sm:w-auto">
                    <select
                      value={q.type}
                      onChange={e => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                      className="w-full sm:w-48 appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      {QUESTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                {/* Question Input Preview / Option Editor */}
                <div className="my-4 pl-1">
                  {q.type === 'short_text' && (
                    <div className="text-slate-400 text-sm border-b border-dashed border-slate-300 pb-2 max-w-sm">
                      {q.placeholder || 'Teks jawaban singkat'}
                    </div>
                  )}

                  {q.type === 'paragraph' && (
                    <div className="text-slate-400 text-sm border-b border-dashed border-slate-300 pb-6 max-w-md">
                      Teks jawaban panjang
                    </div>
                  )}

                  {q.type === 'date' && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm border border-slate-200 rounded-xl p-3 max-w-xs bg-slate-50">
                      <Calendar size={16} />
                      <span>hh / bb / tttt</span>
                    </div>
                  )}

                  {q.type === 'time' && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm border border-slate-200 rounded-xl p-3 max-w-xs bg-slate-50">
                      <Clock size={16} />
                      <span>Waktu (00:00)</span>
                    </div>
                  )}

                  {['radio', 'checkbox', 'dropdown'].includes(q.type) && (
                    <div className="space-y-2.5">
                      {(q.options || ['Opsi 1']).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2.5 group">
                          {q.type === 'radio' && (
                            <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                          )}
                          {q.type === 'checkbox' && (
                            <div className="w-4 h-4 rounded-md border-2 border-slate-300 shrink-0" />
                          )}
                          {q.type === 'dropdown' && (
                            <span className="text-xs font-bold text-slate-400 w-4 text-center shrink-0">
                              {optIdx + 1}.
                            </span>
                          )}

                          <input
                            type="text"
                            value={opt}
                            onChange={e => updateOption(q.id, optIdx, e.target.value)}
                            placeholder={`Opsi ${optIdx + 1}`}
                            className="flex-1 text-sm text-slate-700 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none py-1 transition-all"
                          />

                          {(q.options || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteOption(q.id, optIdx)}
                              className="p-1 text-slate-400 hover:text-red-500 opacity-60 group-hover:opacity-100 transition-opacity"
                              title="Hapus opsi"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 pt-1 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Tambahkan opsi</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Actions for each Question card */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={qIndex === 0}
                      onClick={e => { e.stopPropagation(); moveQuestion(qIndex, -1); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                      title="Pindah ke atas"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={qIndex === questions.length - 1}
                      onClick={e => { e.stopPropagation(); moveQuestion(qIndex, 1); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                      title="Pindah ke bawah"
                    >
                      <ArrowDown size={15} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); duplicateQuestion(q); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Duplikat pertanyaan"
                    >
                      <Copy size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); deleteQuestion(q.id); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Hapus pertanyaan"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="w-px h-5 bg-slate-200 mx-1" />

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
                      <span>Wajib diisi</span>
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Add Question Bar */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => addQuestion('short_text')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={18} />
          <span>Tambah Pertanyaan</span>
        </button>

        <button
          type="button"
          onClick={() => addQuestion('radio')}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-sm transition-all cursor-pointer"
        >
          <CheckCircle2 size={15} className="text-purple-500" />
          <span>Pilihan Ganda</span>
        </button>

        <button
          type="button"
          onClick={() => addQuestion('checkbox')}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-sm transition-all cursor-pointer"
        >
          <CheckSquare size={15} className="text-indigo-500" />
          <span>Kotak Centang</span>
        </button>
      </div>
    </div>
  );
}
