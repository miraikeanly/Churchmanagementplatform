import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { CustomEventForm, FormQuestion } from '../../lib/customFormTypes';
import PublicNavbar from '../components/public/PublicNavbar';
import PublicFooter from '../components/public/PublicFooter';
import {
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  Loader2,
  ArrowLeft,
  Send,
  AlertCircle,
  Share2,
  Check,
} from 'lucide-react';

export default function CustomFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<CustomEventForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Answers state: questionId -> value
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function loadForm() {
      if (!slug) return;
      setLoading(true);
      setError('');
      try {
        const { data, error: err } = await supabase
          .from('kv_store_561004a0')
          .select('key, value')
          .eq('key', `custom_form:${slug}`)
          .maybeSingle();

        if (err) throw err;
        if (!data || !data.value) {
          setError('Formulir pendaftaran tidak ditemukan atau sudah ditutup.');
        } else {
          setForm(data.value as CustomEventForm);
        }
      } catch (e: any) {
        setError(e.message || 'Gagal memuat formulir.');
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [slug]);

  const handleInputChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleCheckboxToggle = (questionId: string, option: string) => {
    const currentList: string[] = Array.isArray(answers[questionId]) ? answers[questionId] : [];
    const nextList = currentList.includes(option)
      ? currentList.filter(item => item !== option)
      : [...currentList, option];

    handleInputChange(questionId, nextList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Validate required questions
    const errors: Record<string, string> = {};
    for (const q of form.questions) {
      if (q.required) {
        const val = answers[q.id];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          errors[q.id] = 'Pertanyaan ini wajib diisi';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // scroll to first error
      const firstErrorId = Object.keys(errors)[0];
      const el = document.getElementById(`q-${firstErrorId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const submissionId = crypto.randomUUID();
      const submission = {
        id: submissionId,
        formId: form.id,
        formSlug: form.slug,
        formTitle: form.title,
        submittedAt: new Date().toISOString(),
        answers,
      };

      // Save to kv_store under custom_form_submission:<formSlug>:<submissionId>
      const { error: saveErr } = await supabase.from('kv_store_561004a0').insert({
        key: `custom_form_sub:${form.slug}:${submissionId}`,
        value: submission,
      });

      if (saveErr) throw saveErr;
      setSubmitted(true);
    } catch (e: any) {
      alert('Gagal mengirim jawaban: ' + (e.message || 'Kesalahan jaringan'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyPageLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <PublicNavbar />
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 size={36} className="text-blue-600 animate-spin mb-3" />
          <p className="text-slate-500 font-medium text-sm">Memuat formulir pendaftaran...</p>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <PublicNavbar />
        <div className="max-w-lg mx-auto px-6 py-28 text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-sm">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Formulir Tidak Ditemukan</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            {error || 'Formulir pendaftaran acara ini mungkin telah ditutup atau tautan tidak valid.'}
          </p>
          <Link
            to="/service"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow-md"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Halaman Layanan</span>
          </Link>
        </div>
        <PublicFooter />
      </div>
    );
  }

  // Theme configuration helper
  const theme = form?.theme || 'standard';
  const customColor = form?.customColor || '#2563eb';

  const themeStyles = {
    standard: {
      borderTop: 'border-t-blue-600',
      badgeBg: 'bg-blue-50 border-blue-200 text-blue-700',
      badgeIcon: '⛪',
      badgeLabel: 'GBI Jelambar Timur',
      btnBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25',
      accentGlow: 'from-blue-600/10 via-indigo-600/5 to-transparent',
      heroBg: 'from-blue-900 via-indigo-950 to-slate-950',
    },
    natal: {
      borderTop: 'border-t-rose-600',
      badgeBg: 'bg-rose-50 border-rose-200 text-rose-700',
      badgeIcon: '🎄',
      badgeLabel: 'Ibadah & Perayaan Natal',
      btnBg: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25',
      accentGlow: 'from-rose-600/15 via-emerald-600/10 to-transparent',
      heroBg: 'from-red-950 via-rose-950 to-emerald-950',
    },
    paskah: {
      borderTop: 'border-t-amber-500',
      badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
      badgeIcon: '✝️',
      badgeLabel: 'Ibadah & Perayaan Paskah',
      btnBg: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25',
      accentGlow: 'from-amber-500/15 via-yellow-500/10 to-transparent',
      heroBg: 'from-amber-950 via-stone-900 to-purple-950',
    },
    retret: {
      borderTop: 'border-t-emerald-600',
      badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      badgeIcon: '⛺',
      badgeLabel: 'Retret & Camp Jemaat',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25',
      accentGlow: 'from-emerald-600/15 via-teal-600/10 to-transparent',
      heroBg: 'from-emerald-950 via-teal-950 to-slate-950',
    },
    youth: {
      borderTop: 'border-t-purple-600',
      badgeBg: 'bg-purple-50 border-purple-200 text-purple-700',
      badgeIcon: '🔥',
      badgeLabel: 'Youth & Teens Event',
      btnBg: 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/25',
      accentGlow: 'from-purple-600/15 via-fuchsia-600/10 to-transparent',
      heroBg: 'from-purple-950 via-indigo-950 to-slate-950',
    },
    custom: {
      borderTop: 'border-t-indigo-600',
      badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      badgeIcon: '✨',
      badgeLabel: 'Kegiatan Khusus Gereja',
      btnBg: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25',
      accentGlow: 'from-indigo-600/10 via-blue-600/5 to-transparent',
      heroBg: 'from-slate-900 via-indigo-950 to-slate-950',
    },
  }[theme] || {
    borderTop: 'border-t-blue-600',
    badgeBg: 'bg-blue-50 border-blue-200 text-blue-700',
    badgeIcon: '⛪',
    badgeLabel: 'GBI Jelambar Timur',
    btnBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25',
    accentGlow: 'from-blue-600/10 via-indigo-600/5 to-transparent',
    heroBg: 'from-blue-900 via-indigo-950 to-slate-950',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 text-slate-900 flex flex-col justify-between">
      <PublicNavbar />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          {/* Header Card */}
          <div
            className={`rounded-3xl border-t-8 bg-white border border-slate-200/90 shadow-xl overflow-hidden mb-6 ${
              theme === 'custom' ? '' : themeStyles.borderTop
            }`}
            style={theme === 'custom' && customColor ? { borderTopColor: customColor } : undefined}
          >
            {/* Optional Header Banner Image */}
            {form.headerBannerUrl && (
              <div className="w-full h-44 sm:h-56 overflow-hidden bg-slate-900 relative">
                <img
                  src={form.headerBannerUrl}
                  alt={form.title}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            )}

            <div className="p-6 sm:p-9">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${themeStyles.badgeBg}`}>
                  <span>{themeStyles.badgeIcon}</span>
                  <span>{themeStyles.badgeLabel}</span>
                </span>

                <button
                  type="button"
                  onClick={copyPageLink}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-full border border-slate-200 transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Share2 size={13} />}
                  <span>{copiedLink ? 'Tautan Disalin!' : 'Bagikan'}</span>
                </button>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                {form.title}
              </h1>

              {form.description && (
                <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line border-t border-slate-100 pt-3">
                  {form.description}
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-rose-500 font-medium">
                <span>* Menunjukkan pertanyaan yang wajib diisi</span>
                {!form.active && (
                  <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold">
                    Pendaftaran Ditutup
                  </span>
                )}
              </div>
            </div>
          </div>

          {submitted ? (
            /* Thank you success card */
            <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-8 sm:p-12 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Terima Kasih!</h2>
              <p className="text-slate-600 text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-6">
                Tanggapan Anda telah berhasil direkam. Tim panitia GBI Jelambar Timur akan memproses pendaftaran Anda.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setAnswers({});
                  }}
                  className="px-6 py-2.5 rounded-full border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Kirim Tanggapan Lain
                </button>
                <Link
                  to="/"
                  className="px-6 py-2.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-md"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          ) : !form.active ? (
            /* Closed form notice */
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-8 text-center">
              <p className="text-slate-600 font-semibold text-sm">
                Mohon maaf, pendaftaran untuk acara ini saat ini sudah ditutup.
              </p>
            </div>
          ) : (
            /* Form inputs */
            <form onSubmit={handleSubmit} className="space-y-4">
              {form.questions.map((q, idx) => {
                const hasError = !!validationErrors[q.id];
                const value = answers[q.id];

                return (
                  <div
                    key={q.id}
                    id={`q-${q.id}`}
                    className={`rounded-2xl bg-white border shadow-xs p-6 sm:p-7 transition-all ${
                      hasError ? 'border-rose-400 ring-2 ring-rose-400/10' : 'border-slate-200/90'
                    }`}
                  >
                    <label className="block mb-4">
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-slate-900 text-base leading-snug">
                          {q.title}
                        </span>
                        {q.required && <span className="text-rose-500 font-bold ml-1">*</span>}
                      </div>
                      {q.description && (
                        <p className="text-xs text-slate-500 mt-1">{q.description}</p>
                      )}
                    </label>

                    {/* Inputs by Question Type */}
                    <div>
                      {q.type === 'short_text' && (
                        <input
                          type="text"
                          value={value || ''}
                          onChange={e => handleInputChange(q.id, e.target.value)}
                          placeholder={q.placeholder || 'Jawaban Anda'}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 bg-slate-50/50"
                        />
                      )}

                      {q.type === 'paragraph' && (
                        <textarea
                          rows={4}
                          value={value || ''}
                          onChange={e => handleInputChange(q.id, e.target.value)}
                          placeholder="Jawaban Anda"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 bg-slate-50/50 resize-none"
                        />
                      )}

                      {q.type === 'date' && (
                        <input
                          type="date"
                          value={value || ''}
                          onChange={e => handleInputChange(q.id, e.target.value)}
                          className="w-full sm:w-64 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 bg-slate-50/50"
                        />
                      )}

                      {q.type === 'time' && (
                        <input
                          type="time"
                          value={value || ''}
                          onChange={e => handleInputChange(q.id, e.target.value)}
                          className="w-full sm:w-48 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 bg-slate-50/50"
                        />
                      )}

                      {q.type === 'dropdown' && (
                        <select
                          value={value || ''}
                          onChange={e => handleInputChange(q.id, e.target.value)}
                          className="w-full sm:w-72 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 bg-slate-50/50 cursor-pointer"
                        >
                          <option value="">-- Pilih salah satu --</option>
                          {(q.options || []).map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {q.type === 'radio' && (
                        <div className="space-y-3">
                          {(q.options || []).map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className="flex items-center gap-3 cursor-pointer group select-none"
                            >
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={value === opt}
                                onChange={() => handleInputChange(q.id, opt)}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                              />
                              <span className="text-sm text-slate-700 group-hover:text-slate-900">
                                {opt}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.type === 'checkbox' && (
                        <div className="space-y-3">
                          {(q.options || []).map((opt, oIdx) => {
                            const isChecked = Array.isArray(value) && value.includes(opt);
                            return (
                              <label
                                key={oIdx}
                                className="flex items-center gap-3 cursor-pointer group select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleCheckboxToggle(q.id, opt)}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                />
                                <span className="text-sm text-slate-700 group-hover:text-slate-900">
                                  {opt}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {hasError && (
                      <p className="mt-3 text-xs text-rose-500 font-bold flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        <span>{validationErrors[q.id]}</span>
                      </p>
                    )}
                  </div>
                );
              })}

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-8 py-3.5 rounded-2xl text-white font-bold text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                    theme === 'custom' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25' : themeStyles.btnBg
                  }`}
                  style={theme === 'custom' && customColor ? { backgroundColor: customColor } : undefined}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Kirim Pendaftaran</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Kosongkan semua isian formulir?')) {
                      setAnswers({});
                      setValidationErrors({});
                    }
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Kosongkan formulir
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
