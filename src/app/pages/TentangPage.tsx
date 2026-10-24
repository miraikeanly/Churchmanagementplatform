import { useRef, useState, useEffect } from 'react';
import { apiBase } from '../../lib/api';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'motion/react';
import { Heart, Star, BookOpen, Users, ArrowRight, UserCircle } from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import { ALL_MINISTRIES } from '../../lib/ministries';
import { useChurchStats, yearsServing } from '../../lib/stats';
import PublicFooter from '../components/public/PublicFooter';
import gbiLogo from '../../imports/pngegg__1_-1.png';

const API_URL = `${apiBase()}/api/content`;

interface TeamMember {
  id: string;
  name: string;
  role: string;
  tier: string;
  order: number;
  photoUrl: string | null;
  spouseName?: string;
  spouseRole?: string;
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

const values = [
  { label: 'Kasih',       desc: 'Mengasihi Tuhan dan sesama dengan tulus dan sepenuh hati',  icon: Heart,    color: 'text-rose-500',    bg: 'bg-rose-50',    border: 'border-rose-100' },
  { label: 'Iman',        desc: 'Bertumbuh dalam pengenalan akan Kristus setiap harinya',     icon: Star,     color: 'text-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  { label: 'Pelayanan',   desc: 'Melayani dengan rendah hati dan penuh sukacita',             icon: BookOpen, color: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  { label: 'Persekutuan', desc: 'Membangun komunitas yang kuat dan saling mendukung',         icon: Users,    color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
];


const TIER_LABELS: Record<string, string> = {
  gembala_sidang:  'Gembala Sidang',
  penerus_gembala: 'Penerus Gembala Sidang',
  wakil_gembala:   'Wakil Gembala',
  pastoral:        'Pastoral',
  koordinator:     'Koordinator Pelayanan',
};

// ── Photo card with zoom-in-on-scroll effect (no useScroll/target) ───────────
function PersonCard({ member, size = 'md' }: { member: TeamMember; size?: 'lg' | 'md' | 'sm' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const h = size === 'lg' ? 'h-[420px]' : size === 'md' ? 'h-[320px]' : 'h-[240px]';

  return (
    <div ref={ref} className={`relative ${h} rounded-3xl overflow-hidden shadow-xl group`}>
      {/* Photo with zoom-in effect when entering viewport */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.12 }}
        animate={inView ? { scale: 1 } : { scale: 1.12 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover object-top" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-blue-900 flex items-center justify-center">
            <UserCircle size={size === 'lg' ? 80 : 56} className="text-white/20" />
          </div>
        )}
      </motion.div>

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Glass info card — slides up on enter */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 p-5"
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl px-5 py-4 shadow-lg">
          <p className={`font-bold text-white leading-tight ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm'}`}>
            {member.spouseName?.trim()
              ? `${member.name} & ${member.spouseName}`
              : member.name}
          </p>
          <p className={`text-white/70 mt-1 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
            {member.spouseName?.trim() && member.spouseRole
              ? `${member.role} & ${member.spouseRole}`
              : member.role}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function TentangPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const stats = useChurchStats();

  useEffect(() => {
    fetch(`${API_URL}/team`)
      .then(r => r.text()).then(t => { try { const d = JSON.parse(t); if (d.success) setTeamMembers(d.members || []); } catch {} })
      .catch(() => {}).finally(() => setTeamLoading(false));
  }, []);

  const byTier = (tier: string) => teamMembers.filter(m => m.tier === tier);

  const tiers = [
    { key: 'gembala_sidang',  members: byTier('gembala_sidang'),  cardSize: 'lg' as const, badge: 'bg-yellow-400/20 border-yellow-300/40 text-yellow-200' },
    { key: 'penerus_gembala', members: byTier('penerus_gembala'), cardSize: 'lg' as const, badge: 'bg-blue-400/20 border-blue-300/40 text-blue-200' },
    { key: 'wakil_gembala',   members: byTier('wakil_gembala'),   cardSize: 'md' as const, badge: 'bg-indigo-400/20 border-indigo-300/40 text-indigo-200' },
    { key: 'pastoral',        members: byTier('pastoral'),        cardSize: 'md' as const, badge: 'bg-emerald-400/20 border-emerald-300/40 text-emerald-200' },
    { key: 'koordinator',     members: byTier('koordinator'),     cardSize: 'sm' as const, badge: 'bg-white/10 border-white/20 text-white/70' },
  ].filter(t => t.members.length > 0);

  const hasTeam = teamMembers.length > 0;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PublicNavbar />

      {/* Hero */}
      <section className="relative pt-36 pb-20 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 60%, #1e1b4b 100%)' }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
            className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-6 ring-4 ring-white/20 shadow-2xl">
            <img src={gbiLogo} alt="GBI Logo" className="w-full h-full object-cover" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4">Tentang Kami</motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="text-blue-200 text-lg max-w-2xl mx-auto leading-relaxed">
            Mengenal lebih dekat komunitas iman GBI Jelambar Timur
          </motion.p>
        </div>
      </section>

      {/* Profil */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <FadeIn>
              <div>
                <span className="inline-block text-blue-600 text-sm font-semibold uppercase tracking-widest mb-4">Profil Gereja</span>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight">Komunitas Iman yang Penuh Kasih & Sukacita</h2>
                <div className="space-y-4 text-gray-600 leading-relaxed">
                  <p><strong className="text-gray-900">GBI Jelambar Timur</strong> adalah komunitas iman yang berdedikasi untuk melayani Tuhan dan sesama. Berdiri sejak lebih dari 30 tahun lalu, kami telah menjadi bagian dari kehidupan ribuan keluarga di Jakarta Barat dan sekitarnya.</p>
                  <p>Kami percaya bahwa setiap orang berharga di mata Tuhan dan memiliki tujuan yang unik. Visi kami adalah menjadi gereja yang hangat, di mana setiap orang dapat bertumbuh dalam iman, membangun hubungan yang bermakna, dan melayani dengan sukacita.</p>
                  <p>Misi kami adalah memberitakan Injil, mendewasakan jemaat, dan menjangkau jiwa-jiwa baru di Jakarta Barat dan seluruh Indonesia.</p>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div className="grid grid-cols-2 gap-4">
                {values.map(v => (
                  <div key={v.label} className={`${v.bg} border ${v.border} rounded-2xl p-6`}>
                    <div className={`w-11 h-11 rounded-xl ${v.bg} border ${v.border} flex items-center justify-center mb-4`}>
                      <v.icon size={22} className={v.color} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">{v.label}</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gradient-to-r from-blue-700 to-indigo-700">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
            {[{ n: stats ? String(stats.members) : '–', label: 'Jemaat' }, { n: String(ALL_MINISTRIES.length), label: 'Komunitas & Ibadah' }, { n: stats ? String(stats.komsel) : '–', label: 'Kelompok Komsel' }, { n: `${yearsServing()}+`, label: 'Tahun Melayani' }].map((s, i) => (
              <FadeIn key={s.label} delay={i * 0.08}>
                <div className="text-3xl md:text-4xl font-bold">{s.n}</div>
                <div className="text-blue-200 text-sm mt-1">{s.label}</div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tim Pelayanan ─────────────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
        <div className="max-w-5xl mx-auto px-6">

          <FadeIn>
            <div className="text-center mb-20">
              <span className="inline-block text-blue-300 text-xs font-bold uppercase tracking-[0.2em] mb-4">Tim Kami</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Hamba-Hamba Tuhan</h2>
              <p className="text-white/40 text-sm max-w-md mx-auto">Mereka yang dipanggil untuk melayani dan memimpin jemaat GBI Jelambar Timur</p>
            </div>
          </FadeIn>

          {teamLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-blue-800 border-t-blue-400 rounded-full animate-spin" />
            </div>
          ) : !hasTeam ? (
            <div className="text-center text-white/30 py-16">
              <UserCircle size={52} className="mx-auto mb-3" />
              <p className="text-sm">Data jajaran belum tersedia</p>
            </div>
          ) : (
            <div className="space-y-20">
              {tiers.map((tier, ti) => (
                <FadeIn key={tier.key} delay={ti * 0.05}>
                  <div>
                    {/* Tier label */}
                    <div className="flex items-center gap-4 mb-8">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border backdrop-blur-sm ${tier.badge}`}>
                        {TIER_LABELS[tier.key]}
                      </span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Cards */}
                    {tier.key === 'koordinator' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {tier.members.map((m, i) => (
                          <FadeIn key={m.id} delay={i * 0.04}>
                            <PersonCard member={m} size="sm" />
                          </FadeIn>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {tier.members.map((m, i) => (
                          <FadeIn key={m.id} delay={i * 0.08}>
                            <div className={tier.cardSize === 'lg' ? 'max-w-2xl mx-auto' : 'max-w-lg mx-auto'}>
                              <PersonCard member={m} size={tier.cardSize} />
                            </div>
                          </FadeIn>
                        ))}
                      </div>
                    )}
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Bergabunglah Bersama Kami</h2>
            <p className="text-gray-500 mb-8">Kami menyambut semua orang untuk hadir dan bertumbuh bersama dalam komunitas iman ini.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/lokasi" className="inline-flex items-center justify-center gap-2 bg-blue-700 text-white font-semibold px-7 py-3.5 rounded-full hover:bg-blue-800 hover:shadow-lg transition-all">
                Temukan Lokasi Kami <ArrowRight size={18} />
              </Link>
              <Link to="/service" className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-medium px-7 py-3.5 rounded-full hover:bg-gray-50 transition-all">
                Lihat Jadwal Ibadah
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
