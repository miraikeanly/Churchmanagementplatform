import { useState, useEffect, useRef } from 'react';
import { apiBase } from '../../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../../../lib/supabaseClient';
import {
  Plus, Pencil, Trash2, X, Loader2, UserCircle,
  ImageIcon, Users, ChevronDown, ChevronUp, Eye, Camera, Heart, UserPlus, Check
} from 'lucide-react';

const API_URL = `${apiBase()}/api/content`;
const BUCKET = 'make-561004a0-gallery';

async function uploadPhotoToStorage(file: File, memberId: string): Promise<string | null> {
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `team/${memberId}/photo.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('Storage upload error:', error.message); return null; }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

const TIERS = [
  { value: 'gembala_sidang',  label: 'Gembala Sidang',         color: 'bg-yellow-50 border-yellow-200 text-yellow-800',  dot: 'bg-yellow-400'  },
  { value: 'penerus_gembala', label: 'Penerus Gembala Sidang', color: 'bg-blue-50 border-blue-200 text-blue-800',        dot: 'bg-blue-500'    },
  { value: 'wakil_gembala',   label: 'Wakil Gembala',          color: 'bg-indigo-50 border-indigo-200 text-indigo-800',  dot: 'bg-indigo-500'  },
  { value: 'pastoral',        label: 'Pastoral',               color: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500' },
  { value: 'koordinator',     label: 'Koordinator Pelayanan',  color: 'bg-gray-100 border-gray-200 text-gray-600',       dot: 'bg-gray-400'    },
];

interface TeamMember {
  id: string;
  name: string;
  role: string;
  tier: string;
  order: number;
  photoUrl: string | null;
  spouseName?: string;
  spouseRole?: string;
  bio?: string;
}

interface FormState {
  name: string;
  role: string;
  tier: string;
  order: number;
  isCouple: boolean;
  spouseName: string;
  spouseRole: string;
  bio: string;
  photoFile: File | null;
  photoPreview: string | null;
}

const emptyForm = (): FormState => ({
  name: '', role: '', tier: 'koordinator', order: 0,
  isCouple: false, spouseName: '', spouseRole: '',
  bio: '',
  photoFile: null, photoPreview: null,
});


// ── Photo picker box ──────────────────────────────────────────────────────────
function PhotoPicker({ preview, onChange, onClear, size = 'lg' }: {
  preview: string | null;
  onChange: (f: File) => void;
  onClear: () => void;
  size?: 'lg' | 'sm';
}) {
  const ref = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const dim = size === 'lg' ? 'w-28 h-28' : 'w-16 h-16';

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        onClick={() => ref.current?.click()}
        className={`${dim} relative rounded-2xl cursor-pointer overflow-hidden border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 transition-all flex items-center justify-center group shadow-2xs`}
      >
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover object-top" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400 p-2 text-center">
            <UserCircle size={size === 'lg' ? 40 : 22} className="text-slate-300" />
            {size === 'lg' && <span className="text-[10px] font-bold text-slate-500">Klik untuk unggah</span>}
          </div>
        )}
        <div className="absolute inset-0 bg-slate-900/40 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
          <ImageIcon size={size === 'lg' ? 20 : 14} className="text-white" />
          {size === 'lg' && <span className="text-white text-[10px] font-bold">Ganti foto</span>}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ''; }}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ''; }}
      />

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => camRef.current?.click()}
          className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200/60 transition-colors cursor-pointer flex items-center gap-1"
        >
          <Camera size={11} />
          <span>Kamera</span>
        </button>
        {preview && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-100 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Trash2 size={11} />
            <span>Hapus</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tier badge ───────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const t = TIERS.find(x => x.value === tier);
  if (!t) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${t.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
}

// ── Member card ──────────────────────────────────────────────────────────────
function MemberCard({ m, onEdit, onDelete }: {
  m: TeamMember;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCouple = !!(m.spouseName?.trim());
  const displayName = isCouple ? `${m.name} & ${m.spouseName}` : m.name;
  const displayRole = isCouple && m.spouseRole ? `${m.role} & ${m.spouseRole}` : m.role;
  const initials = (m.name || '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  return (
    <div className="group flex items-start gap-3.5 p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs transition-all shadow-2xs">
      {/* Photo */}
      <div className="flex-shrink-0 w-13 h-13 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
        {m.photoUrl ? (
          <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover object-top" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-xs flex items-center justify-center">
            {initials}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          {isCouple && (
            <span className="p-1 rounded-md bg-pink-50 text-pink-500 flex-shrink-0 border border-pink-100" title="Pasangan / Couple">
              <Heart size={11} className="fill-pink-500" />
            </span>
          )}
          <p className="font-bold text-slate-900 text-sm leading-tight break-words">{displayName}</p>
        </div>
        {displayRole && (
          <p className="text-xs text-slate-500 font-medium leading-relaxed break-words">{displayRole}</p>
        )}
        {m.bio && (
          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 italic leading-relaxed">
            "{m.bio}"
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          title="Edit Data"
          className="w-7 h-7 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors border border-slate-200/60 shadow-2xs cursor-pointer"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Hapus"
          className="w-7 h-7 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors border border-red-100/60 shadow-2xs cursor-pointer"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Section block per tier ───────────────────────────────────────────────────
function TierSection({ tier, members, canEdit, onAdd, onEdit, onDelete }: {
  tier: typeof TIERS[number];
  members: TeamMember[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (m: TeamMember) => void;
  onDelete: (m: TeamMember) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs bg-white">
      {/* Section header */}
      <div className={`flex items-center gap-3 px-5 py-4 ${open ? 'border-b border-slate-100' : ''} bg-white`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tier.dot} ring-2 ring-white shadow-2xs`} />
        <h3 className="font-bold text-slate-900 flex-1 text-sm tracking-tight">{tier.label}</h3>
        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
          {members.length}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200/70 transition-colors shadow-2xs cursor-pointer active:scale-95"
          >
            <Plus size={13} />
            <span>Tambah</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Members grid */}
      {open && (
        <div className="bg-slate-50/50 p-4">
          {members.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
              <Users size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Belum ada hamba Tuhan di kategori {tier.label}</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={onAdd}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus size={13} />
                  <span>Tambah Anggota Sekarang</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map(m => (
                <MemberCard
                  key={m.id}
                  m={m}
                  onEdit={() => canEdit && onEdit(m)}
                  onDelete={() => canEdit && onDelete(m)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TeamManagement() {
  const { user, accessToken } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const canEdit = isSuperAdmin || user?.permissions?.editTim || user?.permissions?.editTeam || false;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notDeployed, setNotDeployed] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [presetTier, setPresetTier] = useState('koordinator');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/team`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      if (!res.ok) { setNotDeployed(true); return; }
      const data = JSON.parse(await res.text());
      if (data.success) { setMembers(data.members || []); setNotDeployed(false); }
    } catch { setNotDeployed(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const openCreate = (tier: string) => {
    setEditId(null);
    setPresetTier(tier);
    setForm({ ...emptyForm(), tier });
    setError('');
    setShowForm(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditId(m.id);
    setPresetTier(m.tier);
    setForm({
      name: m.name,
      role: m.role,
      tier: m.tier,
      order: m.order,
      isCouple: !!(m.spouseName?.trim()),
      spouseName: m.spouseName || '',
      spouseRole: m.spouseRole || '',
      bio: m.bio || '',
      photoFile: null,
      photoPreview: m.photoUrl || null,
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Nama tidak boleh kosong'); return; }
    setSaving(true); setError('');
    try {
      const memberId = editId || crypto.randomUUID();

      const payload: any = {
        id: memberId,
        name: form.name.trim(),
        role: form.role.trim(),
        tier: form.tier,
        order: Number(form.order),
        spouseName: form.isCouple ? form.spouseName.trim() : '',
        spouseRole: form.isCouple ? form.spouseRole.trim() : '',
        bio: form.bio.trim(),
      };

      if (form.photoFile) {
        // Try direct browser-to-storage upload first (no edge function needed)
        const uploaded = await uploadPhotoToStorage(form.photoFile, memberId);
        if (uploaded) {
          payload.photoUrl = uploaded;
        } else {
          // Fallback: send base64 to edge function for server-side upload
          const base64 = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res((r.result as string).split(',')[1]);
            r.onerror = rej;
            r.readAsDataURL(form.photoFile!);
          });
          payload.photoBase64 = base64;
          payload.photoMimeType = form.photoFile.type;
        }
      }

      const url = editId ? `${API_URL}/team/${editId}` : `${API_URL}/team`;
      const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers, body: JSON.stringify(payload) });
      if (res.status === 404) { setError('Endpoint belum aktif. Jalankan: supabase functions deploy make-server-561004a0 --project-ref nnzqvhkhreesgcjallof'); return; }
      const data = JSON.parse(await res.text());
      if (!data.success) throw new Error(data.error || 'Gagal menyimpan');
      setShowForm(false);
      await fetchAll();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/team/${deleteTarget.id}`, { method: 'DELETE', headers });
      const data = JSON.parse(await res.text());
      if (!data.success) throw new Error(data.error);
      setDeleteTarget(null);
      await fetchAll();
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(false); }
  };

  const byTier = (tier: string) => members.filter(m => m.tier === tier);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Not deployed state ─────────────────────────────────────────────────────
  if (notDeployed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-amber-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Edge Function Belum Aktif</h3>
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            Modul Tim Pelayanan membutuhkan Edge Function yang sudah di-deploy. Jalankan perintah berikut di terminal:
          </p>
          <code className="block bg-gray-900 text-green-400 text-xs px-4 py-3 rounded-xl font-mono mb-4 break-all">
            supabase functions deploy make-server-561004a0 --project-ref nnzqvhkhreesgcjallof
          </code>
          <button onClick={fetchAll} className="text-sm text-amber-700 font-semibold hover:underline">
            Coba lagi setelah deploy →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tim Pelayanan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola hamba-hamba Tuhan GBI Jelambar Timur</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{members.length} anggota</span>
          <a
            href="/tentang"
            target="_blank"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-200 px-3 py-2 rounded-xl transition-colors"
          >
            <Eye size={13} /> Preview
          </a>
        </div>
      </div>

      {!canEdit && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
          Anda hanya memiliki akses <strong>view-only</strong>. Hubungi Super Admin untuk akses edit.
        </div>
      )}

      {/* Sections per tier */}
      <div className="space-y-4">
        {TIERS.map(tier => (
          <TierSection
            key={tier.value}
            tier={tier}
            members={byTier(tier.value)}
            canEdit={canEdit}
            onAdd={() => openCreate(tier.value)}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>

      {/* ── Form Modal ──────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col border border-slate-200 animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/15">
                  <UserPlus size={18} className="text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">
                    {editId ? 'Edit Anggota Tim' : 'Tambah Anggota Tim'}
                  </h3>
                  <p className="text-[11px] text-indigo-200 font-medium mt-0.5">
                    Data jajaran hamba Tuhan & gembala GBI Jeltim
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Photo upload */}
              <div className="flex justify-center pb-1">
                <PhotoPicker
                  preview={form.photoPreview}
                  onChange={f => {
                    setField('photoFile', f);
                    const url = URL.createObjectURL(f);
                    setField('photoPreview', url);
                  }}
                  onClear={() => { setField('photoFile', null); setField('photoPreview', null); }}
                  size="lg"
                />
              </div>

              {/* Couple toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-pink-50/70 border border-pink-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0">
                    <Heart size={16} className="fill-pink-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Pasangan / Couple?</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Tampil sebagai 2 nama dalam 1 foto</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setField('isCouple', !form.isCouple)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.isCouple ? 'bg-pink-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-xs transition-all ${form.isCouple ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {/* Name fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {form.isCouple ? 'Nama Orang Pertama *' : 'Nama Lengkap *'}
                  </label>
                  <input
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    placeholder="Contoh: Pdt. Gina Jaya"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400 bg-white shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {form.isCouple ? 'Jabatan Orang Pertama' : 'Jabatan / Pelayanan'}
                  </label>
                  <input
                    value={form.role}
                    onChange={e => setField('role', e.target.value)}
                    placeholder="Contoh: Gembala Sidang"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400 bg-white shadow-2xs"
                  />
                </div>

                {/* Second person (couple only) */}
                {form.isCouple && (
                  <div className="pt-3 border-t border-pink-100 space-y-3 animate-in fade-in">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nama Orang Kedua *</label>
                      <input
                        value={form.spouseName}
                        onChange={e => setField('spouseName', e.target.value)}
                        placeholder="Contoh: Pdm. Poppy Wairissal"
                        className="w-full px-4 py-2.5 rounded-xl border border-pink-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-slate-800 placeholder-slate-400 bg-white shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Jabatan Orang Kedua</label>
                      <input
                        value={form.spouseRole}
                        onChange={e => setField('spouseRole', e.target.value)}
                        placeholder="Contoh: Gembala Sidang"
                        className="w-full px-4 py-2.5 rounded-xl border border-pink-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-slate-800 placeholder-slate-400 bg-white shadow-2xs"
                      />
                    </div>
                    {/* Preview */}
                    {(form.name || form.spouseName) && (
                      <div className="text-center text-xs text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl py-2 px-3">
                        Tampil sebagai: <strong className="text-slate-800">
                          {[form.name, form.spouseName].filter(Boolean).join(' & ')}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tier selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Kategori / Jajaran</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIERS.map(t => {
                    const isSelected = form.tier === t.value;
                    return (
                      <button
                        type="button"
                        key={t.value}
                        onClick={() => setField('tier', t.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-indigo-500/25'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Order */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Urutan Tampil</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={form.order}
                    onChange={e => setField('order', Number(e.target.value))}
                    min={0}
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 bg-white shadow-2xs"
                  />
                  <span className="text-xs text-slate-400">angka lebih kecil = tampil duluan di atas</span>
                </div>
              </div>

              {/* Bio / Detail Deskripsi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Deskripsi / Info Detail Terkait (Opsional)
                </label>
                <textarea
                  rows={4}
                  value={form.bio}
                  onChange={e => setField('bio', e.target.value)}
                  placeholder="Ceritakan latar belakang pelayanan, visi, atau biografi singkat yang akan ditampilkan di samping foto..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400 bg-white shadow-2xs resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Akan tampil di samping foto pada halaman Tentang Kami dengan layout profil modern.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                  <X size={14} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 min-w-[155px] h-10 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center justify-center overflow-hidden notranslate"
                translate="no"
              >
                {saving ? (
                  <div key="saving" className="flex items-center justify-center gap-2 whitespace-nowrap animate-in fade-in duration-150">
                    <Loader2 size={14} className="animate-spin shrink-0 text-white" />
                    <span>Menyimpan...</span>
                  </div>
                ) : (
                  <div key="idle" className="flex items-center justify-center gap-1.5 whitespace-nowrap animate-in fade-in duration-150">
                    <Check size={14} className="shrink-0 text-white" />
                    <span>{editId ? 'Simpan Perubahan' : 'Tambah Anggota'}</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={26} className="text-red-500" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Hapus Anggota?</h3>
              <p className="text-gray-500 text-sm mt-2">
                <span className="font-semibold text-gray-700">{deleteTarget.name}</span>
                {deleteTarget.spouseName && ` & ${deleteTarget.spouseName}`} akan dihapus permanen dari daftar.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
