// Single source of truth for church ministries and their schedules.
// Used by Program Ibadah, the home page and Lokasi so times never disagree.

export interface Ministry {
  id: string;
  name: string;
  label: string;
  greeting: string;
  headline: string;
  description: string;
  schedules: { day: string; time: string }[];
  location: string;
  photo: string;
  accent: string;
  instagramUrl?: string;
}

/* ─────────── DATA: ADULT ─────────── */
export const ADULT: Ministry[] = [
  {
    id: 'umum',
    name: 'Ibadah Umum',
    label: 'Ibadah utama gereja',
    greeting: 'Selamat datang!',
    headline: 'PINTU TERBUKA UNTUK SEMUA',
    description: 'Ibadah Umum terbuka untuk siapa saja — jemaat lama, tamu, maupun yang baru pertama kali datang. Ibadah diadakan setiap hari Minggu pukul 08.00.',
    schedules: [{ day: 'Minggu', time: '08.00 – 10.00' }],
    location: 'Gedung Utama Lantai 1',
    photo: 'https://images.unsplash.com/photo-1570786032462-2efc3ca8fccd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    accent: '#60a5fa',
  },
  {
    id: 'koemas',
    name: 'Koemas',
    label: 'Komunitas Senior 55+',
    greeting: 'Hi seniors!',
    headline: 'BERBAGI HIKMAT, BERTUMBUH BERSAMA',
    description: 'Koemas adalah persekutuan untuk jemaat senior usia 55 tahun ke atas. Kegiatannya santai — ibadah bersama, sharing pengalaman hidup, dan saling mendoakan.',
    schedules: [{ day: 'Sabtu Ketiga', time: '10.00 – 12.00' }],
    location: 'Ruang Serbaguna Lantai 2',
    photo: 'https://images.unsplash.com/photo-1641135309090-635897be4dd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    accent: '#fb923c',
    instagramUrl: 'https://www.instagram.com/koemasjeltim?utm_source=ig_web_button_share_sheet&xtok=ZDNlZDc0MzIxNw==',
  },
  {
    id: 'kowari',
    name: 'Kowari',
    label: 'Komunitas Wanita Mandiri',
    greeting: 'Hi ladies!',
    headline: 'SALING MENGUATKAN, SALING MENDUKUNG',
    description: 'Wanita yang kuat dibutuhkan di rumah, gereja, dan masyarakat. Kowari hadir sebagai persekutuan kaum wanita GBI Jelambar Timur di mana kamu bisa beribadah, berbagi, dan bertumbuh bersama.',
    schedules: [{ day: 'Sabtu', time: '09.00 – 11.30' }],
    location: 'Ruang Utama Lantai 1',
    photo: 'https://images.unsplash.com/photo-1607748862156-7c548e7e98f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    accent: '#e879f9',
  },
  {
    id: 'wbi',
    name: 'WBI',
    label: 'Wanita Bethel Indonesia',
    greeting: 'Hi sisters!',
    headline: 'SATU VISI, SATU BANGSA',
    description: 'WBI adalah gerakan persekutuan wanita Gereja Bethel Indonesia yang ada di seluruh Indonesia. Di GBI Jelambar Timur, WBI aktif mengadakan ibadah dan kegiatan yang menghubungkan wanita dalam misi yang lebih luas.',
    schedules: [{ day: 'Sabtu Kedua', time: '09.00 – 11.00' }],
    location: 'Ruang Serbaguna Lantai 2',
    photo: 'https://images.unsplash.com/photo-1524601500432-1e1a4c71d692?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    accent: '#f472b6',
  },
  {
    id: 'kompas',
    name: 'Kompas',
    label: 'Komunitas Pasutri',
    greeting: 'Hi couples!',
    headline: 'KELUARGA YANG KUAT DIMULAI DARI SINI',
    description: 'Kompas adalah persekutuan khusus pasangan suami-istri yang ingin membangun keluarga di atas fondasi iman. Lewat ibadah dan sharing antar pasangan, Kompas hadir menemani setiap musim dalam pernikahan.',
    schedules: [{ day: 'Sabtu Ketiga', time: '18.00' }],
    location: 'Ruang Serbaguna Lantai 2',
    photo: 'https://images.unsplash.com/photo-1645620549807-0aea79c18482?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    accent: '#34d399',
    instagramUrl: 'https://www.instagram.com/kompasjeltim?utm_source=ig_web_button_share_sheet&mdxt=ZDNlZDc0MzIxNw==',
  },
  {
    id: 'doa',
    name: 'Persekutuan Doa',
    label: 'Ibadah doa pagi',
    greeting: 'Mulai hari dengan doa.',
    headline: 'BERDOA BERSAMA, HADIRAT YANG NYATA',
    description: 'Persekutuan Doa diadakan dua pagi dalam seminggu — sederhana, tapi bermakna. Berkumpul bersama, berdoa untuk keluarga, gereja, dan bangsa, lalu memulai hari dengan lebih tenang.',
    schedules: [
      { day: 'Rabu',  time: '05.30 – 07.00' },
      { day: 'Jumat', time: '05.30 – 07.00' },
    ],
    location: 'Gedung Utama Lantai 1',
    photo: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    accent: '#2dd4bf',
  },
];

/* ─────────── DATA: NXT GEN ─────────── */
export const NXT_GEN: Ministry[] = [
  {
    id: 'vessel',
    name: 'Vessel',
    label: 'Pemuda 18–30 tahun',
    greeting: 'Hey pemuda!',
    headline: 'GENERASI YANG SIAP DIPAKAI TUHAN',
    description: 'Vessel adalah komunitas pemuda GBI Jelambar Timur untuk usia 18 sampai 30 tahun. Ibadahnya relevan, diskusinya jujur, dan suasananya jauh dari kaku. Tempat kamu bisa tumbuh dan terhubung dengan teman-teman yang satu iman.',
    schedules: [
      { day: 'Sabtu Pertama', time: '18.30' },
    ],
    location: 'Ruang Vessel Lantai 2',
    photo: 'https://images.unsplash.com/photo-1521574778337-d962ef81733d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    accent: '#818cf8',
    instagramUrl: 'https://www.instagram.com/thevesselyouthcom?utm_source=ig_web_button_share_sheet&cplk=ZDNlZDc0MzIxNw==',
  },
  {
    id: 'teens',
    name: 'Teens',
    label: 'Remaja 13–17 tahun',
    greeting: 'Hi remaja!',
    headline: 'IDENTITASMU LEBIH DARI YANG KAMU KIRA',
    description: 'Teens adalah komunitas remaja GBI Jelambar Timur untuk usia 13 sampai 17 tahun. Programnya dirancang sesuai dunia remaja — jujur, relevan, dan nggak menggurui. Ada ruang buat bertanya, berbagi, dan jadi diri sendiri.',
    schedules: [
      { day: 'Minggu', time: '12.30' },
    ],
    location: 'Ruang Teens Lantai 2',
    photo: 'https://images.unsplash.com/photo-1566135235200-616a028972c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    accent: '#a78bfa',
    instagramUrl: 'https://www.instagram.com/rbijeltim/?utm_source=ig_web_button_share_sheet',
  },
];

/* ─────────── DATA: KIDS ─────────── */
export const KIDS: Ministry[] = [
  {
    id: 'sekolah-minggu',
    name: 'Sekolah Minggu',
    label: 'Anak-anak 3–12 tahun',
    greeting: 'Hi anak-anak!',
    headline: 'MENGENAL TUHAN SEJAK KECIL',
    description: 'Sekolah Minggu adalah ibadah anak-anak GBI Jelambar Timur untuk usia 3 sampai 12 tahun. Materinya disampaikan lewat cerita Alkitab, lagu, dan aktivitas kreatif yang menyenangkan.',
    schedules: [
      { day: 'Minggu', time: '10.00' },
    ],
    location: 'Ruang Anak Lantai 2',
    photo: 'https://images.unsplash.com/photo-1713012633197-1426a345ca99?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    accent: '#facc15',
    instagramUrl: 'https://www.instagram.com/abijeltim?utm_source=ig_web_button_share_sheet&srtk=ZDNlZDc0MzIxNw==',
  },
];


export const ALL_MINISTRIES: Ministry[] = [...ADULT, ...NXT_GEN, ...KIDS];

/** "Minggu 07.00, 09.30 · Rabu 18.30" — groups times by day, without end times. */
export function formatSchedules(schedules: { day: string; time: string }[]): string {
  const byDay = new Map<string, string[]>();
  for (const sc of schedules) {
    const start = sc.time.split('–')[0].trim();
    byDay.set(sc.day, [...(byDay.get(sc.day) || []), start]);
  }
  return [...byDay.entries()].map(([day, times]) => `${day} ${times.join(', ')}`).join(' · ');
}

export const getMinistry = (id: string) => ALL_MINISTRIES.find(m => m.id === id);

/** [{ day: 'Minggu', times: ['07.00', '09.30'] }, ...] — start times grouped by day, in order of appearance. */
export function groupSchedules(schedules: { day: string; time: string }[]): { day: string; times: string[] }[] {
  const byDay = new Map<string, string[]>();
  for (const sc of schedules) byDay.set(sc.day, [...(byDay.get(sc.day) || []), sc.time.split('–')[0].trim()]);
  return [...byDay.entries()].map(([day, times]) => ({ day, times }));
}
