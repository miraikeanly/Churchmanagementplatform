import { useState, useEffect, useRef } from 'react';
import { ArrowUpToLine, ArrowDownToLine } from 'lucide-react';

export default function ScrollNavigation() {
  const [visibleDir, setVisibleDir] = useState<'up' | 'down' | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

  const lastScrollY = useRef<number>(0);
  const hideTimer = useRef<any>(null);

  useEffect(() => {
    const getScrollMetrics = (target?: EventTarget | null) => {
      if (target && target instanceof HTMLElement && target !== document.documentElement && target !== document.body) {
        return {
          top: target.scrollTop,
          max: target.scrollHeight - target.clientHeight,
        };
      }
      const top = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const max = scrollHeight - window.innerHeight;
      return { top, max };
    };

    const handleScroll = (e?: Event) => {
      const { top, max } = getScrollMetrics(e?.target);
      if (max <= 80) {
        setIsActive(false);
        return;
      }

      const delta = top - lastScrollY.current;
      lastScrollY.current = top;

      const atTop = top <= 40;
      const atBottom = top >= max - 40;

      if (delta < -3 && !atTop) {
        // Scrolling UP -> show ONLY Scroll-to-Top button, hide bottom button
        setVisibleDir('up');
        setIsActive(true);
      } else if (delta > 3 && !atBottom) {
        // Scrolling DOWN -> show ONLY Scroll-to-Bottom button, hide top button
        setVisibleDir('down');
        setIsActive(true);
      } else if (atTop || atBottom) {
        setIsActive(false);
      }

      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setIsActive(false);
      }, 1600);
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true } as any);
      if (hideTimer.current) clearTimeout(hideTimer.current);
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

  if (chatDrawerOpen || !visibleDir) return null;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll<HTMLElement>('.overflow-y-auto, main, [data-scroll-container]').forEach(el => {
      if (el.scrollHeight > el.clientHeight) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
    setIsActive(false);
  };

  const scrollToBottom = () => {
    const maxScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    window.scrollTo({ top: maxScroll, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: maxScroll, behavior: 'smooth' });
    document.body.scrollTo({ top: maxScroll, behavior: 'smooth' });
    document.querySelectorAll<HTMLElement>('.overflow-y-auto, main, [data-scroll-container]').forEach(el => {
      if (el.scrollHeight > el.clientHeight) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    setIsActive(false);
  };

  const showNow = isActive || isHovered;

  return (
    <aside
      aria-label="Navigasi Scroll Halaman"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed right-2.5 sm:right-4 bottom-4 z-40 flex flex-col gap-2 transition-all duration-250 ${
        showNow
          ? 'opacity-90 hover:opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-2 scale-90 pointer-events-none'
      }`}
    >
      {visibleDir === 'up' && (
        <button
          type="button"
          onClick={scrollToTop}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/85 backdrop-blur-xs text-slate-700 hover:text-blue-600 hover:bg-white shadow-md border border-slate-200/80 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
          title="Scroll ke paling atas"
        >
          <ArrowUpToLine size={17} strokeWidth={2.3} />
        </button>
      )}

      {visibleDir === 'down' && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/85 backdrop-blur-xs text-slate-700 hover:text-blue-600 hover:bg-white shadow-md border border-slate-200/80 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
          title="Scroll ke paling bawah"
        >
          <ArrowDownToLine size={17} strokeWidth={2.3} />
        </button>
      )}
    </aside>
  );
}
