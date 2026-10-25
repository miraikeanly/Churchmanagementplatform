import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EdgeKV as supabaseAdmin } from '../../../lib/edgeKvClient';
import { api } from '../../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageSquare, X, Send, CheckCircle2, Circle, Clock, AlertCircle,
  Pin, Sparkles, Filter, Check, Trash2, Maximize2, Minimize2,
  ChevronDown, ChevronUp, MoreVertical, GripVertical, User, Calendar,
  Users, Lock, ShieldCheck, Shield, ChevronRight
} from 'lucide-react';

const KV = 'kv_store_561004a0';
const CHAT_STORAGE_KEY = 'admin_chat:messages';

export interface AdminChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  content: string;
  createdAt: string;
  isTask?: boolean;
  isDone?: boolean;
  doneBy?: string;
  doneAt?: string;
  priority?: 'normal' | 'urgent';
  // PM Channel properties
  channelType?: 'general' | 'pm'; // 'general' = semua admin, 'pm' = superadmin <-> admin
  recipientId?: string;           // target ID jika PM
  recipientName?: string;         // target name jika PM
  recipientRole?: string;
}

interface AdminUserContact {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface AdminChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pendingTaskCountChange?: (count: number) => void;
}

export default function AdminChatDrawer({
  isOpen,
  onClose,
  pendingTaskCountChange,
}: AdminChatDrawerProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [contacts, setContacts] = useState<AdminUserContact[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTaskInput, setIsTaskInput] = useState(false);
  const [taskPriority, setTaskPriority] = useState<'normal' | 'urgent'>('normal');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [mode, setMode] = useState<'sidepanel' | 'floating'>('sidepanel');
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Active channel: 'general' or 'pm'
  const [activeTabChannel, setActiveTabChannel] = useState<'general' | 'pm'>('general');
  // For SuperAdmin: selected target admin to chat with
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');

  // Resizable width for sidepanel (default 440px, min 350px, max 850px)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('admin_chat_panel_width');
      return saved ? Math.min(850, Math.max(350, parseInt(saved, 10))) : 460;
    } catch {
      return 460;
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(460);

  // ── Load contacts (admins & superadmins) ──
  useEffect(() => {
    async function loadContacts() {
      try {
        const res = await api.get('/api/admin/users');
        if (res.success && Array.isArray(res.data)) {
          const validUsers = (res.data as AdminUserContact[]).filter(u => u.status === 'approved' && u.role !== 'jemaat');
          setContacts(validUsers);
          // If super admin and no admin selected yet, select the first regular admin
          if (isSuperAdmin && !selectedAdminId) {
            const firstAdmin = validUsers.find(u => u.role === 'admin' && u.id !== user?.id);
            if (firstAdmin) setSelectedAdminId(firstAdmin.id);
          }
        }
      } catch (e) {
        console.warn('Failed to load admin contacts:', e);
      }
    }
    loadContacts();
  }, [isSuperAdmin, user?.id]);

  const prevPendingCountRef = useRef(-1);

  // ── Load messages from KV ──
  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await supabaseAdmin.from(KV).select('key, value').eq('key', CHAT_STORAGE_KEY).maybeSingle();
      if (data && Array.isArray((data as any).value)) {
        const msgs = (data as any).value as AdminChatMessage[];
        setMessages(msgs);

        // Count pending tasks visible to this user
        const pendingCount = msgs.filter(m => {
          if (!m.isTask || m.isDone) return false;
          if (m.channelType === 'pm') {
            if (isSuperAdmin) {
              return m.senderRole === 'super_admin' || m.recipientRole === 'super_admin';
            }
            return m.senderId === user?.id || m.recipientId === user?.id;
          }
          return true; // general channel task
        }).length;

        if (prevPendingCountRef.current !== pendingCount) {
          prevPendingCountRef.current = pendingCount;
          pendingTaskCountChange?.(pendingCount);
        }
      }
    } catch (err) {
      console.error('Failed to load admin chat messages:', err);
    } finally {
      setLoading(false);
    }
  }, [pendingTaskCountChange, isSuperAdmin, user?.id]);

  // Initial load and periodic polling every 4 seconds for live chat feel
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom when messages or active channel change
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen, isMinimized, filter, activeTabChannel, selectedAdminId]);

  // ── Resizing Logic ──
  const handleMouseDownResize = (e: React.MouseEvent) => {
    if (mode !== 'sidepanel') return;
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startXRef.current - moveEvent.clientX;
      const newWidth = Math.min(880, Math.max(350, startWidthRef.current + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      localStorage.setItem('admin_chat_panel_width', String(panelWidth));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Find target contact for PM
  const targetAdminContact = isSuperAdmin
    ? contacts.find(c => c.id === selectedAdminId)
    : contacts.find(c => c.role === 'super_admin');

  // ── Send Message or Task ──
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);

    const isPM = activeTabChannel === 'pm';
    const newMsg: AdminChatMessage = {
      id: crypto.randomUUID(),
      senderId: user?.id || 'admin',
      senderName: user?.name || 'Admin',
      senderRole: isSuperAdmin ? 'super_admin' : 'admin',
      content: text,
      createdAt: new Date().toISOString(),
      isTask: isTaskInput,
      isDone: false,
      priority: isTaskInput ? taskPriority : undefined,
      channelType: isPM ? 'pm' : 'general',
      recipientId: isPM ? (targetAdminContact?.id || (isSuperAdmin ? selectedAdminId : 'super_admin')) : undefined,
      recipientName: isPM ? (targetAdminContact?.name || (isSuperAdmin ? 'Admin' : 'Super Admin')) : undefined,
      recipientRole: isPM ? (isSuperAdmin ? 'admin' : 'super_admin') : undefined,
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    setInputText('');
    setIsTaskInput(false);
    setTaskPriority('normal');

    try {
      const { data: existing } = await supabaseAdmin.from(KV).select('key').eq('key', CHAT_STORAGE_KEY).maybeSingle();
      if (existing) {
        await supabaseAdmin.from(KV).update({ value: updated }).eq('key', CHAT_STORAGE_KEY);
      } else {
        await supabaseAdmin.from(KV).insert({ key: CHAT_STORAGE_KEY, value: updated });
      }
      const pendingCount = updated.filter(m => m.isTask && !m.isDone).length;
      pendingTaskCountChange?.(pendingCount);
    } catch (err) {
      console.error('Failed to send admin chat message:', err);
    } finally {
      setSending(false);
    }
  };

  // ── Toggle Task Done State ──
  const handleToggleDone = async (msgId: string) => {
    const updated = messages.map(m => {
      if (m.id !== msgId) return m;
      const willBeDone = !m.isDone;
      return {
        ...m,
        isDone: willBeDone,
        doneBy: willBeDone ? user?.name || 'Admin' : undefined,
        doneAt: willBeDone ? new Date().toISOString() : undefined,
      };
    });

    setMessages(updated);
    try {
      await supabaseAdmin.from(KV).update({ value: updated }).eq('key', CHAT_STORAGE_KEY);
      const pendingCount = updated.filter(m => m.isTask && !m.isDone).length;
      pendingTaskCountChange?.(pendingCount);
    } catch (err) {
      console.error('Failed to update task done state:', err);
    }
  };

  // ── Convert Message to Task or vice-versa ──
  const handleToggleTaskStatus = async (msgId: string) => {
    const updated = messages.map(m => {
      if (m.id !== msgId) return m;
      return {
        ...m,
        isTask: !m.isTask,
        isDone: false,
        priority: !m.isTask ? ('normal' as const) : undefined,
      };
    });

    setMessages(updated);
    setActiveMenuId(null);
    try {
      await supabaseAdmin.from(KV).update({ value: updated }).eq('key', CHAT_STORAGE_KEY);
      const pendingCount = updated.filter(m => m.isTask && !m.isDone).length;
      pendingTaskCountChange?.(pendingCount);
    } catch (err) {
      console.error('Failed to toggle task conversion:', err);
    }
  };

  // ── Delete Message ──
  const handleDeleteMessage = async (msgId: string) => {
    const updated = messages.filter(m => m.id !== msgId);
    setMessages(updated);
    setActiveMenuId(null);
    try {
      await supabaseAdmin.from(KV).update({ value: updated }).eq('key', CHAT_STORAGE_KEY);
      const pendingCount = updated.filter(m => m.isTask && !m.isDone).length;
      pendingTaskCountChange?.(pendingCount);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  if (!isOpen) return null;

  // ── Filter messages based on active channel and status ──
  const channelMessages = messages.filter(m => {
    if (activeTabChannel === 'general') {
      return !m.channelType || m.channelType === 'general';
    }

    // PM Channel Filtering:
    if (m.channelType !== 'pm') return false;

    if (isSuperAdmin) {
      // Super Admin viewing PM with selectedAdminId
      if (!selectedAdminId) return true;
      return (
        (m.senderId === user?.id && m.recipientId === selectedAdminId) ||
        (m.senderId === selectedAdminId && (m.recipientId === user?.id || m.recipientRole === 'super_admin'))
      );
    } else {
      // Regular Admin: ONLY sees PM between themselves and Super Admin
      return (
        (m.senderId === user?.id && (m.recipientRole === 'super_admin' || m.recipientId === targetAdminContact?.id)) ||
        ((m.senderRole === 'super_admin' || m.senderId === targetAdminContact?.id) && m.recipientId === user?.id)
      );
    }
  });

  const filteredMessages = channelMessages.filter(m => {
    if (filter === 'pending') return m.isTask && !m.isDone;
    if (filter === 'done') return m.isTask && m.isDone;
    return true;
  });

  const pendingTasksCount = channelMessages.filter(m => m.isTask && !m.isDone).length;

  // List regular admins for Super Admin to choose from
  const regularAdmins = contacts.filter(c => c.role === 'admin' && c.id !== user?.id);

  // ── Minimized Floating Pill ──
  if (isMinimized) {
    return (
      <div
        data-admin-chat-open="true"
        className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 hover:bg-slate-800 transition-all cursor-pointer select-none"
        onClick={() => setIsMinimized(false)}
      >
        <MessageSquare size={16} className="text-blue-400" />
        <span className="text-xs font-bold">Chat &amp; Tugas Admin</span>
        {pendingTasksCount > 0 && (
          <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[11px] font-black">
            {pendingTasksCount} To-Do
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="ml-1 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-white/10"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── Container Classes based on Mode ──
  const containerClasses = mode === 'sidepanel'
    ? `fixed top-0 right-0 bottom-0 z-[70] bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-all duration-75`
    : `fixed bottom-5 right-5 z-[70] w-[460px] max-w-[calc(100vw-32px)] h-[640px] max-h-[calc(100vh-80px)] rounded-2xl shadow-2xl border border-slate-200 flex flex-col bg-white overflow-hidden animate-in fade-in zoom-in-95 duration-150`;

  const containerStyle = mode === 'sidepanel'
    ? { width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100vw' : `${panelWidth}px` }
    : undefined;

  return (
    <aside
      data-admin-chat-open="true"
      className={containerClasses}
      style={containerStyle}
      aria-label="Admin Internal Chat & Task Panel"
    >
      {/* Resizable handle on the left edge (only in sidepanel mode on desktop) */}
      {mode === 'sidepanel' && (
        <div
          onMouseDown={handleMouseDownResize}
          title="Tarik ke kiri/kanan untuk memperbesar atau memperkecil lebar panel chat"
          className="hidden md:flex absolute -left-2 top-0 bottom-0 w-3 cursor-col-resize z-50 items-center justify-center group hover:bg-blue-500/20 transition-colors"
        >
          <div className="w-1 h-14 bg-slate-300 group-hover:bg-blue-600 rounded-full transition-colors flex items-center justify-center shadow-xs">
            <GripVertical size={11} className="text-slate-500 group-hover:text-white" />
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between gap-2 border-b border-white/10 flex-shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
            <MessageSquare size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight truncate">
                {activeTabChannel === 'general' ? 'Ruang Chat Admin' : isSuperAdmin ? `PM: ${targetAdminContact?.name || 'Pilih Admin'}` : 'PM dengan Super Admin'}
              </h3>
              {pendingTasksCount > 0 && (
                <span className="bg-amber-400 text-amber-950 px-2 py-0.2 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0">
                  {pendingTasksCount} To-Do
                </span>
              )}
            </div>
            <p className="text-[11px] text-blue-200/70 truncate">
              {activeTabChannel === 'general' ? 'Obrolan umum seluruh tim admin' : 'Pesan pribadi rahasia (1-on-1)'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMode(m => m === 'sidepanel' ? 'floating' : 'sidepanel')}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title={mode === 'sidepanel' ? 'Ganti ke mode Pop-up Mengambang' : 'Tempelkan ke Panel Kanan (Sidepanel)'}
          >
            {mode === 'sidepanel' ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Kecilkan (Minimize)"
          >
            <ChevronDown size={17} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Tutup Panel"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* ── Channel Switcher: RUANG BERSAMA vs PM PRIBADI ── */}
      <div className="px-3 pt-2.5 pb-2 bg-slate-900 border-b border-white/10 flex-shrink-0 space-y-2">
        <div className="grid grid-cols-2 gap-1.5 bg-slate-800/90 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTabChannel('general')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTabChannel === 'general'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users size={14} />
            <span>Ruang Bersama</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabChannel('pm')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTabChannel === 'pm'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Lock size={13} />
            <span>{isSuperAdmin ? 'PM Pribadi (Admin)' : 'PM Super Admin'}</span>
          </button>
        </div>

        {/* If Super Admin is in PM mode: Select which admin to chat with */}
        {activeTabChannel === 'pm' && isSuperAdmin && (
          <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-white/5">
            <span className="text-[11px] font-bold text-slate-300 shrink-0 flex items-center gap-1">
              <User size={12} className="text-indigo-400" />
              Chat ke:
            </span>
            <select
              value={selectedAdminId}
              onChange={(e) => setSelectedAdminId(e.target.value)}
              className="flex-1 bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer truncate"
            >
              {regularAdmins.length === 0 ? (
                <option value="">Tidak ada admin lain terdaftar</option>
              ) : (
                regularAdmins.map(adm => (
                  <option key={adm.id} value={adm.id}>
                    {adm.name} ({adm.email})
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* If regular Admin is in PM mode: Explanatory note */}
        {activeTabChannel === 'pm' && !isSuperAdmin && (
          <div className="flex items-center gap-2 bg-indigo-950/60 p-2 rounded-xl border border-indigo-500/20 text-[11px] text-indigo-200">
            <ShieldCheck size={14} className="text-indigo-400 shrink-0" />
            <span>Saluran pesan rahasia langsung dengan <strong>Super Admin</strong>.</span>
          </div>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filter === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <AlertCircle size={12} className={filter === 'pending' ? 'text-slate-950' : 'text-amber-500'} />
            <span>To-Do ({pendingTasksCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('done')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filter === 'done'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <CheckCircle2 size={12} className={filter === 'done' ? 'text-white' : 'text-emerald-500'} />
            <span>Selesai</span>
          </button>
        </div>

        <span className="text-[11px] font-bold text-slate-400 shrink-0">
          {activeTabChannel === 'general' ? '📢 Umum' : '🔒 PM'}
        </span>
      </div>

      {/* ── Messages & Task List ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-100/50">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2">
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Memuat pesan...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 mb-3 shadow-2xs">
              <MessageSquare size={22} />
            </div>
            <p className="font-bold text-slate-700 text-sm">
              {filter === 'pending' ? 'Tidak ada tugas yang pending!' : filter === 'done' ? 'Belum ada tugas selesai' : 'Belum ada pesan'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
              {activeTabChannel === 'pm'
                ? 'Mulai obrolan pribadi atau berikan to-do list khusus antara Super Admin dan Admin.'
                : 'Mulai kirim pesan dan aktifkan "Jadikan To-Do" untuk meng-highlight pekerjaan admin.'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === user?.id || msg.senderName === user?.name;
            const isMenuOpen = activeMenuId === msg.id;

            // Render Task Card
            if (msg.isTask) {
              return (
                <div
                  key={msg.id}
                  className={`rounded-2xl border p-3.5 transition-all shadow-2xs relative group ${
                    msg.isDone
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-700'
                      : msg.priority === 'urgent'
                      ? 'bg-gradient-to-r from-red-50/90 to-amber-50/80 border-red-200 ring-1 ring-red-300/60'
                      : 'bg-white border-amber-200/90 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        msg.isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : msg.priority === 'urgent'
                          ? 'bg-red-500 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {msg.isDone ? <Check size={10} /> : <AlertCircle size={10} />}
                        {msg.isDone ? 'Tugas Selesai' : msg.priority === 'urgent' ? 'PENTING / URGENT' : 'Tugas / To-Do'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        Oleh: {msg.senderName} {msg.senderRole === 'super_admin' ? '(SuperAdmin)' : ''}
                      </span>
                      {msg.channelType === 'pm' && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                          PM
                        </span>
                      )}
                    </div>

                    {/* Options dropdown toggle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : msg.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-6 z-20 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs">
                          <button
                            type="button"
                            onClick={() => handleToggleTaskStatus(msg.id)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                          >
                            <MessageSquare size={13} />
                            Ubah ke Chat Biasa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 size={13} />
                            Hapus Pesan
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task Content */}
                  <p className={`mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words font-medium ${
                    msg.isDone ? 'line-through text-slate-500' : 'text-slate-800'
                  }`}>
                    {msg.content}
                  </p>

                  {/* Footer status & Mark As Done button */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Clock size={11} />
                      <span>{new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.isDone && msg.doneBy && (
                        <span className="text-emerald-700 font-semibold ml-1">
                          · Selesai oleh {msg.doneBy}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleDone(msg.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer ${
                        msg.isDone
                          ? 'bg-emerald-100/80 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {msg.isDone ? (
                        <>
                          <CheckCircle2 size={13} className="text-emerald-700" />
                          <span>Sudah Selesai</span>
                        </>
                      ) : (
                        <>
                          <Circle size={13} />
                          <span>Tandai Selesai</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            }

            // Normal Chat Bubble
            return (
              <div
                key={msg.id}
                className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-bold text-slate-600">
                    {msg.senderName} {msg.senderRole === 'super_admin' ? '(SuperAdmin)' : ''}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="relative group max-w-[85%]">
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-2xs ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Quick Action Button to convert to Task */}
                  <div className={`absolute top-1 ${isMe ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <button
                      type="button"
                      onClick={() => handleToggleTaskStatus(msg.id)}
                      className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-amber-600 shadow-xs cursor-pointer"
                      title="Jadikan Tugas / To-Do"
                    >
                      <Pin size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area (Cleaned up, no buttons clipping or overlapping) ── */}
      <div className="p-3.5 bg-white border-t border-slate-200 flex-shrink-0 space-y-2.5">
        {/* Task toggle & Priority toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isTaskInput}
              onChange={(e) => setIsTaskInput(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
            />
            <span className={`font-bold transition-colors ${isTaskInput ? 'text-amber-700' : 'text-slate-600'}`}>
              📌 Jadikan Tugas (To-Do Kerja)
            </span>
          </label>

          {isTaskInput && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">Prioritas:</span>
              <button
                type="button"
                onClick={() => setTaskPriority('normal')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  taskPriority === 'normal'
                    ? 'bg-slate-200 text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Biasa
              </button>
              <button
                type="button"
                onClick={() => setTaskPriority('urgent')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  taskPriority === 'urgent'
                    ? 'bg-red-500 text-white shadow-2xs'
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                Mendesak 🔥
              </button>
            </div>
          )}
        </div>

        {/* Textarea + Send button */}
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isTaskInput
                  ? 'Tulis rincian tugas yang harus dikerjakan...'
                  : activeTabChannel === 'pm'
                  ? `Ketik pesan pribadi ke ${targetAdminContact?.name || (isSuperAdmin ? 'Admin' : 'Super Admin')}...`
                  : 'Ketik pesan obrolan admin... (Enter untuk kirim)'
              }
              rows={2}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none focus:ring-2 resize-none transition-all ${
                isTaskInput
                  ? 'border-amber-300 bg-amber-50/40 focus:ring-amber-400 placeholder:text-amber-700/50'
                  : 'border-slate-300 bg-slate-50/50 focus:ring-blue-500'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className={`p-3 rounded-xl font-bold flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 ${
              isTaskInput
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            title="Kirim Pesan"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>
    </aside>
  );
}
