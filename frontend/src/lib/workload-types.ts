export type ProgrammeType = 'MCA' | 'MCA GEN AI' | 'M.Tech CSE' | 'B.Tech CSE';
export type SemesterType = 'I' | 'II' | 'III' | 'IV';
export type SemesterTerm = 'Odd Semester' | 'Even Semester';

export type CourseCategory = 
  | 'C'   // Professional Core
  | 'D'   // Discipline Elective
  | 'G'   // Generic Elective
  | 'S'   // Skill Enhancement
  | 'P'   // Project / Internship
  | 'AE'; // Ability Enhancement

export interface CategoryInfo {
  code: CourseCategory;
  name: string;
  badgeColor: string;
  bgLight: string;
  borderLight: string;
  textColor: string;
}

export const COURSE_CATEGORIES: Record<CourseCategory, CategoryInfo> = {
  C: {
    code: 'C',
    name: 'Professional Core',
    badgeColor: 'bg-blue-600 text-white',
    bgLight: 'bg-blue-50/60',
    borderLight: 'border-blue-200',
    textColor: 'text-blue-700',
  },
  D: {
    code: 'D',
    name: 'Discipline Elective',
    badgeColor: 'bg-indigo-600 text-white',
    bgLight: 'bg-indigo-50/60',
    borderLight: 'border-indigo-200',
    textColor: 'text-indigo-700',
  },
  G: {
    code: 'G',
    name: 'Generic Elective',
    badgeColor: 'bg-emerald-600 text-white',
    bgLight: 'bg-emerald-50/60',
    borderLight: 'border-emerald-200',
    textColor: 'text-emerald-700',
  },
  S: {
    code: 'S',
    name: 'Skill Enhancement',
    badgeColor: 'bg-amber-600 text-white',
    bgLight: 'bg-amber-50/60',
    borderLight: 'border-amber-200',
    textColor: 'text-amber-700',
  },
  P: {
    code: 'P',
    name: 'Project / Internship',
    badgeColor: 'bg-purple-600 text-white',
    bgLight: 'bg-purple-50/60',
    borderLight: 'border-purple-200',
    textColor: 'text-purple-700',
  },
  AE: {
    code: 'AE',
    name: 'Ability Enhancement',
    badgeColor: 'bg-rose-600 text-white',
    bgLight: 'bg-rose-50/60',
    borderLight: 'border-rose-200',
    textColor: 'text-rose-700',
  },
};

export type FacultyWorkloadStatus = 'UNDERLOADED' | 'BALANCED' | 'OVERLOADED';
export type PreferenceSubmissionStatus = 'PENDING' | 'SUBMITTED' | 'ALLOCATED';

export interface FacultyMember {
  id: string;
  name: string;
  designation: string;
  department: string;
  programme: ProgrammeType;
  facultyType: 'Regular' | 'Adjunct' | 'FTS' | 'Visiting';
  defaultWorkloadHours: number; // Configurable by HOD (e.g. 18, 10, 4)
  email: string;
  phone?: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  avatarUrl?: string;
}

export interface Course {
  code: string;
  title: string;
  programme: ProgrammeType;
  semester: SemesterType;
  category: CourseCategory;
  theoryHours_L: number;
  tutorialHours_T: number;
  practicalHours_P: number;
  credits_C: number;
  description?: string;
  totalContactHours: number;
}

export interface SectionConfig {
  id: string;
  name: string; // e.g., 'I MCA A', 'I MCA B', 'II MCA A'
  programme: ProgrammeType;
  semester: SemesterType;
  studentCount: number;
  labBatches: number;
  studentsPerBatch?: number;
}

export interface CampusWorkEntry {
  id: string;
  facultyId: string;
  hours: number;
  description: string;
}

export interface CourseAllocation {
  id: string;
  courseCode: string;
  courseTitle: string;
  programme: ProgrammeType;
  semester: SemesterType;
  section: string; // e.g. 'I MCA A'
  studentCount: number;
  theoryHours: number;
  practicalHours: number;
  labBatches: number;
  mainFacultyId: string | null;
  mainFacultyName?: string | undefined;
  asstFacultyId: string | null;
  asstFacultyName?: string | undefined;
  mainTheoryHours?: number;
  mainPracticalHours?: number;
  asstTheoryHours?: number;
  asstPracticalHours?: number;
  totalHours: number;
  status: 'UNALLOCATED' | 'PARTIALLY_ALLOCATED' | 'ALLOCATED' | 'RECONCILED' | 'FINALIZED';
  notes?: string | undefined;
}

export interface FacultyPreferenceItem {
  courseCode: string;
  courseTitle: string;
  rank: number; // 1 to 5
  category: CourseCategory;
  programme: ProgrammeType;
  semester: SemesterType;
  credits: number;
  theoryHours: number;
  practicalHours: number;
}

export interface FacultyPreferenceSubmission {
  facultyId: string;
  facultyName: string;
  programme: ProgrammeType;
  semester: SemesterType;
  academicYear: string;
  submittedAt: string | null;
  status: PreferenceSubmissionStatus;
  preferences: FacultyPreferenceItem[];
}

export interface FacultyWorkloadSummary {
  facultyId: string;
  facultyName: string;
  designation: string;
  programme: ProgrammeType;
  defaultHours: number;
  teachingHours: number;
  campusWorkHours: number;
  allocatedHours: number; // teachingHours + campusWorkHours
  theoryHours: number;
  practicalHours: number;
  remainingHours: number;
  overloadHours: number;
  utilizationPercentage: number;
  status: FacultyWorkloadStatus;
  allocatedCoursesCount: number;
  preferencesStatus: PreferenceSubmissionStatus;
  preferencesCount: number;
  campusWorkEntries: CampusWorkEntry[];
  allocatedSubjects: {
    allocationId: string;
    courseCode: string;
    courseTitle: string;
    section: string;
    studentCount: number;
    role: 'Main' | 'Assistant';
    theoryHours: number;
    practicalHours: number;
    totalHours: number;
  }[];
}
