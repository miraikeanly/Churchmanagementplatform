import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import {
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  ExternalLink,
  QrCode as QrCodeIcon,
  Download,
  Copy,
  Check,
  Edit3,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  FileSpreadsheet,
  Share2,
  Eye,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import CustomFormBuilder from './CustomFormBuilder';
import { CustomEventForm, FormSubmission } from '../../../lib/customFormTypes';

const TYPE_LABELS: Record<string, string> = {
  baptis:      'Baptisan Air',
  penyerahan:  'Penyerahan Anak',
  konseling:   'Konseling',
  pranikah:    'Kelas Pra-Nikah',
  pemberkatan: 'Pemberkatan Pernikahan',
};

const TYPE_COLORS: Record<string, string> = {
  baptis:      'bg-sky-100 text-sky-700',
  penyerahan:  'bg-orange-100 text-orange-700',
  konseling:   'bg-emerald-100 text-emerald-700',
  pranikah:    'bg-pink-100 text-pink-700',
  pemberkatan: 'bg-purple-100 text-purple-700',
};

const STATUS_COLORS: Record<string, string> = {
  baru:     'bg-blue-100 text-blue-700',
  diproses: 'bg-yellow-100 text-yellow-700',
  selesai:  'bg-green-100 text-green-700',
};

interface Registration {
  id: string;
  type: string;
  title: string;
  data: Record<string, string>;
  submittedAt: string;
  status: string;
}

export default function RegistrationManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const canEdit = isSuperAdmin || user?.permissions?.editPendaftaran || user?.permissions?.editRegistrasi || false;

  // Active top tab: 'events' (Form Event Khusus / Google Form style) or 'services' (Layanan Gereja standar)
  const [activeTab, setActiveTab] = useState<'events' | 'services'>('events');

  // Custom Form Builder state
  const [customForms, setCustomForms] = useState<CustomEventForm[]>([]);
  const [customSubmissions, setCustomSubmissions] = useState<FormSubmission[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  const [isBuildingForm, setIsBuildingForm] = useState(false);
  const [editingForm, setEditingForm] = useState<CustomEventForm | null>(null);
  const [qrModalForm, setQrModalForm] = useState<CustomEventForm | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Standard services registration state
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  // ── Load All Data ──────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [{ data: regData }, { data: formData }, { data: subData }] = await Promise.all([
        supabase.from('kv_store_561004a0').select('key, value').like('key', 'registration:%'),
        supabase.from('kv_store_561004a0').select('key, value').like('key', 'custom_form:%'),
        supabase.from('kv_store_561004a0').select('key, value').like('key', 'custom_form_sub:%'),
      ]);

      // 1. Service registrations
      const regs = (regData ?? []).map((row: any) => row.value as Registration).filter(Boolean);
      regs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setRegistrations(regs);

      // 2. Custom forms
      const forms = (formData ?? []).map((row: any) => row.value as CustomEventForm).filter(Boolean);
      forms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCustomForms(forms);

      // 3. Custom form submissions
      const subs = (subData ?? []).map((row: any) => row.value as FormSubmission).filter(Boolean);
      subs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setCustomSubmissions(subs);
    } catch (e: any) {
      setLoadError(e?.message || 'Gagal memuat data pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ── Custom Form CRUD ───────────────────────────────────────────────────────
  const handleSaveCustomForm = async (savedForm: CustomEventForm) => {
    await supabase.from('kv_store_561004a0').upsert({
      key: `custom_form:${savedForm.slug}`,
      value: savedForm,
    });
    setIsBuildingForm(false);
    setEditingForm(null);
    await loadAll();
  };

  const handleDeleteCustomForm = async (f: CustomEventForm) => {
    if (!confirm(`Hapus formulir "${f.title}" beserta seluruh tanggapannya?`)) return;
    try {
      await supabase.from('kv_store_561004a0').delete().eq('key', `custom_form:${f.slug}`);
      // delete associated submissions
      const subsToDelete = customSubmissions.filter(s => s.formSlug === f.slug);
      for (const s of subsToDelete) {
        await supabase.from('kv_store_561004a0').delete().eq('key', `custom_form_sub:${f.slug}:${s.id}`);
      }
      await loadAll();
    } catch (e: any) {
      alert('Gagal menghapus: ' + e.message);
    }
  };

  const handleToggleFormActive = async (f: CustomEventForm) => {
    const updated = { ...f, active: !f.active, updatedAt: new Date().toISOString() };
    await supabase.from('kv_store_561004a0').update({ value: updated }).eq('key', `custom_form:${f.slug}`);
    setCustomForms(prev => prev.map(item => item.id === f.id ? updated : item));
  };

  const handleToggleShowOnHome = async (f: CustomEventForm) => {
    const updated = { ...f, showOnHomepage: !f.showOnHomepage, updatedAt: new Date().toISOString() };
    await supabase.from('kv_store_561004a0').update({ value: updated }).eq('key', `custom_form:${f.slug}`);
    setCustomForms(prev => prev.map(item => item.id === f.id ? updated : item));
  };

  const handleDeleteSubmission = async (sub: FormSubmission) => {
    if (!confirm('Hapus jawaban peserta ini?')) return;
    await supabase.from('kv_store_561004a0').delete().eq('key', `custom_form_sub:${sub.formSlug}:${sub.id}`);
    setCustomSubmissions(prev => prev.filter(s => s.id !== sub.id));
  };

  // ── Export to Excel ────────────────────────────────────────────────────────
  const exportCustomSubmissionsToExcel = (targetForm?: CustomEventForm) => {
    const targetSubs = targetForm
      ? customSubmissions.filter(s => s.formSlug === targetForm.slug)
      : (selectedFormId === 'all'
          ? customSubmissions
          : customSubmissions.filter(s => s.formId === selectedFormId));

    if (targetSubs.length === 0) {
      alert('Belum ada data pendaftar untuk diexport.');
      return;
    }

    // Determine relevant questions
    const relevantForm = targetForm || customForms.find(f => f.id === selectedFormId);

    const rows = targetSubs.map((sub, idx) => {
      const row: Record<string, any> = {
        'No': idx + 1,
        'Waktu Pendaftaran': formatDate(sub.submittedAt),
        'Nama Formulir / Acara': sub.formTitle,
      };

      if (relevantForm) {
        // Map answers by question title
        relevantForm.questions.forEach(q => {
          const ans = sub.answers[q.id];
          row[q.title] = Array.isArray(ans) ? ans.join(', ') : (ans ?? '-');
        });
      } else {
        // Generic flat map
        Object.entries(sub.answers || {}).forEach(([qId, val]) => {
          row[`Jawaban (${qId})`] = Array.isArray(val) ? val.join(', ') : (val ?? '-');
        });
      }

      return row;
    });

    const filename = `Data_Pendaftaran_${relevantForm?.slug || 'Semua_Acara'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pendaftar');
    XLSX.writeFile(wb, filename);
  };

  const exportServiceRegistrationsToExcel = () => {
    if (registrations.length === 0) {
      alert('Belum ada data pendaftaran layanan untuk diexport.');
      return;
    }

    const rows = registrations.map((reg, idx) => {
      const row: Record<string, any> = {
        'No': idx + 1,
        'Jenis Layanan': TYPE_LABELS[reg.type] || reg.type,
        'Status': reg.status,
        'Waktu Pendaftaran': formatDate(reg.submittedAt),
      };
      Object.entries(reg.data || {}).forEach(([k, v]) => {
        row[FIELD_LABELS[k] || k] = v;
      });
      return row;
    });

    const filename = `Pendaftaran_Layanan_GBI_Jeltim_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Layanan');
    XLSX.writeFile(wb, filename);
  };

  // ── Standard Service Reg actions ───────────────────────────────────────────
  const updateStatus = async (reg: Registration, status: string) => {
    const updated = { ...reg, status };
    await supabase.from('kv_store_561004a0').update({ value: updated }).eq('key', `registration:${reg.type}:${reg.id}`);
    setRegistrations(prev => prev.map(r => r.id === reg.id ? updated : r));
  };

  const deleteReg = async (reg: Registration) => {
    if (!confirm('Hapus pendaftaran ini?')) return;
    await supabase.from('kv_store_561004a0').delete().eq('key', `registration:${reg.type}:${reg.id}`);
    setRegistrations(prev => prev.filter(r => r.id !== reg.id));
  };

  const filteredServices = filter === 'all' ? registrations : registrations.filter(r => r.type === filter);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  const copyFormLink = (slug: string) => {
    const fullUrl = `${window.location.origin}/form/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const FIELD_LABELS: Record<string, string> = {
    nama: 'Nama Lengkap', namaAyah: 'Nama Ayah', namaIbu: 'Nama Ibu',
    namaAnak: 'Nama Anak', tanggalLahir: 'Tanggal Lahir', tanggalLahirAnak: 'Tanggal Lahir Anak',
    telepon: 'No. Telepon / WA', sudahTerima: 'Sudah Menerima Kristus', topik: 'Topik Konseling',
    namaPria: 'Nama Pria', namaWanita: 'Nama Wanita', tanggalNikah: 'Rencana Nikah',
    tanggalPemberkatan: 'Tanggal Pemberkatan', jumlahTamu: 'Jumlah Tamu', pesan: 'Pesan',
  };

  // If in custom form builder mode
  if (isBuildingForm) {
    return (
      <CustomFormBuilder
        initialForm={editingForm}
        onSave={handleSaveCustomForm}
        onCancel={() => {
          setIsBuildingForm(false);
          setEditingForm(null);
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Top Header & Tab Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="text-indigo-600" size={24} />
            <span>Pusat Manajemen Pendaftaran</span>
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Kelola formulir pendaftaran acara khusus (Google Form builder) dan permohonan layanan jemaat.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'events' && canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditingForm(null);
                setIsBuildingForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Buat Form Acara Baru</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadAll}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl px-3 py-2 bg-white hover:bg-gray-50 transition-colors shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm">
          {loadError}
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'events'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Sparkles size={16} />
          <span>Formulir Acara / Event ({customForms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'services'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Calendar size={16} />
          <span>Layanan Rutin Gereja ({registrations.length})</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: FORMULIR ACARA KHUSUS (GOOGLE FORM STYLE)                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          {/* List of Custom Forms */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">
                Daftar Formulir Pendaftaran Acara
              </h3>
              <span className="text-xs text-gray-400">
                Pilih atau klik QR code untuk membagikan form ke jemaat
              </span>
            </div>

            {customForms.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={24} />
                </div>
                <h4 className="font-bold text-gray-800 text-sm">Belum ada formulir acara khusus</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4 leading-relaxed">
                  Buat formulir kustom seperti pendaftaran Natal, Retret, Ibadah Paskah, atau seminar gereja dengan pertanyaan yang dapat disesuaikan sesuka hati.
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingForm(null);
                      setIsBuildingForm(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all"
                  >
                    <Plus size={15} />
                    <span>Buat Formulir Sekarang</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customForms.map(f => {
                  const subCount = customSubmissions.filter(s => s.formSlug === f.slug).length;

                  return (
                    <div
                      key={f.id}
                      className="rounded-2xl bg-white border border-gray-200/90 hover:border-indigo-300 hover:shadow-md transition-all p-5 flex flex-col justify-between"
                    >
                      <div>
                        {/* Status badges */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            f.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {f.active ? 'Buka' : 'Ditutup'}
                          </span>

                          {f.showOnHomepage && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                              <span>Homepage</span>
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-gray-900 text-base leading-snug line-clamp-1 mb-1">
                          {f.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
                          {f.description || 'Tidak ada deskripsi'}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-400 mb-4 pt-2 border-t border-gray-100">
                          <span>{f.questions.length} Pertanyaan</span>
                          <span className="font-bold text-indigo-600">{subCount} Pendaftar</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQrModalForm(f)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Tampilkan QR Code & Bagikan Tautan"
                          >
                            <QrCodeIcon size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => copyFormLink(f.slug)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Salin Tautan Formulir"
                          >
                            {copiedSlug === f.slug ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                          </button>

                          <a
                            href={`/form/${f.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Buka Halaman Form Jemaat"
                          >
                            <ExternalLink size={16} />
                          </a>

                          <button
                            type="button"
                            onClick={() => exportCustomSubmissionsToExcel(f)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Export Data Jawaban ke Excel"
                          >
                            <FileSpreadsheet size={16} />
                          </button>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingForm(f);
                                setIsBuildingForm(true);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Edit Pertanyaan & Formulir"
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCustomForm(f)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Hapus Formulir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submissions Section */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <span>Data Tanggapan & Pendaftar Masuk</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                    {customSubmissions.length} Total
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Daftar jawaban isian yang dikirim oleh jemaat melalui link formulir pendaftaran.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Form Filter Selector */}
                <select
                  value={selectedFormId}
                  onChange={e => setSelectedFormId(e.target.value)}
                  className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Semua Acara</option>
                  {customForms.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => exportCustomSubmissionsToExcel()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={15} />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Submissions list */}
            {(() => {
              const displaySubs = selectedFormId === 'all'
                ? customSubmissions
                : customSubmissions.filter(s => s.formId === selectedFormId);

              if (displaySubs.length === 0) {
                return (
                  <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center text-gray-400">
                    <p className="text-sm font-medium">Belum ada tanggapan yang masuk.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displaySubs.map(sub => {
                    const isOpen = expandedId === sub.id;
                    const relevantForm = customForms.find(f => f.slug === sub.formSlug);

                    return (
                      <div
                        key={sub.id}
                        className={`rounded-2xl bg-white border transition-all overflow-hidden ${
                          isOpen ? 'border-indigo-300 ring-1 ring-indigo-200 shadow-sm' : 'border-gray-200/90 hover:border-gray-300'
                        }`}
                      >
                        <div
                          onClick={() => setExpandedId(isOpen ? null : sub.id)}
                          className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {sub.formTitle}
                              </span>
                              <span className="text-xs text-gray-400">
                                &bull; {formatDate(sub.submittedAt)}
                              </span>
                            </div>

                            {/* Main answer preview */}
                            <div className="text-sm font-bold text-gray-900 truncate">
                              {Object.values(sub.answers || {})[0] ? String(Object.values(sub.answers)[0]) : 'Pendaftar'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSubmission(sub)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Hapus tanggapan ini"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedId(isOpen ? null : sub.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isOpen && (
                          <div className="p-5 bg-slate-50 border-t border-gray-100 space-y-3">
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                              Rincian Isian Formulir:
                            </h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {Object.entries(sub.answers || {}).map(([qId, val]) => {
                                const questionObj = relevantForm?.questions.find(q => q.id === qId);
                                const qTitle = questionObj?.title || qId;
                                const displayVal = Array.isArray(val) ? val.join(', ') : String(val ?? '-');

                                return (
                                  <div key={qId} className="p-3 rounded-xl bg-white border border-gray-200/80">
                                    <p className="text-xs font-bold text-gray-500 mb-1">{qTitle}</p>
                                    <p className="text-sm font-semibold text-gray-900 break-words">{displayVal || '-'}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: LAYANAN RUTIN GEREJA (BAPTIS, PENYERAHAN, KONSELING, DLL.)   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Semua ({registrations.length})
              </button>
              {Object.entries(TYPE_LABELS).map(([key, label]) => {
                const count = registrations.filter(r => r.type === key).length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      filter === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={exportServiceRegistrationsToExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Export Excel</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">Memuat data...</div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium">Belum ada pendaftaran layanan</p>
              <p className="text-sm mt-1 text-gray-300">Pendaftaran dari halaman Service jemaat akan muncul di sini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServices.map(reg => {
                const isOpen = expandedId === reg.id;
                const entries = Object.entries(reg.data || {});
                const registrantName =
                  reg.data?.nama ||
                  (reg.data?.namaPria && reg.data?.namaWanita ? `${reg.data.namaPria} & ${reg.data.namaWanita}` : '') ||
                  reg.data?.namaAnak ||
                  reg.title ||
                  '';
                const phone = reg.data?.telepon || '';

                return (
                  <div
                    key={reg.id}
                    className={`bg-white border rounded-2xl shadow-xs transition-all duration-200 overflow-hidden ${
                      isOpen ? 'border-indigo-200 shadow-md ring-1 ring-indigo-100' : 'border-gray-200/80 hover:border-gray-300'
                    }`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => setExpandedId(isOpen ? null : reg.id)}
                      className="flex items-center gap-3.5 px-5 py-4 cursor-pointer hover:bg-slate-50/60 transition-colors flex-wrap sm:flex-nowrap"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full shadow-2xs ${TYPE_COLORS[reg.type] || 'bg-gray-100 text-gray-700'}`}>
                            {TYPE_LABELS[reg.type] || reg.type}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${STATUS_COLORS[reg.status] || 'bg-gray-100 text-gray-600'}`}>
                            {reg.status === 'baru' ? 'Baru' : reg.status === 'diproses' ? 'Diproses' : 'Selesai'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {registrantName && (
                            <h4 className="font-bold text-gray-900 text-sm sm:text-base leading-snug">
                              {registrantName}
                            </h4>
                          )}
                          <span className="text-xs text-gray-400">
                            &bull; {formatDate(reg.submittedAt)}
                          </span>
                        </div>

                        {phone && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 font-medium">
                            <span>Kontak: {phone}</span>
                          </p>
                        )}
                      </div>

                      {/* Actions & Status Dropdown */}
                      <div className="flex items-center gap-2.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {canEdit ? (
                          <select
                            value={reg.status}
                            onChange={e => updateStatus(reg, e.target.value)}
                            className={`text-xs font-bold border rounded-xl px-3 py-1.5 cursor-pointer focus:outline-none transition-all shadow-2xs ${
                              reg.status === 'baru'
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : reg.status === 'diproses'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}
                          >
                            <option value="baru">Baru</option>
                            <option value="diproses">Diproses</option>
                            <option value="selesai">Selesai</option>
                          </select>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                            {reg.status}
                          </span>
                        )}

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => deleteReg(reg)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus pendaftaran"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : reg.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                          title={isOpen ? 'Tutup rincian' : 'Buka rincian'}
                        >
                          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Details Accordion */}
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 border-t border-gray-100 bg-slate-50/50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                          {entries.map(([k, v]) => (
                            <div key={k} className="bg-white rounded-xl p-3 border border-gray-100 shadow-2xs">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                                {FIELD_LABELS[k] || k}
                              </span>
                              <span className="text-sm font-semibold text-gray-800 break-words">
                                {String(v || '-')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── QR Code & Share Modal ── */}
      {qrModalForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative animate-scale-up">
            <button
              type="button"
              onClick={() => setQrModalForm(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <QrCodeIcon size={24} />
            </div>

            <h3 className="font-extrabold text-gray-900 text-lg mb-1">
              QR Code Pendaftaran
            </h3>
            <p className="text-xs text-gray-500 mb-5 line-clamp-1">
              {qrModalForm.title}
            </p>

            {/* QR Box */}
            <div className="p-4 bg-white rounded-2xl border-2 border-indigo-100 inline-block shadow-inner mb-4">
              <QRCodeSVG
                value={`${window.location.origin}/form/${qrModalForm.slug}`}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            <p className="text-[11px] text-gray-400 mb-5">
              Scan barcode di atas menggunakan kamera HP jemaat untuk langsung membuka formulir pendaftaran di website.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyFormLink(qrModalForm.slug)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                {copiedSlug === qrModalForm.slug ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedSlug === qrModalForm.slug ? 'Tautan Disalin!' : 'Salin Tautan'}</span>
              </button>

              <a
                href={`/form/${qrModalForm.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs transition-colors"
              >
                Buka Form
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
