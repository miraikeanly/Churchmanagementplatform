import { useState, useEffect } from 'react';
import { ArrowUpToLine, ArrowDownToLine } from 'lucide-react';

export default function ScrollNavigation() {
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const checkScrollable = () => {
      const scrollHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      const clientHeight = window.innerHeight;
      // Show when content is taller than viewport
      setCanScroll(scrollHeight > clientHeight + 100);
    };

    checkScrollable();
    window.addEventListener('resize', checkScrollable);
    window.addEventListener('scroll', checkScrollable);

    const timer = setInterval(checkScrollable, 1000);
    return () => {
      window.removeEventListener('resize', checkScrollable);
      window.removeEventListener('scroll', checkScrollable);
      clearInterval(timer);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });

    // Also scroll any active scrollable container
    const containers = document.querySelectorAll<HTMLElement>('.overflow-y-auto, main, [data-scroll-container]');
    containers.forEach(el => {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const scrollToBottom = () => {
    const maxScroll = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    window.scrollTo({ top: maxScroll, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: maxScroll, behavior: 'smooth' });
    document.body.scrollTo({ top: maxScroll, behavior: 'smooth' });

    // Also scroll any active scrollable container
    const containers = document.querySelectorAll<HTMLElement>('.overflow-y-auto, main, [data-scroll-container]');
    containers.forEach(el => {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    });
  };

  // Always render so it's always accessible when needed, or fade in when scrollable
  return (
    <aside
      aria-label="Navigasi Scroll Halaman"
      className={`fixed right-4 sm:right-5 bottom-6 z-50 flex flex-col gap-2.5 transition-opacity duration-300 ${
        canScroll ? 'opacity-100' : 'opacity-80 hover:opacity-100'
      }`}
    >
      {/* Scroll to Top */}
      <button
        type="button"
        onClick={scrollToTop}
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-slate-600 hover:text-blue-600 hover:bg-slate-50 shadow-lg hover:shadow-xl border border-slate-200/80 flex items-center justify-center transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
        title="Scroll ke paling atas"
      >
        <ArrowUpToLine size={20} strokeWidth={2.2} className="group-hover:scale-110 transition-transform" />
      </button>

      {/* Scroll to Bottom */}
      <button
        type="button"
        onClick={scrollToBottom}
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-slate-600 hover:text-blue-600 hover:bg-slate-50 shadow-lg hover:shadow-xl border border-slate-200/80 flex items-center justify-center transition-all transform hover:translate-y-0.5 active:translate-y-0 cursor-pointer group"
        title="Scroll ke paling bawah"
      >
        <ArrowDownToLine size={20} strokeWidth={2.2} className="group-hover:scale-110 transition-transform" />
      </button>
    </aside>
  );
}
