import { useState, useEffect, useRef } from 'react';
import { ArrowUpToLine, ArrowDownToLine } from 'lucide-react';

export default function ScrollNavigation() {
  const [canScroll, setCanScroll] = useState(false);
  const [mode, setMode] = useState<'up' | 'down'>('down');
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const lastScrollY = useRef<number>(0);

  useEffect(() => {
    const updateScrollState = (e?: Event) => {
      let top = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      let max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;

      if (e?.target && e.target instanceof HTMLElement && e.target !== document.documentElement && e.target !== document.body) {
        const el = e.target;
        if (el.scrollHeight > el.clientHeight + 80) {
          top = el.scrollTop;
          max = el.scrollHeight - el.clientHeight;
        }
      }

      const scrollable = max > 80;
      setCanScroll(scrollable);
      if (!scrollable) return;

      const delta = top - lastScrollY.current;
      lastScrollY.current = top;

      const atTop = top <= 50;
      const atBottom = top >= max - 50;

      if (atTop) {
        // Di paling atas -> tampilkan tombol ke bawah (↓) terus
        setMode('down');
      } else if (atBottom) {
        // Di paling bawah -> tampilkan tombol ke atas (↑) terus
        setMode('up');
      } else if (delta < -2) {
        // Sedang scroll ke atas -> tampilkan tombol ke atas (↑), tombol bawah hilang
        setMode('up');
      } else if (delta > 2) {
        // Sedang scroll ke bawah -> tampilkan tombol ke bawah (↓), tombol atas hilang
        setMode('down');
      }
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true, capture: true });
    window.addEventListener('resize', () => updateScrollState());
    const timer = setInterval(() => updateScrollState(), 1000);
    return () => {
      window.removeEventListener('scroll', updateScrollState, { capture: true } as any);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const checkDrawer = () => {
      const open = document.querySelector('[data-admin-chat-open="true"]') !== null;
      setChatDrawerOpen(open);
    };
    checkDrawer();
    const interval = setInterval(checkDrawer, 600);
    return () => clearInterval(interval);
  }, []);

  if (chatDrawerOpen || !canScroll) return null;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll<HTMLElement>('.overflow-y-auto, main, [data-scroll-container]').forEach(el => {
      if (el.scrollHeight > el.clientHeight) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
    setMode('down');
  };

  const scrollToBottom = () => {
    const maxScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    window.scrollTo({ top: maxScroll, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: maxScroll, behavior: 'smooth' });
    document.body.scrollTo({ top: maxScroll, behavior: 'smooth' });
    document.querySelectorAll<HTMLElement>('.overflow-y-auto, main, [data-scroll-container]').forEach(el => {
      if (el.scrollHeight > el.clientHeight) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    setMode('up');
  };

  return (
    <aside
      aria-label="Navigasi Scroll Halaman"
      className="fixed right-2 sm:right-3 bottom-3 z-40 flex flex-col pointer-events-none"
    >
      {mode === 'up' ? (
        <button
          type="button"
          onClick={scrollToTop}
          className="pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 backdrop-blur-xs text-slate-700 hover:text-blue-600 hover:bg-white shadow-md border border-slate-200/90 flex items-center justify-center transition-all transform hover:-translate-y-0.5 active:scale-90 cursor-pointer"
          title="Scroll ke paling atas"
        >
          <ArrowUpToLine size={17} strokeWidth={2.3} />
        </button>
      ) : (
        <button
          type="button"
          onClick={scrollToBottom}
          className="pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 backdrop-blur-xs text-slate-700 hover:text-blue-600 hover:bg-white shadow-md border border-slate-200/90 flex items-center justify-center transition-all transform hover:translate-y-0.5 active:scale-90 cursor-pointer"
          title="Scroll ke paling bawah"
        >
          <ArrowDownToLine size={17} strokeWidth={2.3} />
        </button>
      )}
    </aside>
  );
}
