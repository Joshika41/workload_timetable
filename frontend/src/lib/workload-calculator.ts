import type {
  CampusWorkEntry,
  CourseAllocation,
  FacultyMember,
  FacultyPreferenceSubmission,
  FacultyWorkloadStatus,
  FacultyWorkloadSummary,
} from './workload-types';

/**
 * Dedicated Workload Calculation Engine.
 * 
 * Implements the formula:
 *   Teaching Hours = sum(credited hours for main/asst across allocations)
 *   Campus Work Hours = sum(campus work entries)
 *   Total Credited Workload = Teaching Hours + Campus Work Hours
 *   Remaining Hours = max(0, defaultHours - Total Credited Workload)
 *   Excess/Overload Hours = max(0, Total Credited Workload - defaultHours)
 * 
 * Status:
 *   Total Credited < defaultHours => 'UNDERLOADED'
 *   Total Credited === defaultHours => 'BALANCED'
 *   Total Credited > defaultHours => 'OVERLOADED'
 */
export function calculateFacultyWorkload(
  faculty: FacultyMember,
  allocations: CourseAllocation[],
  preferences?: FacultyPreferenceSubmission,
  campusWorkEntries: CampusWorkEntry[] = []
): FacultyWorkloadSummary {
  let totalTheory = 0;
  let totalPractical = 0;
  const allocatedSubjects: FacultyWorkloadSummary['allocatedSubjects'] = [];

  allocations.forEach((alloc) => {
    const isMain = alloc.mainFacultyId === faculty.id;
    const isAsst = alloc.asstFacultyId === faculty.id;

    if (isMain || isAsst) {
      // Role credited hours:
      // If mainTheoryHours/mainPracticalHours are defined on alloc, use them.
      // Else default: Main gets full theoryHours and practicalHours, Asst gets practicalHours (if any).
      const th = isMain
        ? (alloc.mainTheoryHours !== undefined ? alloc.mainTheoryHours : alloc.theoryHours)
        : (alloc.asstTheoryHours !== undefined ? alloc.asstTheoryHours : 0);

      const pr = isMain
        ? (alloc.mainPracticalHours !== undefined ? alloc.mainPracticalHours : alloc.practicalHours)
        : (alloc.asstPracticalHours !== undefined ? alloc.asstPracticalHours : alloc.practicalHours);

      const subTotal = th + pr;

      totalTheory += th;
      totalPractical += pr;

      allocatedSubjects.push({
        allocationId: alloc.id,
        courseCode: alloc.courseCode,
        courseTitle: alloc.courseTitle,
        section: alloc.section,
        studentCount: alloc.studentCount,
        role: isMain ? 'Main' : 'Assistant',
        theoryHours: th,
        practicalHours: pr,
        totalHours: subTotal,
      });
    }
  });

  const teachingHours = totalTheory + totalPractical;

  // Campus work calculation
  const facultyCampusWork = campusWorkEntries.filter((c) => c.facultyId === faculty.id);
  const campusWorkHours = facultyCampusWork.reduce((sum, c) => sum + (c.hours || 0), 0);

  const totalCredited = teachingHours + campusWorkHours;
  const defaultHours = faculty.defaultWorkloadHours || 18;
  const remainingHours = Math.max(0, defaultHours - totalCredited);
  const overloadHours = Math.max(0, totalCredited - defaultHours);
  const utilizationPercentage = defaultHours > 0 ? Math.round((totalCredited / defaultHours) * 100) : 100;

  let status: FacultyWorkloadStatus = 'BALANCED';
  if (totalCredited < defaultHours) {
    status = 'UNDERLOADED';
  } else if (totalCredited > defaultHours) {
    status = 'OVERLOADED';
  }

  const prefStatus = preferences?.status || 'PENDING';
  const prefCount = preferences?.preferences?.length || 0;

  return {
    facultyId: faculty.id,
    facultyName: faculty.name,
    designation: faculty.designation,
    programme: faculty.programme,
    defaultHours,
    teachingHours,
    campusWorkHours,
    allocatedHours: totalCredited,
    theoryHours: totalTheory,
    practicalHours: totalPractical,
    remainingHours,
    overloadHours,
    utilizationPercentage,
    status,
    allocatedCoursesCount: allocatedSubjects.length,
    preferencesStatus: prefStatus,
    preferencesCount: prefCount,
    campusWorkEntries: facultyCampusWork,
    allocatedSubjects,
  };
}

export function calculateAllWorkloads(
  facultyList: FacultyMember[],
  allocations: CourseAllocation[],
  preferencesMap: Record<string, FacultyPreferenceSubmission>,
  campusWorkList: CampusWorkEntry[] = []
): FacultyWorkloadSummary[] {
  return facultyList.map((faculty) =>
    calculateFacultyWorkload(faculty, allocations, preferencesMap[faculty.id], campusWorkList)
  );
}

export interface DepartmentDashboardMetrics {
  totalFaculty: number;
  totalCourses: number;
  totalSections: number;
  pendingPreferences: number;
  submittedPreferences: number;
  allocatedHours: number;
  unallocatedHours: number;
  underloadedCount: number;
  balancedCount: number;
  overloadedCount: number;
  totalRequiredHours: number;
  allocationCoveragePercentage: number;
}

export function calculateDashboardMetrics(
  workloads: FacultyWorkloadSummary[],
  allocations: CourseAllocation[],
  uniqueCoursesCount: number,
  uniqueSectionsCount: number
): DepartmentDashboardMetrics {
  const totalFaculty = workloads.length;
  const totalCourses = uniqueCoursesCount;
  const totalSections = uniqueSectionsCount;

  let pendingPreferences = 0;
  let submittedPreferences = 0;
  let underloadedCount = 0;
  let balancedCount = 0;
  let overloadedCount = 0;
  let allocatedHours = 0;

  workloads.forEach((w) => {
    if (w.preferencesStatus === 'PENDING') {
      pendingPreferences += 1;
    } else {
      submittedPreferences += 1;
    }

    if (w.status === 'UNDERLOADED') underloadedCount += 1;
    else if (w.status === 'BALANCED') balancedCount += 1;
    else if (w.status === 'OVERLOADED') overloadedCount += 1;

    allocatedHours += w.allocatedHours;
  });

  // Calculate required vs unallocated hours across all course offerings
  let totalRequiredHours = 0;
  let unallocatedHours = 0;

  allocations.forEach((alloc) => {
    const courseHours = alloc.theoryHours + alloc.practicalHours;
    totalRequiredHours += courseHours;

    if (!alloc.mainFacultyId) {
      unallocatedHours += courseHours;
    } else if (alloc.practicalHours > 0 && !alloc.asstFacultyId) {
      // Lab needs assistant faculty support
      unallocatedHours += Math.floor(alloc.practicalHours / 2);
    }
  });

  const allocationCoveragePercentage = totalRequiredHours > 0
    ? Math.min(100, Math.round(((totalRequiredHours - unallocatedHours) / totalRequiredHours) * 100))
    : 100;

  return {
    totalFaculty,
    totalCourses,
    totalSections,
    pendingPreferences,
    submittedPreferences,
    allocatedHours,
    unallocatedHours,
    underloadedCount,
    balancedCount,
    overloadedCount,
    totalRequiredHours,
    allocationCoveragePercentage,
  };
}
