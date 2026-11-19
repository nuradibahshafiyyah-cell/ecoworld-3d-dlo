export type UserRole = 'admin' | 'guru' | 'murid';

export type AvatarId = 'rimba' | 'tirta' | 'bayu' | 'suara';

export type CameraMode = 'overview' | 'follow' | 'zone' | 'firstPerson';

export interface Mission1Progress {
  completed: boolean;
  score: number;
  tersuratScore: number;
  tersiratScore: number;
  evidence: string[];
}

export interface Mission2Progress {
  completed: boolean;
  score: number;
  kbatScore: number;
  thinkingMap: { punca: string; kesan: string } | null;
  kbatAnswer: string;
}

export interface Mission3Progress {
  completed: boolean;
  score: number;
  chosenOption: string;
  justification: string;
}

export interface Mission4Progress {
  completed: boolean;
  score: number;
  argument: {
    pendirian: string;
    bukti: string;
    huraian: string;
    kesimpulan: string;
  } | null;
  hasRecording: boolean;
}

export interface Mission5Progress {
  completed: boolean;
  submitted: boolean;
  link: string;
  title: string;
  stepsDone: number[];
  rubricScore: number;
  reflection: string;
}

export interface StudentProgress {
  m1: Mission1Progress;
  m2: Mission2Progress;
  m3: Mission3Progress;
  m4: Mission4Progress;
  m5: Mission5Progress;
}

export interface UserAccount {
  id: string;
  role: UserRole;
  username: string;
  password: string;
  fullName: string;
  classes?: string[];
  studentId?: string;
  className?: string;
  classCode?: string;
  avatar?: AvatarId;
  xp?: number;
  unlockedMission?: number;
  progress?: StudentProgress;
  badges?: string[];
  teacherFeedback?: string;
  aiApprovedByTeacher?: boolean;
  peerFeedback?: string;
}

export interface MissionDef {
  id: number;
  title: string;
  shortTitle: string;
  focus: string;
  icon: string;
  maxXp: number;
  active: boolean;
  color: string;
  position: [number, number, number];
}

export interface ClassRoom {
  id: string;
  name: string;
  code: string;
  teacherUsername?: string;
}

export interface ActivityLog {
  time: string;
  actor: string;
  action: string;
}

export interface DatabaseState {
  apiEndpoint: string;
  classes: ClassRoom[];
  missions: MissionDef[];
  users: UserAccount[];
  logs: ActivityLog[];
}

export interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export interface AvatarDef {
  id: AvatarId;
  name: string;
  emoji: string;
  primaryColor: string;
  accentColor: string;
  tagline: string;
  roleTitle?: string;
  personality?: string;
  greeting?: string;
  suitLabel?: string;
  symbolLabel?: string;
}

export interface AIGuideResult {
  levelMode: string;
  nextStep: string;
  recommendations: string[];
  needsIntervention: boolean;
}

export interface Clue3D {
  id: 'paip' | 'ikan' | 'bau';
  title: string;
  description: string;
  position: [number, number, number];
}

export type SubmissionMediaType = 'audio' | 'video';

export interface StudentRecordingSubmission {
  id: string;
  studentUserId: string;
  studentName: string;
  studentId: string;
  className: string;
  missionId: number;
  mediaType: SubmissionMediaType;
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
  mediaUrl?: string;
}

