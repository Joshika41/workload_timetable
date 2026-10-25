import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TimetableExportOptions {
  institutionName?: string;
  departmentName?: string;
  programmeName?: string;
  semester?: number | string;
  section?: string;
  academicYear?: string;
  room?: string;
  slots: Array<{
    day: string;
    period: number;
    course_code: string;
    course_short?: string;
    course_name?: string;
    room?: string;
    faculty_name?: string;
    is_lab?: boolean;
  }>;
  periodTimings?: Array<{ period: number; time: string }>;
}

export function exportTimetableToPdf(options: TimetableExportOptions) {
  const {
    institutionName = 'SRM INSTITUTE OF SCIENCE AND TECHNOLOGY',
    departmentName = 'Department of Computer Science',
    programmeName = 'B.Sc Computer Science (Hons)',
    semester = 1,
    section = 'Section A',
    academicYear = '2026-27',
    room = 'CR-200',
    slots = [],
    periodTimings = [
      { period: 1, time: '08:30 - 09:20' },
      { period: 2, time: '09:25 - 10:15' },
      { period: 3, time: '10:30 - 11:20' },
      { period: 4, time: '11:25 - 12:15' },
      { period: 5, time: '01:00 - 01:50' },
      { period: 6, time: '01:55 - 02:45' },
    ]
  } = options;

  // Create A4 Landscape PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const margin = 14;

  // 1. Header Box with Navy Gradient Feel
  doc.setFillColor(0, 33, 71); // #002147 SRM Navy
  doc.rect(margin, 12, pageWidth - margin * 2, 28, 'F');

  // Gold accent line under header
  doc.setFillColor(201, 168, 76); // #C9A84C Gold
  doc.rect(margin, 39, pageWidth - margin * 2, 1.5, 'F');

  // Institution Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(institutionName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });

  // Subtitle / Department & Academic Year
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(240, 240, 240);
  doc.text(
    `FACULTY OF SCIENCE & HUMANITIES — ${departmentName.toUpperCase()} — AY ${academicYear}`,
    pageWidth / 2,
    26,
    { align: 'center' }
  );

  // Timetable Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(201, 168, 76); // Gold text
  doc.text(
    `OFFICIAL CLASS TIMETABLE — ${programmeName.toUpperCase()} (SEMESTER ${semester}) — ${section.toUpperCase()}`,
    pageWidth / 2,
    33,
    { align: 'center' }
  );

  // 2. Metadata Bar
  doc.setFillColor(241, 245, 249); // #F1F5F9 Slate light
  doc.rect(margin, 43, pageWidth - margin * 2, 9, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, 43, pageWidth - margin * 2, 9, 'S');

  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');

  const metaText1 = `Programme: ${programmeName}`;
  const metaText2 = `Semester: ${semester}`;
  const metaText3 = `Section: ${section}`;
  const metaText4 = `Classroom / Base: ${room}`;
  const metaText5 = `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  doc.text(metaText1, margin + 4, 49);
  doc.text(metaText2, margin + 65, 49);
  doc.text(metaText3, margin + 110, 49);
  doc.text(metaText4, margin + 160, 49);
  doc.text(metaText5, pageWidth - margin - 4, 49, { align: 'right' });

  // 3. Construct Table Data
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  
  // Table Header
  const head = [
    [
      { content: 'DAY / HOUR', styles: { halign: 'center', fillColor: [0, 33, 71], textColor: [255, 255, 255] } },
      ...periodTimings.map(p => ({
        content: `Period ${p.period}\n${p.time}`,
        styles: { halign: 'center', fillColor: [0, 33, 71], textColor: [255, 255, 255] }
      }))
    ]
  ];

  // Table Rows
  const body = days.map(day => {
    const rowSlots = slots.filter(s => s.day.toUpperCase() === day);
    const dayCells: any[] = [
      {
        content: day,
        styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fillColor: [248, 250, 252], textColor: [0, 33, 71] }
      }
    ];

    periodTimings.forEach(p => {
      const slot = rowSlots.find(s => s.period === p.period);
      if (!slot || !slot.course_code) {
        dayCells.push({
          content: '—\nFree',
          styles: { halign: 'center', valign: 'middle', textColor: [148, 163, 184], fontSize: 8 }
        });
      } else {
        const title = slot.course_short || slot.course_name || '';
        const roomBadge = slot.room ? `[${slot.room}]` : '';
        const faculty = slot.faculty_name ? `\n👤 ${slot.faculty_name}` : '';
        const isLab = slot.is_lab || slot.room?.toLowerCase().includes('lab');

        dayCells.push({
          content: `${slot.course_code}\n${title} ${roomBadge}${faculty}`,
          styles: {
            halign: 'center',
            valign: 'middle',
            fontStyle: 'bold',
            fillColor: isLab ? [240, 253, 244] : [255, 255, 255],
            textColor: isLab ? [22, 101, 52] : [0, 33, 71],
            fontSize: 7.5
          }
        });
      }
    });

    return dayCells;
  });

  // Render Table via autoTable
  autoTable(doc, {
    head: head as any,
    body: body,
    startY: 55,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3,
      lineColor: [203, 213, 225],
      lineWidth: 0.3,
    },
    headStyles: {
      fontSize: 8.5,
      fontStyle: 'bold',
    },
  });

  // 4. Course Reference Footer Table (if any distinct courses exist)
  const distinctCourses = new Map<string, { code: string; title: string; faculty: string; room: string }>();
  slots.forEach(s => {
    if (s.course_code && !distinctCourses.has(s.course_code)) {
      distinctCourses.set(s.course_code, {
        code: s.course_code,
        title: s.course_name || s.course_short || s.course_code,
        faculty: s.faculty_name || 'Department Faculty',
        room: s.room || room
      });
    }
  });

  const lastTable = (doc as any).lastAutoTable;
  const footerStartY = lastTable ? lastTable.finalY + 6 : 160;

  if (footerStartY < 175 && distinctCourses.size > 0) {
    const courseList = Array.from(distinctCourses.values());
    const courseHead = [['Course Code', 'Course Title', 'Handling Faculty', 'Allocated Room']];
    const courseBody = courseList.map(c => [c.code, c.title, c.faculty, c.room]);

    autoTable(doc, {
      head: courseHead,
      body: courseBody,
      startY: footerStartY,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [51, 65, 85],
      },
      headStyles: {
        fontSize: 7.5,
        fontStyle: 'bold',
        fillColor: [241, 245, 249],
        textColor: [0, 33, 71],
      },
    });
  }

  // 5. Sign-off Footer
  const footerY = 198;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);

  doc.text('Time Table Coordinator', margin + 20, footerY);
  doc.text('Head of the Department', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Dean / Associate Dean', pageWidth - margin - 20, footerY, { align: 'right' });

  // Save/Download PDF file directly
  const safeProg = programmeName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeSec = section.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Timetable_${safeProg}_Sem${semester}_${safeSec}.pdf`;
  doc.save(fileName);
}
