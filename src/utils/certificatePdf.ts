import { jsPDF } from 'jspdf';
import { AVATARS, BADGES_DEF } from '../data/gameData';
import { UserAccount } from '../types/game';
import { calcLevel, calcOverallScore } from './storage';

export function downloadCertificatePdf(user: UserAccount): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const W = doc.internal.pageSize.getWidth(); // 297
  const H = doc.internal.pageSize.getHeight(); // 210
  const xp = user.xp || 0;
  const lvl = calcLevel(xp);
  const overall = calcOverallScore(user);
  const avatar = AVATARS.find((a) => a.id === user.avatar) || AVATARS[0];
  const p = user.progress;

  // Soft cream-ivory certificate background
  doc.setFillColor(254, 252, 232);
  doc.rect(0, 0, W, H, 'F');

  // Outer dark emerald border
  doc.setDrawColor(6, 95, 70);
  doc.setLineWidth(4);
  doc.rect(8, 8, W - 16, H - 16);

  // Inner metallic gold border
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(1.4);
  doc.rect(13, 13, W - 26, H - 26);

  // Top emerald header banner
  doc.setFillColor(6, 78, 59);
  doc.rect(18, 18, W - 36, 26, 'F');

  doc.setTextColor(250, 204, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SIJIL PENGIKTIRAFAN KAWALAN MISI ECOWORLD', W / 2, 30, { align: 'center' });

  doc.setTextColor(167, 243, 208);
  doc.setFontSize(10.5);
  doc.text(
    'SUARA GENERASI PRIHATIN · BAHASA MELAYU TAHUN 6 (SK 1.2 / SP 1.2.2)',
    W / 2,
    38,
    { align: 'center' }
  );

  // Tahniah greeting
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(14);
  doc.text('TAHNIAH & SYABAS!', W / 2, 56, { align: 'center' });

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Dengan ini diperakui bahawa', W / 2, 63, { align: 'center' });

  // Student Full Name
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(user.fullName.toUpperCase(), W / 2, 75, { align: 'center' });

  // Underline
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.8);
  doc.line(65, 78.5, W - 65, 78.5);

  // Student Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(4, 120, 87);
  doc.text(
    `ID Murid: ${user.studentId || '-'}   |   Kelas: ${user.className || '-'}   |   Watak: ${avatar.name}`,
    W / 2,
    86.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    'telah berjaya melaksanakan misi penyiasatan alam sekitar 3D, analisis punca-kesan serta pembinaan hujah kritis.',
    W / 2,
    94.5,
    { align: 'center' }
  );

  // 4 Summary Metric Boxes
  const boxY = 103;
  const boxW = 54;
  const boxH = 24;
  const startX = 28;
  const gap = 8;

  const metrics = [
    { label: 'JUMLAH XP', value: `${xp} XP` },
    { label: 'TAHAP EJEN', value: `Tahap ${lvl}` },
    { label: 'PURATA SKOR', value: `${overall}%` },
    { label: 'STATUS PROJEK', value: p?.m5.submitted ? 'LENGKAP' : 'AKTIF' },
  ];

  metrics.forEach((m, idx) => {
    const x = startX + idx * (boxW + gap);
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(x, boxY, boxW, boxH, 3, 3, 'F');
    doc.setDrawColor(250, 204, 21);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, boxY, boxW, boxH, 3, 3, 'S');

    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(m.label, x + boxW / 2, boxY + 8, { align: 'center' });

    doc.setTextColor(250, 204, 21);
    doc.setFontSize(14);
    doc.text(m.value, x + boxW / 2, boxY + 18, { align: 'center' });
  });

  // Mission Breakdown Table
  const rows = [
    `Misi 1 (Zon Sungai Tercemar): ${p?.m1.completed ? `${p.m1.score}%` : 'Belum selesai'}`,
    `Misi 2 (Bandar Udara Beracun): ${p?.m2.completed ? `${p.m2.score}%` : 'Belum selesai'}`,
    `Misi 3 (Hutan Harapan): ${p?.m3.completed ? `${p.m3.score}%` : 'Belum selesai'}`,
    `Misi 4 (Makmal Suara): ${p?.m4.completed ? `${p.m4.score}%` : 'Belum selesai'}`,
    `Misi 5 (Operasi Selamatkan EcoWorld): ${p?.m5.submitted ? `${p.m5.rubricScore}%` : 'Belum dihantar'}`,
  ];

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(28, 134, W - 56, 30, 3, 3, 'F');
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(28, 134, W - 56, 30, 3, 3, 'S');

  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('REKOD PENCAPAIAN MISI 3D:', 34, 141);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  rows.forEach((line, i) => {
    const colX = i < 3 ? 34 : 155;
    const rowY = 148 + (i % 3) * 6;
    doc.text(`• ${line}`, colX, rowY);
  });

  // Badges Earned
  const badgeNames = (user.badges || [])
    .map((id) => BADGES_DEF.find((b) => b.id === id)?.name)
    .filter(Boolean);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(146, 64, 14);
  doc.text(
    `Lencana Pencapaian: ${badgeNames.length > 0 ? badgeNames.join(' · ') : 'Dalam Pengumpulan'}`,
    W / 2,
    173,
    { align: 'center' }
  );

  // Date & Signature Footer
  const todayStr = new Date().toLocaleDateString('ms-MY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  doc.setDrawColor(100, 116, 139);
  doc.line(35, 188, 105, 188);
  doc.line(W - 105, 188, W - 35, 188);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tarikh Dikeluarkan: ${todayStr}`, 70, 193, { align: 'center' });
  doc.text('Penyelaras Kawalan Misi EcoWorld (BM Tahun 6)', W - 70, 193, { align: 'center' });

  const safeName = user.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`Sijil-EcoWorld-${safeName}.pdf`);
}
