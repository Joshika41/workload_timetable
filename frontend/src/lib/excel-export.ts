import * as XLSX from 'xlsx';
import type {
  CourseAllocation,
  FacultyWorkloadSummary,
  FacultyMember,
  Course,
} from './workload-types';

/**
 * Exports Faculty-wise Workload Sheet reproducing "Untitled spreadsheet.xlsx"
 * Structure:
 * S.No | Staff Name | Designation | Subject Code | Course Name | Class & Section | No of Stu | Theory | Practical | Total Hours | Default Hours | Remaining Hours | Status
 */
export function exportFacultyWorkloadToExcel(
  workloads: FacultyWorkloadSummary[],
  fileName = 'Faculty_Workload_Plan_SRM.xlsx'
) {
  const rows: any[] = [];

  // Header Title Info
  rows.push(['SRM INSTITUTE OF SCIENCE AND TECHNOLOGY']);
  rows.push(['DEPARTMENT OF COMPUTER APPLICATIONS - MCA & MCA GEN AI']);
  rows.push(['FACULTY WORKLOAD ALLOCATION & STATUS REPORT - ACADEMIC YEAR 2026-2027']);
  rows.push([]); // Empty row

  // Table Column Headers
  const headers = [
    'S.No',
    'Staff Name',
    'Designation',
    'Programme',
    'Subject Code',
    'Course Name',
    'Class & Section',
    'No of Stu',
    'Role',
    'Theory (Hrs)',
    'Practical (Hrs)',
    'Allocated Hours',
    'Default Hours',
    'Remaining Hours',
    'Workload Status',
  ];
  rows.push(headers);

  let serial = 1;

  workloads.forEach((w) => {
    if (w.allocatedSubjects.length === 0) {
      rows.push([
        serial++,
        w.facultyName,
        w.designation,
        w.programme,
        '-',
        'No subjects currently allocated',
        '-',
        0,
        '-',
        0,
        0,
        0,
        w.defaultHours,
        w.remainingHours,
        w.status,
      ]);
    } else {
      w.allocatedSubjects.forEach((sub, subIdx) => {
        rows.push([
          subIdx === 0 ? serial++ : '',
          subIdx === 0 ? w.facultyName : '',
          subIdx === 0 ? w.designation : '',
          subIdx === 0 ? w.programme : '',
          sub.courseCode,
          sub.courseTitle,
          sub.section,
          sub.studentCount,
          sub.role,
          sub.theoryHours,
          sub.practicalHours,
          sub.totalHours,
          subIdx === 0 ? w.defaultHours : '',
          subIdx === 0 ? w.remainingHours : '',
          subIdx === 0 ? w.status : '',
        ]);
      });

      // Subtotal summary row for the faculty
      rows.push([
        '',
        `Total for ${w.facultyName}:`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        w.theoryHours,
        w.practicalHours,
        w.allocatedHours,
        w.defaultHours,
        w.remainingHours,
        w.status,
      ]);
      rows.push([]); // Separator row between faculty
    }
  });

  // Overall Department Statistics at the bottom
  rows.push([]);
  rows.push(['DEPARTMENT SUMMARY METRICS']);
  const totalAllocated = workloads.reduce((sum, w) => sum + w.allocatedHours, 0);
  const totalDefault = workloads.reduce((sum, w) => sum + w.defaultHours, 0);
  const underloaded = workloads.filter((w) => w.status === 'UNDERLOADED').length;
  const balanced = workloads.filter((w) => w.status === 'BALANCED').length;
  const overloaded = workloads.filter((w) => w.status === 'OVERLOADED').length;

  rows.push(['Total Faculty:', workloads.length]);
  rows.push(['Total Department Default Hours:', totalDefault]);
  rows.push(['Total Department Allocated Hours:', totalAllocated]);
  rows.push(['Faculty Underloaded:', underloaded]);
  rows.push(['Faculty Balanced:', balanced]);
  rows.push(['Faculty Overloaded:', overloaded]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column Widths for professional presentation
  ws['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 26 }, // Staff Name
    { wch: 22 }, // Designation
    { wch: 14 }, // Programme
    { wch: 14 }, // Subject Code
    { wch: 38 }, // Course Name
    { wch: 18 }, // Class & Section
    { wch: 10 }, // No of Stu
    { wch: 12 }, // Role
    { wch: 13 }, // Theory
    { wch: 14 }, // Practical
    { wch: 15 }, // Allocated Hours
    { wch: 14 }, // Default Hours
    { wch: 16 }, // Remaining Hours
    { wch: 16 }, // Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Faculty Workload Sheet');
  XLSX.writeFile(wb, fileName);
}

/**
 * Exports Course-wise Allocation Sheet reproducing "Untitled spreadsheet (1).xlsx"
 * Structure:
 * Course Code | Course Name | Programme | Semester | Section | Main Faculty | Assistant Faculty | Students | Theory | Practical | Total Hours
 */
export function exportCourseAllocationToExcel(
  allocations: CourseAllocation[],
  fileName = 'Course_Wise_Allocation_SRM.xlsx'
) {
  const rows: any[] = [];

  rows.push(['SRM INSTITUTE OF SCIENCE AND TECHNOLOGY']);
  rows.push(['DEPARTMENT OF COMPUTER APPLICATIONS - MCA & MCA GEN AI']);
  rows.push(['COURSE-WISE FACULTY ALLOCATION MATRIX - ACADEMIC YEAR 2026-2027']);
  rows.push([]);

  const headers = [
    'S.No',
    'Course Code',
    'Course Name',
    'Programme',
    'Semester',
    'Section',
    'Main Faculty',
    'Assistant Faculty (Lab Support)',
    'Students',
    'Theory (Hrs)',
    'Practical (Hrs)',
    'Total Hours',
    'Allocation Status',
  ];
  rows.push(headers);

  let serial = 1;
  let totalTheory = 0;
  let totalPractical = 0;
  let grandTotal = 0;

  allocations.forEach((alloc) => {
    totalTheory += alloc.theoryHours;
    totalPractical += alloc.practicalHours;
    grandTotal += alloc.totalHours;

    rows.push([
      serial++,
      alloc.courseCode,
      alloc.courseTitle,
      alloc.programme,
      alloc.semester,
      alloc.section,
      alloc.mainFacultyName || 'Unassigned',
      alloc.asstFacultyName || '-',
      alloc.studentCount,
      alloc.theoryHours,
      alloc.practicalHours,
      alloc.totalHours,
      alloc.status,
    ]);
  });

  rows.push([]);
  rows.push([
    '',
    'TOTALS:',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalTheory,
    totalPractical,
    grandTotal,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 14 }, // Code
    { wch: 38 }, // Title
    { wch: 14 }, // Programme
    { wch: 10 }, // Sem
    { wch: 18 }, // Section
    { wch: 26 }, // Main Faculty
    { wch: 26 }, // Asst Faculty
    { wch: 10 }, // Students
    { wch: 13 }, // Theory
    { wch: 14 }, // Practical
    { wch: 13 }, // Total
    { wch: 18 }, // Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Course Allocation Sheet');
  XLSX.writeFile(wb, fileName);
}
