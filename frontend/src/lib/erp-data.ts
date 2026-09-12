export type Role = "admin" | "faculty" | "dean";

export interface Faculty {
  id: string;
  name: string;
  department: string;
  theoryHours: number;
  labHours: number;
  inchargeHours: number;
  maxHours: number;
}

export const DEPARTMENTS = [
  "PG Department of Computer Applications - MCA",
  "Department of Computer Science & Engineering",
  "Department of Information Technology",
  "Department of Artificial Intelligence & Data Science",
];

export const SECTIONS = [
  "MCA I-A",
  "MCA I-B",
  "MCA II-A",
  "MCA II-B",
  "MCA Gen AI A",
  "MCA Gen AI B",
  "MCA Cyber A",
  "MCA Cyber B",
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const PERIODS = [
  "P1 · 08:45",
  "P2 · 09:40",
  "P3 · 10:50",
  "P4 · 11:45",
  "P5 · 01:30",
  "P6 · 02:25",
];

export const FACULTY: Faculty[] = [
  { id: "SRM-MCA-101", name: "Dr. Priya Ramesh", department: "MCA", theoryHours: 4, labHours: 4, inchargeHours: 2, maxHours: 18 },
  { id: "SRM-MCA-102", name: "Dr. Arun Kumar", department: "MCA", theoryHours: 4, labHours: 2, inchargeHours: 0, maxHours: 18 },
  { id: "SRM-MCA-103", name: "Prof. Meenakshi S", department: "MCA", theoryHours: 2, labHours: 4, inchargeHours: 2, maxHours: 16 },
  { id: "SRM-MCA-104", name: "Dr. Vignesh Balaji", department: "MCA", theoryHours: 4, labHours: 4, inchargeHours: 0, maxHours: 20 },
  { id: "SRM-MCA-105", name: "Prof. Kavitha Nair", department: "MCA", theoryHours: 1, labHours: 4, inchargeHours: 2, maxHours: 16 },
  { id: "SRM-MCA-106", name: "Dr. Suresh Iyer", department: "MCA", theoryHours: 4, labHours: 2, inchargeHours: 2, maxHours: 18 },
  { id: "SRM-CSE-201", name: "Dr. Anand Krishnan", department: "CSE", theoryHours: 2, labHours: 4, inchargeHours: 0, maxHours: 18 },
  { id: "SRM-CSE-202", name: "Prof. Divya Prakash", department: "CSE", theoryHours: 4, labHours: 4, inchargeHours: 2, maxHours: 20 },
];

export const SUBJECTS = [
  "Advanced Algorithms",
  "Distributed Systems",
  "Machine Learning",
  "Cloud Computing",
  "Software Architecture",
  "Data Visualization",
  "Generative AI Foundations",
  "Cyber Forensics",
  "JAVA LAB",
  "PYTHON LAB",
  "DBMS LAB",
  "ML LAB",
];

const VENUES = ["Room 103", "Room 104", "Room 205", "Room 206", "Seminar Hall"];
const LABS = ["Lab 1", "Lab 2", "IN2", "IN3"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export interface Slot {
  subject: string;
  venue: string;
  faculty: string;
  section: string;
}

/** Deterministic timetable generator: 5 days x exactly 6 periods. */
export function buildTimetable(section: string): (Slot | null)[][] {
  const grid: (Slot | null)[][] = [];
  const labUsage = new Set<string>();
  for (let d = 0; d < DAYS.length; d++) {
    const row: (Slot | null)[] = [];
    for (let p = 0; p < 6; p++) {
      const seed = hash(`${section}-${d}-${p}`);
      if (seed % 9 === 0) {
        row.push(null);
        continue;
      }
      const subject = SUBJECTS[seed % SUBJECTS.length]!;
      const isLab = subject.includes("LAB");
      let venue: string;
      if (isLab) {
        let idx = seed % LABS.length;
        let guard = 0;
        while (labUsage.has(`${d}-${p}-${LABS[idx]}`) && guard < LABS.length) {
          idx = (idx + 1) % LABS.length;
          guard++;
        }
        venue = LABS[idx]!;
        labUsage.add(`${d}-${p}-${venue}`);
      } else {
        venue = VENUES[seed % VENUES.length]!;
      }
      row.push({
        subject,
        venue,
        section,
        faculty: FACULTY[seed % FACULTY.length]!.name,
      });
    }
    grid.push(row);
  }
  return grid;
}

export function buildFacultyTimetable(facultyName: string): (Slot | null)[][] {
  const grid: (Slot | null)[][] = DAYS.map(() => Array(6).fill(null));
  for (const section of SECTIONS) {
    const t = buildTimetable(section);
    for (let d = 0; d < DAYS.length; d++) {
      for (let p = 0; p < 6; p++) {
        const slot = t[d]![p];
        if (slot && slot.faculty === facultyName && !grid[d]![p]) {
          grid[d]![p] = slot;
        }
      }
    }
  }
  return grid;
}

export const CREDENTIALS: Record<string, { password: string; role: Role; name: string }> = {
  drpriya: { password: "password123", role: "faculty", name: "Dr. Priya Ramesh" },
  admin: { password: "password123", role: "admin", name: "Registrar Office" },
  dean: { password: "password123", role: "dean", name: "Dr. R. Chandrasekaran" },
};
