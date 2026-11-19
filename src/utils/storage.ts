import { DEFAULT_DB, DEFAULT_MISSIONS, STORAGE_KEY } from '../data/gameData';
import { AIGuideResult, DatabaseState, UserAccount } from '../types/game';

export function getDB(): DatabaseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DB));
      return JSON.parse(JSON.stringify(DEFAULT_DB)) as DatabaseState;
    }
    const parsed = JSON.parse(raw) as DatabaseState;
    // Ensure missions preserve 3D coordinates if upgraded from older storage
    if (!parsed.missions || parsed.missions.length !== DEFAULT_MISSIONS.length || !parsed.missions[0]?.position) {
      parsed.missions = JSON.parse(JSON.stringify(DEFAULT_MISSIONS));
    }
    // Ensure 6 Cemerlang class exists
    if (!parsed.classes.some((c) => c.name === '6 Cemerlang')) {
      parsed.classes.push({
        id: 'c3',
        name: '6 Cemerlang',
        code: '6CEMERLANG',
        teacherUsername: 'cikgu_amina',
      });
    }
    const teacher = parsed.users.find((u) => u.id === 'tch1');
    if (teacher && teacher.classes && !teacher.classes.includes('6 Cemerlang')) {
      teacher.classes.push('6 Cemerlang');
    }
    // Upgrade legacy default M001/M002 names if unchanged, and seed any missing preloaded students BM6-001..BM6-005
    let mutated = false;
    const m1User = parsed.users.find((u) => u.id === 'M001');
    if (m1User && m1User.fullName === 'Ali bin Hassan') {
      m1User.fullName = 'Muhammad Danish Hakim bin Azman';
      m1User.username = 'bm6-001';
      mutated = true;
    }
    const m2User = parsed.users.find((u) => u.id === 'M002');
    if (m2User && m2User.fullName === 'Siti Nurhaliza binti Kamal') {
      m2User.fullName = 'Nur Aisyah Sofea binti Ahmad';
      m2User.username = 'bm6-002';
      mutated = true;
    }
    const defaultStudents = DEFAULT_DB.users.filter((u) => u.role === 'murid');
    for (const defStu of defaultStudents) {
      const exists = parsed.users.some(
        (u) =>
          u.role === 'murid' &&
          (u.studentId || '').toUpperCase() === (defStu.studentId || '').toUpperCase()
      );
      if (!exists) {
        parsed.users.push(JSON.parse(JSON.stringify(defStu)) as UserAccount);
        mutated = true;
      }
    }
    const m2Mission = parsed.missions?.find((m) => m.id === 2);
    if (
      m2Mission &&
      (m2Mission.title === 'Bandar Udara Beracun' || m2Mission.shortTitle === 'Bandar Beracun')
    ) {
      m2Mission.title = 'Operasi Jejak Punca dan Kesan';
      m2Mission.shortTitle = 'Operasi Jejak Punca dan Kesan';
      mutated = true;
    }
    if (mutated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB)) as DatabaseState;
  }
}

export function saveDB(db: DatabaseState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  if (db.apiEndpoint) {
    fetch(db.apiEndpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'syncDB', payload: db }),
    }).catch(() => {});
  }
}

export function resetDemoDB(): DatabaseState {
  const fresh = JSON.parse(JSON.stringify(DEFAULT_DB)) as DatabaseState;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function addLog(db: DatabaseState, actor: string, action: string): void {
  const time = new Date().toLocaleTimeString('ms-MY', {
    hour: '2-digit',
    minute: '2-digit',
  });
  db.logs.unshift({ time, actor, action });
  if (db.logs.length > 30) db.logs.pop();
}

export function calcLevel(xp = 0): number {
  return Math.floor(xp / 200) + 1;
}

export function calcOverallScore(student: UserAccount): number {
  const p = student.progress;
  if (!p) return 0;
  const sc = [p.m1.score, p.m2.score, p.m3.score, p.m4.score, p.m5.rubricScore].filter((x) => x > 0);
  return sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : 0;
}

export function getMasteryLevel(score: number): { label: string; tone: 'emerald' | 'sky' | 'rose' | 'amber' } {
  if (score >= 80) return { label: 'Cemerlang (TP 5-6)', tone: 'emerald' };
  if (score >= 60) return { label: 'Memuaskan (TP 3-4)', tone: 'sky' };
  if (score > 0) return { label: 'Perlu Bimbingan (TP 1-2)', tone: 'rose' };
  return { label: 'Belum Dinilai', tone: 'amber' };
}

export function computeAIGuide(student: UserAccount): AIGuideResult {
  const p = student.progress;
  if (!p) {
    return {
      levelMode: 'Biasa',
      nextStep: 'Mulakan penerokaan di EcoWorld 3D.',
      recommendations: [],
      needsIntervention: false,
    };
  }
  const recs: string[] = [];
  let mode = 'Biasa';
  let nextStep = 'Teruskan penerokaan zon misi di Pulau EcoWorld 3D.';

  if (!p.m1.completed) {
    nextStep = 'Tuju ke Zon 1: Sungai Tercemar dan klik 3 bukti pencemaran 3D di tebing sungai.';
    recs.push('Dengar laporan Puan Aminah untuk membezakan fakta tersurat dan tersirat.');
  } else {
    if (p.m1.tersiratScore < 70) {
      mode = 'Pengukuhan (Mendengar & Tersirat)';
      recs.push(
        `Markah tersirat rendah (${p.m1.tersiratScore}%). Latihan Pengukuhan: Fokus pada sebab tersembunyi di sebalik pembuangan sisa waktu malam.`
      );
    } else {
      recs.push(`Penguasaan maklumat tersirat cemerlang (${p.m1.tersiratScore}%).`);
    }

    if (p.m2.completed && p.m2.kbatScore < 70) {
      mode = 'Pengukuhan (Analisis KBAT)';
      recs.push('Gunakan penanda sebab-akibat semasa menerangkan kesan jangka panjang.');
    } else if (p.m3.completed && calcOverallScore(student) >= 80) {
      mode = 'Pengayaan (Cabaran KBAT Tinggi)';
      recs.push(
        'Cabaran Pengayaan: Bandingkan kesan jangka pendek & panjang dalam hujah anda di Makmal Suara.'
      );
    }

    if (p.m1.completed && !p.m2.completed) {
      nextStep = 'Seterusnya: Teroka Zon 2 Bandar Udara Beracun untuk analisis punca & kesan.';
    } else if (p.m2.completed && !p.m3.completed) {
      nextStep = 'Seterusnya: Pergi ke Zon 3 Hutan Harapan dan nilai cadangan penyelesaian.';
    } else if (p.m3.completed && !p.m4.completed) {
      nextStep = 'Seterusnya: Masuk Makmal Suara (Zon 4) dan rakam hujah kritis anda.';
    } else if (p.m4.completed && !p.m5.submitted) {
      nextStep = 'Seterusnya: Lancarkan Kempen Digital Selamatkan EcoWorld di Monumen Pusat (Zon 5).';
    } else if (p.m5.submitted) {
      nextStep = 'Tahniah! Layari Dewan Wira untuk mencetak sijil pengiktirafan anda.';
    }
  }

  return {
    levelMode: mode,
    nextStep,
    recommendations: recs,
    needsIntervention:
      (p.m1.completed && p.m1.score < 60) ||
      (calcOverallScore(student) > 0 && calcOverallScore(student) < 60),
  };
}

export function evaluateBadges(student: UserAccount): void {
  const p = student.progress;
  if (!p) return;
  const earned = new Set<string>(student.badges || []);
  if (p.m1.completed && p.m1.score >= 70 && p.m2.completed && p.m2.score >= 70) {
    earned.add('eco_explorer');
  }
  if (p.m1.completed && p.m1.score >= 80) {
    earned.add('listening_detective');
  }
  if (p.m2.completed && p.m2.score >= 75 && p.m3.completed && p.m3.score >= 75) {
    earned.add('critical_thinker');
  }
  if (p.m4.completed && p.m4.score >= 70) {
    earned.add('brilliant_speaker');
  }
  if (p.m5.submitted && calcOverallScore(student) >= 70) {
    earned.add('eco_hero');
  }
  student.badges = Array.from(earned);
}
