import { StudentRecordingSubmission, SubmissionMediaType, UserAccount } from '../types/game';

function buildAuthHeaders(user: UserAccount): Record<string, string> {
  return {
    'x-ecoworld-role': user.role,
    'x-ecoworld-user-id': user.id,
  };
}

export async function fetchSubmissions(user: UserAccount): Promise<StudentRecordingSubmission[]> {
  const res = await fetch('/api/submissions', {
    headers: buildAuthHeaders(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal mendapatkan senarai rakaman.');
  }
  const data = (await res.json()) as { submissions?: StudentRecordingSubmission[] };
  return data.submissions || [];
}

export async function uploadMission5Recording(params: {
  user: UserAccount;
  blob: Blob;
  mediaType: SubmissionMediaType;
  campaignTitle: string;
}): Promise<StudentRecordingSubmission> {
  const { user, blob, mediaType, campaignTitle } = params;
  const meta = {
    studentUserId: user.id,
    studentName: user.fullName,
    studentId: user.studentId || '',
    className: user.className || '6 Bestari',
    mediaType,
    campaignTitle: campaignTitle.trim() || 'Kempen Selamatkan EcoWorld',
  };

  const res = await fetch('/api/submissions', {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(user),
      'Content-Type': blob.type || (mediaType === 'video' ? 'video/webm' : 'audio/webm'),
      'x-submission-meta': encodeURIComponent(JSON.stringify(meta)),
    },
    body: blob,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Penghantaran rakaman gagal.');
  }

  const data = (await res.json()) as { submission: StudentRecordingSubmission };
  return data.submission;
}

export async function saveSubmissionReview(params: {
  teacher: UserAccount;
  submissionId: string;
  teacherComment: string;
  teacherScore: number | null;
  teacherGrade: string;
}): Promise<StudentRecordingSubmission> {
  const { teacher, submissionId, teacherComment, teacherScore, teacherGrade } = params;
  const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/review`, {
    method: 'PATCH',
    headers: {
      ...buildAuthHeaders(teacher),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teacherComment,
      teacherScore,
      teacherGrade,
      reviewedBy: teacher.fullName,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal menyimpan penilaian guru.');
  }

  const data = (await res.json()) as { submission: StudentRecordingSubmission };
  return data.submission;
}
