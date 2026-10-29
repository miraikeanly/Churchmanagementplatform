import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EdgeKV as supabaseAdmin } from '../../../lib/edgeKvClient';
import { api } from '../../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageSquare, X, Send, CheckCircle2, Circle, Clock, AlertCircle,
  Pin, Sparkles, Filter, Check, Trash2, Maximize2, Minimize2,
  ChevronDown, ChevronUp, MoreVertical, GripVertical, User, Calendar,
  Users, Lock, ShieldCheck, Shield, ChevronRight, Bell, Search
} from 'lucide-react';

const KV = 'kv_store_561004a0';
const CHAT_STORAGE_KEY = 'admin_chat:messages';

// Play subtle, friendly notification chime via Web Audio API without needing external audio files
function playChatNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Note 1: gentle sine (D5 - 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Note 2: higher pleasant chime (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.08);
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.38);
  } catch {}
}

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

export interface ChatToast {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  content: string;
  channelType: 'general' | 'pm';
  isTask?: boolean;
  createdAt: string;
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
  onOpen?: () => void;
  pendingTaskCountChange?: (count: number) => void;
  unreadCountChange?: (count: number) => void;
}

export default function AdminChatDrawer({
  isOpen,
  onClose,
  onOpen,
  pendingTaskCountChange,
  unreadCountChange,
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

  // Active channel: 'general', 'pm', or 'users'
  const [activeTabChannel, setActiveTabChannel] = useState<'general' | 'pm' | 'users'>('general');
  // For SuperAdmin / DM: selected target admin to chat with
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  // User tab search filter
  const [userSearchText, setUserSearchText] = useState<string>('');

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
          // Auto select first target contact if none selected
          if (!selectedAdminId) {
            const otherUsers = validUsers.filter(u => u.id !== user?.id);
            if (isSuperAdmin) {
              // Super admin defaults to first other user (admin or another super_admin)
              if (otherUsers.length > 0) setSelectedAdminId(otherUsers[0].id);
            } else {
              // Regular admin defaults to super_admin contact
              const sa = otherUsers.find(u => u.role === 'super_admin');
              if (sa) setSelectedAdminId(sa.id);
              else if (otherUsers.length > 0) setSelectedAdminId(otherUsers[0].id);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load admin contacts:', e);
      }
    }
    loadContacts();
  }, [isSuperAdmin, user?.id]);

  const prevPendingCountRef = useRef(-1);

  // ── Read Times tracking (persisted to localStorage per user) ──
  const [readTimes, setReadTimes] = useState<Record<string, number>>(() => {
    try {
      if (!user?.id) return {};
      const saved = localStorage.getItem(`admin_chat_read_${user.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveReadTimes = useCallback((newTimes: Record<string, number>) => {
    setReadTimes(newTimes);
    if (user?.id) {
      try {
        localStorage.setItem(`admin_chat_read_${user.id}`, JSON.stringify(newTimes));
      } catch {}
    }
  }, [user?.id]);

  // ── Toast Pop-up Notification State ──
  const [activeToast, setActiveToast] = useState<ChatToast | null>(null);
  const activeToastTimerRef = useRef<any>(null);
  const knownMessageIdsRef = useRef<Set<string> | null>(null);

  // Keep a ref to latest UI state so polling doesn't recreate interval or miss current tab
  const stateRef = useRef({
    isOpen,
    isMinimized,
    activeTabChannel,
    selectedAdminId,
    userId: user?.id,
    userName: user?.name,
    userRole: user?.role,
  });

  useEffect(() => {
    stateRef.current = {
      isOpen,
      isMinimized,
      activeTabChannel,
      selectedAdminId,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
    };
  }, [isOpen, isMinimized, activeTabChannel, selectedAdminId, user?.id, user?.name, user?.role]);

  // ── Load messages from KV ──
  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await supabaseAdmin.from(KV).select('key, value').eq('key', CHAT_STORAGE_KEY).maybeSingle();
      if (data && Array.isArray((data as any).value)) {
        const msgs = (data as any).value as AdminChatMessage[];
        setMessages(msgs);

        // Detect newly arrived messages for realtime toast & audio notification
        const currentUid = stateRef.current.userId;
        const currentUname = stateRef.current.userName;
        const currentUrole = stateRef.current.userRole;

        if (knownMessageIdsRef.current === null) {
          // First load: cache all existing message IDs without triggering audio/popups
          knownMessageIdsRef.current = new Set(msgs.map(m => m.id));
        } else {
          // Identify new messages not present in previous snapshot
          const newArrivals = msgs.filter(m => !knownMessageIdsRef.current!.has(m.id));
          msgs.forEach(m => knownMessageIdsRef.current!.add(m.id));

          if (newArrivals.length > 0) {
            // Find incoming messages from other people directed to this user
            const relevantNew = newArrivals.filter(m => {
              if (m.senderId === currentUid || m.senderName === currentUname) return false;
              if (!m.channelType || m.channelType === 'general') return true;
              return m.recipientId === currentUid || (!m.recipientId && m.recipientRole === currentUrole);
            });

            if (relevantNew.length > 0) {
              const latest = relevantNew[relevantNew.length - 1];
              const st = stateRef.current;
              const isLookingAtIt =
                st.isOpen &&
                !st.isMinimized &&
                ((latest.channelType === 'general' && st.activeTabChannel === 'general') ||
                 (latest.channelType === 'pm' && st.activeTabChannel === 'pm' && st.selectedAdminId === latest.senderId));

              // If drawer is closed or user is in another channel/contact, show stylish pop-up & chime!
              if (!isLookingAtIt) {
                setActiveToast({
                  id: latest.id,
                  senderId: latest.senderId,
                  senderName: latest.senderName,
                  senderRole: latest.senderRole,
                  content: latest.content,
                  channelType: latest.channelType || 'general',
                  isTask: latest.isTask,
                  createdAt: latest.createdAt,
                });
                playChatNotificationSound();

                if (activeToastTimerRef.current) clearTimeout(activeToastTimerRef.current);
                activeToastTimerRef.current = setTimeout(() => {
                  setActiveToast(null);
                }, 8500);
              }
            }
          }
        }

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

  // ── Compute Unread Counts ──
  const { unreadGeneralCount, unreadPmCount, unreadByContact, totalUnread } = useMemo(() => {
    let generalCount = 0;
    const pmCounts: Record<string, number> = {};

    messages.forEach(m => {
      // Own messages are never unread
      if (m.senderId === user?.id || m.senderName === user?.name) return;

      const msgTime = new Date(m.createdAt).getTime();

      if (!m.channelType || m.channelType === 'general') {
        const lastRead = readTimes.general || 0;
        if (msgTime > lastRead) {
          generalCount++;
        }
      } else if (m.channelType === 'pm') {
        const isForMe =
          m.recipientId === user?.id ||
          (!m.recipientId && m.recipientRole === user?.role);

        if (isForMe) {
          const contactKey = m.senderId;
          const lastRead = readTimes[contactKey] || 0;
          if (msgTime > lastRead) {
            pmCounts[contactKey] = (pmCounts[contactKey] || 0) + 1;
          }
        }
      }
    });

    const totalPm = Object.values(pmCounts).reduce((a, b) => a + b, 0);
    return {
      unreadGeneralCount: generalCount,
      unreadPmCount: totalPm,
      unreadByContact: pmCounts,
      totalUnread: generalCount + totalPm,
    };
  }, [messages, readTimes, user?.id, user?.name, user?.role]);

  // Notify parent of total unread count for header badge
  useEffect(() => {
    unreadCountChange?.(totalUnread);
  }, [totalUnread, unreadCountChange]);

  // ── Automatically Mark Messages as Read when user is viewing them ──
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    if (activeTabChannel === 'general') {
      const now = Date.now();
      if ((readTimes.general || 0) < now - 1500) {
        saveReadTimes({ ...readTimes, general: now });
      }
    } else if (activeTabChannel === 'pm' && selectedAdminId) {
      const now = Date.now();
      if ((readTimes[selectedAdminId] || 0) < now - 1500) {
        saveReadTimes({ ...readTimes, [selectedAdminId]: now });
      }
    }
  }, [isOpen, isMinimized, activeTabChannel, selectedAdminId, messages.length, readTimes, saveReadTimes]);

  // Handle opening and replying directly from Toast Pop-up Notification
  const handleOpenFromToast = (toastItem: ChatToast) => {
    onOpen?.();
    setIsMinimized(false);
    setActiveTabChannel(toastItem.channelType);
    const now = Date.now();
    if (toastItem.channelType === 'pm') {
      setSelectedAdminId(toastItem.senderId);
      saveReadTimes({ ...readTimes, [toastItem.senderId]: now });
    } else {
      saveReadTimes({ ...readTimes, general: now });
    }
    setActiveToast(null);
  };

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
  const targetContact = contacts.find(c => c.id === selectedAdminId) ||
    (isSuperAdmin
      ? contacts.find(c => c.id !== user?.id)
      : contacts.find(c => c.role === 'super_admin' && c.id !== user?.id));

  // ── Send Message or Task ──
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);

    const isPM = activeTabChannel === 'pm';
    const targetId = isPM ? (targetContact?.id || selectedAdminId || 'super_admin') : undefined;
    const targetName = isPM ? (targetContact?.name || (targetContact?.role === 'super_admin' ? 'Super Admin' : 'Admin')) : undefined;
    const targetRole = isPM ? (targetContact?.role || (isSuperAdmin ? 'admin' : 'super_admin')) : undefined;

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
      recipientId: targetId,
      recipientName: targetName,
      recipientRole: targetRole,
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

  // ── Render Realtime Toast Popup Notification ──
  const renderToastPopup = () => {
    if (!activeToast) return null;
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-5 right-5 z-[99999] w-[380px] max-w-[calc(100vw-32px)] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-indigo-500/40 p-4 flex flex-col gap-2.5 transition-all duration-300 animate-in slide-in-from-top-4 fade-in"
        style={{ filter: 'drop-shadow(0 20px 25px -5px rgba(0, 0, 0, 0.25))' }}
      >
        {/* Top Accent Header */}
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              {activeToast.senderRole === 'super_admin' ? '👑' : '🛡️'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs text-slate-900 truncate">
                  {activeToast.senderName}
                </span>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  activeToast.senderRole === 'super_admin'
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-blue-100 text-blue-900 border border-blue-200'
                }`}>
                  {activeToast.senderRole === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-semibold mt-0.5">
                {activeToast.channelType === 'pm' ? (
                  <>
                    <Lock size={10} />
                    <span>Direct Message baru</span>
                  </>
                ) : (
                  <>
                    <Users size={10} />
                    <span>Pesan di Ruang Bersama</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Tutup Notifikasi"
          >
            <X size={15} />
          </button>
        </div>

        {/* Message body preview */}
        <div
          onClick={() => handleOpenFromToast(activeToast)}
          className="cursor-pointer group rounded-xl p-2.5 transition-colors bg-slate-50 hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-200"
        >
          {activeToast.isTask ? (
            <div className="flex items-start gap-1.5 text-xs text-amber-900 font-medium">
              <span className="font-black text-amber-600 shrink-0">📌 [Tugas Baru]:</span>
              <span className="line-clamp-2">{activeToast.content}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
              “{activeToast.content}”
            </p>
          )}
        </div>

        {/* Footer info & CTA */}
        <div className="flex items-center justify-between pt-1 text-[11px]">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Clock size={11} /> Baru saja
          </span>
          <button
            type="button"
            onClick={() => handleOpenFromToast(activeToast)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <MessageSquare size={12} />
            <span>Buka &amp; Balas</span>
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    );
  };

  // ── If drawer is closed, only render incoming message Toast Popup ──
  if (!isOpen) {
    return activeToast ? renderToastPopup() : null;
  }

  // ── Filter messages based on active channel and status ──
  const channelMessages = messages.filter(m => {
    if (activeTabChannel === 'general') {
      return !m.channelType || m.channelType === 'general';
    }

    // PM Channel Filtering:
    if (m.channelType !== 'pm') return false;

    // Direct conversation between user and selected target
    if (selectedAdminId) {
      const isBetweenCurrentAndTarget =
        (m.senderId === user?.id && m.recipientId === selectedAdminId) ||
        (m.senderId === selectedAdminId && (m.recipientId === user?.id || (!m.recipientId && m.recipientRole === user?.role)));
      if (isBetweenCurrentAndTarget) return true;
    }

    // Legacy fallback: if regular admin and message is from super_admin to this admin (or vice versa)
    if (!isSuperAdmin) {
      const isWithSuperAdmin =
        (m.senderId === user?.id && (m.recipientRole === 'super_admin' || m.recipientId === targetContact?.id)) ||
        ((m.senderRole === 'super_admin' || m.senderId === targetContact?.id) && (m.recipientId === user?.id || !m.recipientId));
      if (isWithSuperAdmin && (!selectedAdminId || selectedAdminId === m.senderId || selectedAdminId === m.recipientId)) {
        return true;
      }
    }

    return false;
  });

  const filteredMessages = channelMessages.filter(m => {
    if (filter === 'pending') return m.isTask && !m.isDone;
    if (filter === 'done') return m.isTask && m.isDone;
    return true;
  });

  const pendingTasksCount = channelMessages.filter(m => m.isTask && !m.isDone).length;

  // List all available contacts to chat with (excluding current user)
  const otherContacts = contacts.filter(c => c.id !== user?.id);
  const superAdminContacts = otherContacts.filter(c => c.role === 'super_admin');
  const adminContacts = otherContacts.filter(c => c.role === 'admin');

  // ── User Directory Lists (Discord Style) ──
  const filteredUserList = useMemo(() => {
    const q = userSearchText.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [contacts, userSearchText]);

  const superAdminList = useMemo(() => {
    return filteredUserList.filter(c => c.role === 'super_admin');
  }, [filteredUserList]);

  const adminList = useMemo(() => {
    return filteredUserList.filter(c => c.role !== 'super_admin');
  }, [filteredUserList]);

  // Render individual user card (Discord Style)
  const renderUserCard = (u: AdminUserContact, showAccessStatus: boolean) => {
    const isMe = u.id === user?.id;
    const unread = unreadByContact[u.id] || 0;

    return (
      <div
        key={u.id}
        onClick={() => {
          if (!isMe) {
            setActiveTabChannel('pm');
            setSelectedAdminId(u.id);
          }
        }}
        className={`group p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
          isMe
            ? 'bg-slate-50/70 border-slate-200'
            : 'bg-white hover:bg-indigo-50/50 hover:border-indigo-300 border-slate-200/90 shadow-2xs cursor-pointer active:scale-[0.99]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar with initial and online dot */}
          <div className="relative shrink-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-xs ${
              showAccessStatus && u.role === 'super_admin'
                ? 'bg-gradient-to-tr from-amber-500 to-amber-700'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
            }`}>
              {u.name ? u.name.charAt(0).toUpperCase() : '?'}
            </div>
            {/* Online indicator dot */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                {u.name}
              </span>
              {isMe && (
                <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded-md">
                  Anda
                </span>
              )}
              {/* Only show role badge if Super Admin view */}
              {showAccessStatus && (
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  u.role === 'super_admin'
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-blue-100 text-blue-900 border border-blue-200'
                }`}>
                  {u.role === 'super_admin' ? '👑 Super Admin' : '🛡️ Admin'}
                </span>
              )}
            </div>

            {/* Subtitle: If Super Admin view, show Status Akses. If Admin view, ONLY show email without status access */}
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {showAccessStatus ? (
                u.role === 'super_admin' ? (
                  <span className="text-amber-700 font-semibold">Status Akses: Penuh (Full Control)</span>
                ) : (
                  <span className="text-slate-500 font-medium">Status Akses: Admin Terbatas</span>
                )
              ) : (
                <span className="text-slate-500">{u.email || 'Admin Tim'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Right Action */}
        <div className="flex items-center gap-2 shrink-0">
          {unread > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse shadow-xs">
              {unread} baru
            </span>
          )}

          {!isMe ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTabChannel('pm');
                setSelectedAdminId(u.id);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-[11px] flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
              title={`Kirim Direct Message ke ${u.name}`}
            >
              <MessageSquare size={12} />
              <span className="hidden sm:inline">Chat</span>
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400 px-1">
              Akun Anda
            </span>
          )}
        </div>
      </div>
    );
  };

  // ── Minimized Floating Pill ──
  if (isMinimized) {
    return (
      <>
        {renderToastPopup()}
        <div
          data-admin-chat-open="true"
          className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 hover:bg-slate-800 transition-all cursor-pointer select-none"
          onClick={() => setIsMinimized(false)}
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare size={16} className="text-blue-400" />
            {totalUnread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
            )}
          </div>
          <span className="text-xs font-bold">Chat &amp; Tugas Admin</span>
          {totalUnread > 0 && (
            <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[11px] font-black animate-bounce shadow-xs">
              {totalUnread} baru
            </span>
          )}
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
      </>
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
    <>
      {renderToastPopup()}
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
            {activeTabChannel === 'users' ? <User size={16} /> : <MessageSquare size={16} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight truncate">
                {activeTabChannel === 'general'
                  ? 'Ruang Chat Admin'
                  : activeTabChannel === 'pm'
                  ? (targetContact?.name ? `Direct Message: ${targetContact.name}` : 'Direct Message')
                  : 'Daftar Pengguna'}
              </h3>
              {pendingTasksCount > 0 && activeTabChannel !== 'users' && (
                <span className="bg-amber-400 text-amber-950 px-2 py-0.2 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0">
                  {pendingTasksCount} To-Do
                </span>
              )}
            </div>
            <p className="text-[11px] text-blue-200/70 truncate">
              {activeTabChannel === 'general'
                ? 'Obrolan umum seluruh tim admin & superadmin'
                : activeTabChannel === 'pm'
                ? `Direct Message dengan ${targetContact?.name || 'Admin'} (${targetContact?.role === 'super_admin' ? 'Super Admin' : 'Admin'})`
                : isSuperAdmin
                ? 'Daftar seluruh akun Super Admin & Admin beserta status akses'
                : 'Daftar seluruh anggota tim'}
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

      {/* ── Channel Switcher: RUANG BERSAMA vs DIRECT MESSAGE vs PENGGUNA ── */}
      <div className="px-3 pt-2.5 pb-2 bg-slate-900 border-b border-white/10 flex-shrink-0 space-y-2">
        <div className="grid grid-cols-3 gap-1 bg-slate-800/90 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTabChannel('general')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer relative ${
              activeTabChannel === 'general'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users size={13} className="shrink-0" />
            <span className="truncate">Ruang Bersama</span>
            {unreadGeneralCount > 0 && (
              <span className="ml-0.5 bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[9px] font-black tracking-tight animate-pulse shadow-xs">
                {unreadGeneralCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTabChannel('pm')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer relative ${
              activeTabChannel === 'pm'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Lock size={12} className="shrink-0" />
            <span className="truncate">Direct Message</span>
            {unreadPmCount > 0 && (
              <span className="ml-0.5 bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[9px] font-black tracking-tight animate-pulse shadow-xs">
                {unreadPmCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTabChannel('users')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer relative ${
              activeTabChannel === 'users'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <User size={13} className="shrink-0" />
            <span className="truncate">Pengguna</span>
            <span className="ml-0.5 text-[9px] px-1 py-0.2 bg-white/10 rounded-full font-semibold">
              {contacts.length}
            </span>
          </button>
        </div>

        {/* Contact Selector for PM Mode: Available for both Super Admin and Regular Admin */}
        {activeTabChannel === 'pm' && (
          <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-white/5">
            <span className="text-[11px] font-bold text-slate-300 shrink-0 flex items-center gap-1">
              <User size={12} className="text-indigo-400" />
              Chat dengan:
            </span>
            <select
              value={selectedAdminId}
              onChange={(e) => setSelectedAdminId(e.target.value)}
              className="flex-1 bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer truncate"
            >
              {otherContacts.length === 0 ? (
                <option value="">Tidak ada akun admin lain terdaftar</option>
              ) : (
                <>
                  {superAdminContacts.length > 0 && (
                    <optgroup label="👑 Super Admin">
                      {superAdminContacts.map(c => {
                        const count = unreadByContact[c.id] || 0;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} (Super Admin){count > 0 ? ` 🔴 (${count} baru)` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  {adminContacts.length > 0 && (
                    <optgroup label="🛡️ Admin">
                      {adminContacts.map(c => {
                        const count = unreadByContact[c.id] || 0;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} (Admin){count > 0 ? ` 🔴 (${count} baru)` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </>
              )}
            </select>
            {unreadByContact[selectedAdminId] > 0 && (
              <span className="bg-rose-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 animate-pulse">
                {unreadByContact[selectedAdminId]} baru
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Conditional Views: PENGGUNA TAB vs CHAT/TASK TAB ── */}
      {activeTabChannel === 'users' ? (
        /* ── Discord-Style User Directory ── */
        <div className="flex-1 flex flex-col min-h-0 bg-slate-100/60 overflow-hidden">
          {/* Search Header */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearchText}
                onChange={(e) => setUserSearchText(e.target.value)}
                placeholder="Cari nama pengguna / admin..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {userSearchText && (
                <button
                  type="button"
                  onClick={() => setUserSearchText('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="text-[11px] font-bold text-slate-500 shrink-0 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {filteredUserList.length} User
            </span>
          </div>

          {/* User List Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {filteredUserList.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <User size={24} className="text-slate-300 mb-2" />
                <p className="font-bold text-slate-600 text-xs">Tidak ada pengguna ditemukan</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Coba gunakan kata kunci pencarian yang lain.</p>
              </div>
            ) : isSuperAdmin ? (
              /* ── SUPER ADMIN VIEW: Dibagi Super Admin & Admin dengan Status Akses ── */
              <>
                {/* Super Admin Section */}
                {superAdminList.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black tracking-wider uppercase text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/80 flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5">
                        <span>👑</span>
                        <span>SUPER ADMIN — {superAdminList.length}</span>
                      </span>
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">
                        Status: Akses Penuh
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {superAdminList.map(u => renderUserCard(u, true))}
                    </div>
                  </div>
                )}

                {/* Admin Section */}
                {adminList.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black tracking-wider uppercase text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/80 flex items-center justify-between mb-2 mt-4">
                      <span className="flex items-center gap-1.5">
                        <span>🛡️</span>
                        <span>ADMIN — {adminList.length}</span>
                      </span>
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                        Status: Akses Terbatas
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {adminList.map(u => renderUserCard(u, true))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ── REGULAR ADMIN VIEW: Cuma nama aja tanpa status access ── */
              <div>
                <div className="text-[10px] font-black tracking-wider uppercase text-slate-600 bg-slate-200/70 px-3 py-1.5 rounded-xl border border-slate-300/60 flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5">
                    <span>👥</span>
                    <span>DAFTAR PENGGUNA — {filteredUserList.length}</span>
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500">
                    Anggota Tim
                  </span>
                </div>

                <div className="space-y-1.5">
                  {filteredUserList.map(u => renderUserCard(u, false))}
                </div>
              </div>
            )}
          </div>

          {/* User Tab Bottom Notice */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
            <span>Total <strong>{contacts.length}</strong> akun terdaftar</span>
            <span className="text-indigo-600 font-bold flex items-center gap-1">
              <MessageSquare size={11} /> Klik untuk kirim Direct Message
            </span>
          </div>
        </div>
      ) : (
        <>
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
          {activeTabChannel === 'general' ? '📢 Umum' : '🔒 Direct Message'}
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
                ? 'Mulai obrolan Direct Message atau berikan to-do list khusus ke rekan admin.'
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
                          DM
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
                  ? `Ketik Direct Message ke ${targetContact?.name || (isSuperAdmin ? 'Admin' : 'Super Admin')}...`
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
      </>
    )}
    </aside>
    </>
  );
}
