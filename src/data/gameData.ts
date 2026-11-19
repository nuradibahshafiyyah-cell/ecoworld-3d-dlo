import {
  AvatarDef,
  BadgeDef,
  Clue3D,
  DatabaseState,
  MissionDef,
  StudentProgress,
  UserAccount,
} from '../types/game';

export const STORAGE_KEY = 'ecoworld3d_db_v1';

export const AVATARS: AvatarDef[] = [
  {
    id: 'rimba',
    name: 'Ejen Rimba',
    emoji: '🌿',
    primaryColor: '#16a34a',
    accentColor: '#4ade80',
    tagline: 'Penjaga Hutan & Ekosistem Hijau',
    roleTitle: 'Pakar Flora & Pemulihan',
    personality: 'Tenang, teliti dan penyayang alam',
    greeting:
      'Salam sejahtera! Saya Ejen Rimba. Mari kita siasat punca pencemaran dan pulihkan kehijauan Pulau EcoWorld bersama-sama!',
    suitLabel: 'Sut Perisai Rimba Hijau',
    symbolLabel: 'Daun Kehidupan',
  },
  {
    id: 'tirta',
    name: 'Ejen Tirta',
    emoji: '💧',
    primaryColor: '#0284c7',
    accentColor: '#38bdf8',
    tagline: 'Penyiasat Sungai & Sumber Air',
    roleTitle: 'Pakar Hidrologi & Bukti',
    personality: 'Pantas, cekap dan peka bukti',
    greeting:
      'Hai rakan misi! Saya Ejen Tirta. Dengar laporan dengan teliti dan kumpulkan semua bukti pencemaran air di tebing sungai!',
    suitLabel: 'Sut Hidrotek Biru Laut',
    symbolLabel: 'Titisan Kristal',
  },
  {
    id: 'bayu',
    name: 'Ejen Bayu',
    emoji: '🌪️',
    primaryColor: '#0d9488',
    accentColor: '#22d3ee',
    tagline: 'Penganalisis Udara & Iklim',
    roleTitle: 'Pakar Kualiti Udara',
    personality: 'Analitikal, tajam fikiran dan bersemangat',
    greeting:
      'Helo! Saya Ejen Bayu. Jom analisis punca jerebu dan kesan jangka panjang supaya langit EcoWorld kembali biru!',
    suitLabel: 'Sut Aerodinamik Turkois',
    symbolLabel: 'Pusaran Angin',
  },
  {
    id: 'suara',
    name: 'Ejen Suara',
    emoji: '🎙️',
    primaryColor: '#7c3aed',
    accentColor: '#c084fc',
    tagline: 'Pemidato Kritis & Kempen Digital',
    roleTitle: 'Pakar Komunikasi & Hujah',
    personality: 'Yakin, petah berbicara dan kreatif',
    greeting:
      'Selamat datang! Saya Ejen Suara. Susun hujah kritis anda dengan sebutan baku dan intonasi yang meyakinkan masyarakat!',
    suitLabel: 'Sut Studio Ungu Futuristik',
    symbolLabel: 'Gelombang Suara',
  },
];

export const BADGES_DEF: BadgeDef[] = [
  {
    id: 'eco_explorer',
    name: 'Peneroka EcoWorld',
    icon: '🧭',
    desc: 'Menyelesaikan Misi 1 dan Misi 2 dengan skor sekurang-kurangnya 70%.',
  },
  {
    id: 'listening_detective',
    name: 'Detektif Pendengar Kritis',
    icon: '🎧',
    desc: 'Menguasai maklumat tersurat dan tersirat dalam Misi 1 (80%+).',
  },
  {
    id: 'critical_thinker',
    name: 'Pemikir Kritis KBAT',
    icon: '🧠',
    desc: 'Menganalisis punca-kesan serta menilai cadangan terbaik dalam Misi 2 & 3 (75%+).',
  },
  {
    id: 'brilliant_speaker',
    name: 'Pemidato Generasi Prihatin',
    icon: '🎙️',
    desc: 'Membina hujah kritis berstruktur dan berlatih bertutur dalam Misi 4 (70%+).',
  },
  {
    id: 'eco_hero',
    name: 'Wira Penyelamat EcoWorld',
    icon: '🏆',
    desc: 'Melancarkan Kempen Digital Misi 5 dengan purata pencapaian keseluruhan 70%+.',
  },
];

export const M1_CLUES_3D: Clue3D[] = [
  {
    id: 'paip',
    title: 'Paip Sisa Kimia',
    description:
      'Paip saliran kilang tekstil mengalirkan cecair berwarna hitam pekat terus ke dalam sungai pada waktu malam.',
    position: [-16.6, 1.1, 8.6],
  },
  {
    id: 'ikan',
    title: 'Ikan Mati Terapung',
    description:
      'Puluhan ikan sungai ditemui mati terapung di permukaan air akibat kekurangan oksigen dan keracunan kimia.',
    position: [-12.2, 0.55, 13.5],
  },
  {
    id: 'bau',
    title: 'Tong Sisa Berbau Busuk',
    description:
      'Tong bahan kimia tanpa label ditinggalkan di tepi tebing sungai dan mengeluarkan bau busuk yang menyengat.',
    position: [-16.8, 1.1, 14.2],
  },
];

export const M1_SCRIPT =
  'Selamat pagi pegawai penyiasat. Saya Puan Aminah, wakil penduduk Kampung Sungai Jernih. Sejak seminggu lalu, air sungai kami yang dahulunya jernih kini bertukar menjadi hitam pekat dan berbau sangat busuk seperti bahan kimia. Banyak ikan sungai telah mati terapung di permukaan air. Kami perasan lori tangki dan kilang berhampiran hanya melepaskan sisa buangan melalui paip rahsia selepas waktu tengah malam ketika semua penduduk sedang nyenyak tidur agar perbuatan mereka tidak dikesan pihak berkuasa.';

export const M2_AUDIO_SCRIPT =
  'Laporan Ejen Bayu dari Bandar Udara Beracun. Indeks pencemaran udara meningkat mendadak akibat tiga punca utama. Pertama, cerobong kilang yang melepaskan asap hitam tebal tanpa penapis. Kedua, pelepasan gas sulfur dioksida daripada aktiviti perindustrian yang bertindak balas dengan wap air lalu menghasilkan hujan asid yang melayukan pokok. Ketiga, asap kenderaan sesak serta pembakaran sampah secara terbuka setiap petang membentuk lapisan jerebu tebal yang mencetuskan masalah pernafasan dan serangan asma dalam kalangan penduduk, terutamanya kanak-kanak.';

export const M2_SCENES: { icon: string; title: string; text: string }[] = [
  {
    icon: '🏭',
    title: 'Babak 1: Cerobong Kilang Tanpa Penapis',
    text: 'Cerobong kilang melepaskan asap hitam berjelaga dan zarah karbon secara berterusan sehingga mencemarkan ruang udara bandar.',
  },
  {
    icon: '🚗',
    title: 'Babak 2: Asap Kenderaan & Jerebu Harian',
    text: 'Kesesakan lalu lintas dan pembakaran sampah terbuka menebalkan lapisan jerebu yang menyebabkan penduduk mengalami batuk dan serangan asma.',
  },
  {
    icon: '🌧️',
    title: 'Babak 3: Gas Sulfur Dioksida & Hujan Asid',
    text: 'Gas sulfur dioksida daripada kilang membentuk hujan asid yang melayukan daun, merosakkan hutan dan menjejaskan ekosistem.',
  },
];

export const M3_OPTS: { id: string; t: string; p: string; c: string }[] = [
  {
    id: 'o1',
    t: 'Pilihan A: Tutup Semua Kilang Serta-Merta',
    p: 'Udara kembali bersih dengan sangat cepat tanpa asap kilang.',
    c: 'Ramai pekerja dan ibu bapa kehilangan punca pendapatan serta ekonomi bandar terjejas.',
  },
  {
    id: 'o2',
    t: 'Pilihan B: Wajibkan Penapis Asap + Tanam Semula Hutan & Pengangkutan Hijau',
    p: 'Memulihkan kualiti udara dan sungai sambil mengekalkan pekerjaan penduduk.',
    c: 'Memerlukan kerjasama penguatkuasaan kilang, kos pemasangan penapis dan disiplin masyarakat.',
  },
  {
    id: 'o3',
    t: 'Pilihan C: Edar Topeng Muka Percuma Sahaja',
    p: 'Mudah dilaksanakan dengan segera untuk melindungi hidung dan mulut buat sementara.',
    c: 'Tidak menghapuskan punca pencemaran; jerebu dan hujan asid masih merosakkan alam.',
  },
];

export const M4_SAMPLE_SPEECH =
  'Salam sejahtera rakan-rakan. Saya berpendirian tegas bahawa pencemaran sungai dan udara di EcoWorld mesti dihentikan segera. Buktinya, laporan Puan Aminah menunjukkan sisa kimia dibuang secara senyap selepas tengah malam, manakala asap kilang tanpa penapis mencetuskan hujan asid dan penyakit asma. Oleh itu, cadangan kreatif saya ialah kita mewajibkan pemasangan penapis asap pintar berteknologi sensor serta menanam pokok penapis udara di sekitar kawasan sekolah. Tegasnya, marilah kita bersatu bertindak sebagai generasi prihatin demi menyelamatkan bumi kita!';

export const PBL_STEPS: string[] = [
  '1. Kumpul bukti Misi 1',
  '2. Analisis punca & kesan Misi 2',
  '3. Pilih penyelesaian Misi 3',
  '4. Bina skrip hujah Misi 4',
  '5. Pilih tema kempen',
  '6. Rakam audio / video',
  '7. Semak rubrik kendiri',
  '8. Tulis refleksi akhir',
  '9. Lancar & hantar kempen',
];

export const DSKP_CURRICULUM = {
  skCode: '1.2',
  skTitle: 'Bertutur untuk menyampaikan maklumat dan idea bagi pelbagai tujuan.',
  spCode: '1.2.2',
  spTitle:
    'Bertutur untuk menghujahkan sesuatu perkara menggunakan idea yang kritis dan kreatif berdasarkan maklumat yang tersurat dan tersirat.',
  objectives: [
    { id: 1, title: 'Mengenal pasti maklumat penting daripada bahan yang didengar.' },
    { id: 2, title: 'Menganalisis punca dan kesan isu alam sekitar.' },
    { id: 3, title: 'Menilai cadangan penyelesaian.' },
    { id: 4, title: 'Menyampaikan pandangan dengan sebutan, intonasi dan gaya yang sesuai.' },
  ],
};

export const DEFAULT_MISSIONS: MissionDef[] = [
  {
    id: 1,
    title: 'Zon Sungai Tercemar',
    shortTitle: 'Sungai Tercemar',
    focus: 'Mendengar & Mengenal Pasti Maklumat Tersurat/Tersirat',
    icon: '🌊',
    maxXp: 200,
    active: true,
    color: '#38bdf8',
    position: [-15, 0, 10],
  },
  {
    id: 2,
    title: 'Operasi Jejak Punca dan Kesan',
    shortTitle: 'Operasi Jejak Punca dan Kesan',
    focus: 'Menganalisis Punca & Kesan Pencemaran Udara',
    icon: '🏭',
    maxXp: 200,
    active: true,
    color: '#fb923c',
    position: [-14, 0, -12],
  },
  {
    id: 3,
    title: 'Hutan Harapan',
    shortTitle: 'Hutan Harapan',
    focus: 'Menilai Cadangan Penyelesaian Secara Kritis',
    icon: '🌲',
    maxXp: 200,
    active: true,
    color: '#34d399',
    position: [13, 0, -12],
  },
  {
    id: 4,
    title: 'Makmal Suara',
    shortTitle: 'Makmal Suara',
    focus: 'Menyampaikan Hujah Kritis & Kreatif (SP 1.2.2)',
    icon: '🎙️',
    maxXp: 200,
    active: true,
    color: '#a78bfa',
    position: [15, 0, 10],
  },
  {
    id: 5,
    title: 'Operasi Selamatkan EcoWorld',
    shortTitle: 'Kempen EcoWorld',
    focus: 'Projek Kempen Digital Audio / Video PBL',
    icon: '🌍',
    maxXp: 250,
    active: true,
    color: '#facc15',
    position: [0, 0, 0],
  },
];

function createEmptyProgress(): StudentProgress {
  return {
    m1: { completed: false, score: 0, tersuratScore: 0, tersiratScore: 0, evidence: [] },
    m2: { completed: false, score: 0, kbatScore: 0, thinkingMap: null, kbatAnswer: '' },
    m3: { completed: false, score: 0, chosenOption: '', justification: '' },
    m4: { completed: false, score: 0, argument: null, hasRecording: false },
    m5: { completed: false, submitted: false, link: '', title: '', stepsDone: [], rubricScore: 0, reflection: '' },
  };
}

const DEFAULT_STUDENTS: UserAccount[] = [
  {
    id: 'M001',
    role: 'murid',
    username: 'bm6-001',
    password: '',
    fullName: 'Muhammad Danish Hakim bin Azman',
    studentId: 'BM6-001',
    className: '6 Bestari',
    classCode: '6BESTARI',
    avatar: 'rimba',
    xp: 0,
    unlockedMission: 1,
    progress: createEmptyProgress(),
    badges: [],
    teacherFeedback: '',
    aiApprovedByTeacher: false,
    peerFeedback: '',
  },
  {
    id: 'M002',
    role: 'murid',
    username: 'bm6-002',
    password: '',
    fullName: 'Nur Aisyah Sofea binti Ahmad',
    studentId: 'BM6-002',
    className: '6 Bestari',
    classCode: '6BESTARI',
    avatar: 'tirta',
    xp: 0,
    unlockedMission: 1,
    progress: createEmptyProgress(),
    badges: [],
    teacherFeedback: '',
    aiApprovedByTeacher: false,
    peerFeedback: '',
  },
  {
    id: 'M003',
    role: 'murid',
    username: 'bm6-003',
    password: '',
    fullName: 'Adam Harith bin Mohd Firdaus',
    studentId: 'BM6-003',
    className: '6 Bijak',
    classCode: '6BIJAK',
    avatar: 'bayu',
    xp: 0,
    unlockedMission: 1,
    progress: createEmptyProgress(),
    badges: [],
    teacherFeedback: '',
    aiApprovedByTeacher: false,
    peerFeedback: '',
  },
  {
    id: 'M004',
    role: 'murid',
    username: 'bm6-004',
    password: '',
    fullName: 'Puteri Aleesya Damia binti Roslan',
    studentId: 'BM6-004',
    className: '6 Bijak',
    classCode: '6BIJAK',
    avatar: 'suara',
    xp: 0,
    unlockedMission: 1,
    progress: createEmptyProgress(),
    badges: [],
    teacherFeedback: '',
    aiApprovedByTeacher: false,
    peerFeedback: '',
  },
  {
    id: 'M005',
    role: 'murid',
    username: 'bm6-005',
    password: '',
    fullName: 'Muhammad Rayyan Iskandar bin Zulkifli',
    studentId: 'BM6-005',
    className: '6 Cemerlang',
    classCode: '6CEMERLANG',
    avatar: 'rimba',
    xp: 0,
    unlockedMission: 1,
    progress: createEmptyProgress(),
    badges: [],
    teacherFeedback: '',
    aiApprovedByTeacher: false,
    peerFeedback: '',
  },
];

export const DEFAULT_DB: DatabaseState = {
  apiEndpoint: '',
  classes: [
    { id: 'c1', name: '6 Bestari', code: '6BESTARI', teacherUsername: 'cikgu_amina' },
    { id: 'c2', name: '6 Bijak', code: '6BIJAK', teacherUsername: 'cikgu_amina' },
    { id: 'c3', name: '6 Cemerlang', code: '6CEMERLANG', teacherUsername: 'cikgu_amina' },
  ],
  missions: DEFAULT_MISSIONS,
  users: [
    {
      id: 'adm1',
      role: 'admin',
      username: 'admin',
      password: 'admin123',
      fullName: 'Pentadbir Sistem EcoWorld',
    },
    {
      id: 'tch1',
      role: 'guru',
      username: 'cikgu_amina',
      password: 'guru123',
      fullName: 'Cikgu Amina binti Razak',
      classes: ['6 Bestari', '6 Bijak', '6 Cemerlang'],
    },
    ...DEFAULT_STUDENTS,
  ],
  logs: [
    {
      time: '08:00',
      actor: 'Sistem EcoWorld',
      action: 'Pulau EcoWorld 3D bersedia untuk penerokaan Bahasa Melayu Tahun 6.',
    },
  ],
};
