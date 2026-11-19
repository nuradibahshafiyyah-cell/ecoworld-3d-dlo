import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT) || 3000 : 3000;

// Persistent local filesystem storage for Mission 5 student recordings & teacher reviews
const DATA_DIR = path.resolve(__dirname, 'data');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const MEDIA_SIGNING_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`ecoworld3d:${__dirname}`).digest('hex');

interface StoredSubmission {
  id: string;
  studentUserId: string;
  studentName: string;
  studentId: string;
  className: string;
  missionId: number;
  mediaType: 'audio' | 'video';
  mimeType: string;
  fileName: string;
  fileSize: number;
  campaignTitle: string;
  status: 'BERJAYA';
  submittedAt: string;
  teacherComment: string;
  teacherScore: number | null;
  teacherGrade: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

async function ensureStorageReady(): Promise<void> {
  await fsp.mkdir(RECORDINGS_DIR, { recursive: true });
}

async function readSubmissions(): Promise<StoredSubmission[]> {
  await ensureStorageReady();
  try {
    const raw = await fsp.readFile(SUBMISSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSubmission[]) : [];
  } catch {
    return [];
  }
}

async function writeSubmissions(list: StoredSubmission[]): Promise<void> {
  await ensureStorageReady();
  const tmpFile = `${SUBMISSIONS_FILE}.tmp`;
  await fsp.writeFile(tmpFile, JSON.stringify(list, null, 2), 'utf8');
  await fsp.rename(tmpFile, SUBMISSIONS_FILE);
}

function getAuthContext(req: express.Request): {
  role: 'admin' | 'guru' | 'murid' | null;
  userId: string;
} {
  const roleRaw = String(req.header('x-ecoworld-role') || '').trim().toLowerCase();
  const userId = String(req.header('x-ecoworld-user-id') || '').trim();
  if (roleRaw === 'admin' || roleRaw === 'guru' || roleRaw === 'murid') {
    return { role: roleRaw, userId };
  }
  return { role: null, userId: '' };
}

function signMediaToken(submissionId: string, viewerScope: string): string {
  const exp = Date.now() + 12 * 60 * 60 * 1000; // 12h valid session playback token
  const payload = `${submissionId}:${viewerScope}:${exp}`;
  const sig = crypto
    .createHmac('sha256', MEDIA_SIGNING_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyMediaToken(token: string, submissionId: string, ownerUserId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return false;
    const [subId, scope, expStr, sig] = parts;
    if (subId !== submissionId) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    if (scope !== 'staff' && scope !== ownerUserId) return false;
    const expectedSig = crypto
      .createHmac('sha256', MEDIA_SIGNING_SECRET)
      .update(`${subId}:${scope}:${expStr}`)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

function inferExtension(mimeType: string, mediaType: 'audio' | 'video'): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4')) return mediaType === 'video' ? 'mp4' : 'm4a';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  return 'webm';
}

// Cache synthesized female TTS WAV buffers in memory to eliminate latency on replay
const ttsCache = new Map<string, string>();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const STRICT_MALAYSIAN_MS_MY_STYLE =
  'Language: Standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia, locale ms-MY, Kuala Lumpur / RTM broadcast accent). NEVER use an Indonesian (id-ID / Jakarta) accent, cadence, or pronunciation. Use clear, natural, warm, friendly, and cheerful Malaysian intonation suitable for Year 6 Malaysian primary school pupils.';

app.post('/api/tts', async (req, res) => {
  try {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const requestedStyle =
      typeof req.body?.style === 'string' && req.body.style.trim() ? req.body.style.trim() : '';
    const style = requestedStyle
      ? `${STRICT_MALAYSIAN_MS_MY_STYLE} Context: ${requestedStyle}`
      : `${STRICT_MALAYSIAN_MS_MY_STYLE} Context: Puan Aminah, a warm, gentle, clear Malaysian woman speaking at a calm pace for primary school pupils.`;

    if (!rawText) {
      return res.status(400).json({ error: 'Teks diperlukan untuk penjanaan suara Bahasa Melayu.', code: 'BAD_REQUEST' });
    }

    const cacheKey = `${style}::${rawText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      return res.json({ audioBase64: cached, mimeType: 'audio/wav', voiceName: 'Kore', provider: 'gemini-ai' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY belum ditetapkan dalam Settings > Secrets.',
        code: 'NO_API_KEY',
      });
    }

    const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] as const;
    let base64Audio: string | undefined;
    let mimeType = 'audio/wav';
    let lastError: unknown = null;

    for (const modelName of ttsModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: rawText,
                  speechMetadata: {
                    style,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((p) => Boolean(p?.inlineData?.data));
        if (audioPart?.inlineData?.data) {
          base64Audio = audioPart.inlineData.data;
          mimeType = audioPart.inlineData.mimeType || 'audio/wav';
          break;
        }
      } catch (modelErr) {
        lastError = modelErr;
      }
    }

    if (!base64Audio) {
      console.error('Gemini TTS failed across models:', lastError);
      return res.status(502).json({
        error: 'Audio AI Bahasa Melayu gagal dijana buat sementara.',
        code: 'TTS_FAILED',
      });
    }

    ttsCache.set(cacheKey, base64Audio);
    return res.json({ audioBase64: base64Audio, mimeType, voiceName: 'Kore', provider: 'gemini-ai' });
  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: 'Gagal menjana audio suara Bahasa Melayu Malaysia.', code: 'SERVER_ERROR' });
  }
});

// ============================================================================
// MISSION 5 RECORDING SUBMISSIONS & TEACHER EVALUATION API
// ============================================================================

app.get('/api/submissions', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth.role || !auth.userId) {
      return res.status(403).json({ error: 'Akses ditolak. Sila log masuk terlebih dahulu.' });
    }

    const list = await readSubmissions();
    const filtered =
      auth.role === 'guru' || auth.role === 'admin'
        ? list
        : list.filter((item) => item.studentUserId === auth.userId);

    const viewerScope = auth.role === 'guru' || auth.role === 'admin' ? 'staff' : auth.userId;
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    return res.json({
      submissions: sorted.map((item) => ({
        ...item,
        mediaUrl: `/api/submissions/${encodeURIComponent(item.id)}/media?token=${encodeURIComponent(
          signMediaToken(item.id, viewerScope)
        )}`,
      })),
    });
  } catch (err) {
    console.error('GET /api/submissions failed:', err);
    return res.status(500).json({ error: 'Gagal memuatkan rekod rakaman.' });
  }
});

app.post(
  '/api/submissions',
  express.raw({
    type: ['audio/*', 'video/*', 'application/octet-stream'],
    limit: '35mb',
  }),
  async (req, res) => {
    try {
      const auth = getAuthContext(req);
      if (auth.role !== 'murid' || !auth.userId) {
        return res.status(403).json({ error: 'Hanya murid yang log masuk dibenarkan menghantar rakaman.' });
      }

      const rawMeta = req.header('x-submission-meta');
      if (!rawMeta) {
        return res.status(400).json({ error: 'Maklumat penghantaran tidak lengkap.' });
      }

      const meta = JSON.parse(decodeURIComponent(rawMeta)) as {
        studentUserId?: string;
        studentName?: string;
        studentId?: string;
        className?: string;
        mediaType?: 'audio' | 'video';
        campaignTitle?: string;
      };

      if (meta.studentUserId !== auth.userId) {
        return res.status(403).json({ error: 'Akses murid tidak sepadan.' });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Fail rakaman kosong atau tidak sah.' });
      }

      const mediaType: 'audio' | 'video' = meta.mediaType === 'video' ? 'video' : 'audio';
      const contentTypeHeader = String(req.header('content-type') || '').split(';')[0].trim();
      const mimeType =
        contentTypeHeader && (contentTypeHeader.startsWith('audio/') || contentTypeHeader.startsWith('video/'))
          ? contentTypeHeader
          : mediaType === 'video'
          ? 'video/webm'
          : 'audio/webm';

      await ensureStorageReady();
      const id = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const ext = inferExtension(mimeType, mediaType);
      const fileName = `${id}.${ext}`;
      const filePath = path.join(RECORDINGS_DIR, fileName);

      await fsp.writeFile(filePath, req.body);

      const record: StoredSubmission = {
        id,
        studentUserId: auth.userId,
        studentName: String(meta.studentName || 'Murid EcoWorld').trim(),
        studentId: String(meta.studentId || '').trim().toUpperCase(),
        className: String(meta.className || '6 Bestari').trim(),
        missionId: 5,
        mediaType,
        mimeType,
        fileName,
        fileSize: req.body.length,
        campaignTitle: String(meta.campaignTitle || 'Kempen Selamatkan EcoWorld').trim(),
        status: 'BERJAYA',
        submittedAt: new Date().toISOString(),
        teacherComment: '',
        teacherScore: null,
        teacherGrade: '',
        reviewedAt: null,
        reviewedBy: null,
      };

      const existing = await readSubmissions();
      existing.push(record);
      await writeSubmissions(existing);

      return res.status(201).json({
        submission: {
          ...record,
          mediaUrl: `/api/submissions/${encodeURIComponent(record.id)}/media?token=${encodeURIComponent(
            signMediaToken(record.id, auth.userId)
          )}`,
        },
      });
    } catch (err) {
      console.error('POST /api/submissions failed:', err);
      return res.status(500).json({ error: 'Gagal menyimpan fail rakaman ke pelayan.' });
    }
  }
);

app.get('/api/submissions/:id/media', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const list = await readSubmissions();
    const item = list.find((s) => s.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Fail rakaman tidak ditemui.' });
    }

    const auth = getAuthContext(req);
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const allowedByHeader =
      auth.role === 'guru' ||
      auth.role === 'admin' ||
      (auth.role === 'murid' && auth.userId === item.studentUserId);
    const allowedByToken = token ? verifyMediaToken(token, item.id, item.studentUserId) : false;

    if (!allowedByHeader && !allowedByToken) {
      return res.status(403).json({ error: 'Akses kepada rakaman murid ini adalah terhad.' });
    }

    const safeName = path.basename(item.fileName);
    const filePath = path.join(RECORDINGS_DIR, safeName);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return res.status(404).json({ error: 'Fail media tiada dalam storan.' });
    }

    const total = stat.size;
    const range = req.headers.range;
    res.setHeader('Content-Type', item.mimeType || (item.mediaType === 'video' ? 'video/webm' : 'audio/webm'));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
        if (start >= total || start > end) {
          return res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', total);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('GET /api/submissions/:id/media failed:', err);
    return res.status(500).json({ error: 'Gagal memainkan fail rakaman.' });
  }
});

app.patch('/api/submissions/:id/review', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (auth.role !== 'guru' && auth.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya guru atau pentadbir dibenarkan memberi penilaian.' });
    }

    const id = String(req.params.id || '').trim();
    const list = await readSubmissions();
    const target = list.find((s) => s.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Rekod rakaman tidak ditemui.' });
    }

    const comment =
      typeof req.body?.teacherComment === 'string' ? req.body.teacherComment.trim() : target.teacherComment;
    const rawScore = req.body?.teacherScore;
    const parsedScore =
      rawScore === null || rawScore === '' || rawScore === undefined
        ? null
        : Math.max(0, Math.min(100, Math.round(Number(rawScore))));
    const grade =
      typeof req.body?.teacherGrade === 'string' ? req.body.teacherGrade.trim() : target.teacherGrade;
    const reviewer =
      typeof req.body?.reviewedBy === 'string' && req.body.reviewedBy.trim()
        ? req.body.reviewedBy.trim()
        : 'Guru EcoWorld';

    target.teacherComment = comment;
    target.teacherScore = Number.isNaN(parsedScore as number) ? null : parsedScore;
    target.teacherGrade = grade;
    target.reviewedAt = new Date().toISOString();
    target.reviewedBy = reviewer;

    await writeSubmissions(list);

    return res.json({
      submission: {
        ...target,
        mediaUrl: `/api/submissions/${encodeURIComponent(target.id)}/media?token=${encodeURIComponent(
          signMediaToken(target.id, 'staff')
        )}`,
      },
    });
  } catch (err) {
    console.error('PATCH /api/submissions/:id/review failed:', err);
    return res.status(500).json({ error: 'Gagal menyimpan penilaian guru.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EcoWorld server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

