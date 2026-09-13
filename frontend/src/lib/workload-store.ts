import { useState, useEffect } from 'react';
import type {
  CampusWorkEntry,
  Course,
  CourseAllocation,
  FacultyMember,
  FacultyPreferenceSubmission,
  ProgrammeType,
  SectionConfig,
  SemesterType,
} from './workload-types';
import {
  calculateAllWorkloads,
  calculateDashboardMetrics,
  calculateFacultyWorkload,
} from './workload-calculator';

export const INITIAL_FACULTY: FacultyMember[] = [
  {
    "id": "FAC001",
    "name": "Dr K. Kalaiselvi",
    "designation": "Professor & HOD",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Regular",
    "defaultWorkloadHours": 10,
    "email": "kalaiselvi.k@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC002",
    "name": "Dr. R.Agusthiyar",
    "designation": "Professor",
    "department": "Computer Applications",
    "programme": "MCA GEN AI",
    "facultyType": "Regular",
    "defaultWorkloadHours": 13,
    "email": "agusthiyar.r@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC003",
    "name": "Dr S.Uma Rani",
    "designation": "Professor",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Regular",
    "defaultWorkloadHours": 16,
    "email": "umarani.s@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC004",
    "name": "Dr. D. Kanchana",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "kanchana.d@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC005",
    "name": "Dr M.Divya",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA GEN AI",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "divya.m@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC006",
    "name": "Dr. N. Krishnamoorthy",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA GEN AI",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "krishnamoorthy.n@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC007",
    "name": "Dr.S.Meenakshi",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "meenakshi.s@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC008",
    "name": "Dr M.Sowmya",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA GEN AI",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "sowmya.m@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC009",
    "name": "Dr.M.Sakthi Asvini",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "sakthiasvini.m@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC010",
    "name": "Dr K.Kottaisamy",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "kottaisamy.k@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC011",
    "name": "Dr R. Sivasankari",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA GEN AI",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "sivasankari.r@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC012",
    "name": "Dr S.Chithra",
    "designation": "Assistant Professor",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Regular",
    "defaultWorkloadHours": 18,
    "email": "chithra.s@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC013",
    "name": "Mr R.S Tinu Kumar",
    "designation": "Full-Time Scholar (FTS)",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "FTS",
    "defaultWorkloadHours": 9,
    "email": "tinukumar.rs@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC014",
    "name": "Ms A.Annat Tina",
    "designation": "Full-Time Scholar (FTS)",
    "department": "Computer Applications",
    "programme": "MCA GEN AI",
    "facultyType": "FTS",
    "defaultWorkloadHours": 10,
    "email": "annattina.a@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC015",
    "name": "Mr R.Appannan",
    "designation": "Full-Time Scholar (FTS)",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "FTS",
    "defaultWorkloadHours": 10,
    "email": "appannan.r@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC016",
    "name": "Dr R.Vanitha Mani",
    "designation": "Assistant Professor (AP/BSc)",
    "department": "Computer Applications",
    "programme": "MCA GEN AI",
    "facultyType": "Visiting",
    "defaultWorkloadHours": 4,
    "email": "vanithamani.r@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC017",
    "name": "Mrs.R.Sukanya",
    "designation": "Assistant Professor (AP/BSc)",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Visiting",
    "defaultWorkloadHours": 4,
    "email": "sukanya.r@srm.edu",
    "status": "ACTIVE"
  },
  {
    "id": "FAC018",
    "name": "Ms P R Sukanya Sridevi",
    "designation": "Assistant Professor (AP/BSc)",
    "department": "Computer Applications",
    "programme": "MCA",
    "facultyType": "Visiting",
    "defaultWorkloadHours": 10,
    "email": "sukanyasridevi.pr@srm.edu",
    "status": "ACTIVE"
  }
];

export const INITIAL_COURSES: Course[] = [
  {
    "code": "PCA25C01J",
    "title": "Object Oriented Programming using Java",
    "programme": "MCA GEN AI",
    "semester": "I",
    "category": "C",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Object Oriented Programming using Java (PCA25C01J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C02T",
    "title": "Data Structures and Algorithms",
    "programme": "MCA GEN AI",
    "semester": "I",
    "category": "C",
    "theoryHours_L": 4,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 4,
    "totalContactHours": 4,
    "description": "Official syllabus for Data Structures and Algorithms (PCA25C02T) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C03J",
    "title": "Database Technology",
    "programme": "MCA GEN AI",
    "semester": "I",
    "category": "C",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Database Technology (PCA25C03J) under SRM Regulations 2025."
  },
  {
    "code": "PGI25D02J",
    "title": "Intelligent Language Processing",
    "programme": "MCA GEN AI",
    "semester": "I",
    "category": "D",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Intelligent Language Processing (PGI25D02J) under SRM Regulations 2025."
  },
  {
    "code": "PGI25G01T",
    "title": "Deep Neural Networks",
    "programme": "MCA GEN AI",
    "semester": "I",
    "category": "G",
    "theoryHours_L": 4,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 2,
    "totalContactHours": 4,
    "description": "Official syllabus for Deep Neural Networks (PGI25G01T) under SRM Regulations 2025."
  },
  {
    "code": "PGI25S01J",
    "title": "Generative AI and Open AI",
    "programme": "MCA GEN AI",
    "semester": "I",
    "category": "S",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Generative AI and Open AI (PGI25S01J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C08J",
    "title": "Data Communication Networks",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "C",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Data Communication Networks (PCA25C08J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C09T",
    "title": "Cloud and Quantum Computing",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "C",
    "theoryHours_L": 4,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 4,
    "totalContactHours": 4,
    "description": "Official syllabus for Cloud and Quantum Computing (PCA25C09T) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C10L",
    "title": "Capstone Project",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "C",
    "theoryHours_L": 0,
    "tutorialHours_T": 0,
    "practicalHours_P": 8,
    "credits_C": 4,
    "totalContactHours": 8,
    "description": "Official syllabus for Capstone Project (PCA25C10L) under SRM Regulations 2025."
  },
  {
    "code": "PGI25D07J",
    "title": "Computer Vision in Smart Robotics",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "D",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Computer Vision in Smart Robotics (PGI25D07J) under SRM Regulations 2025."
  },
  {
    "code": "PGI25D08J",
    "title": "Building Conversational AI for Human Resources",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "D",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Building Conversational AI for Human Resources (PGI25D08J) under SRM Regulations 2025."
  },
  {
    "code": "PGI25D09J",
    "title": "IoT Devices with Computer Vision Technologies",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "D",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for IoT Devices with Computer Vision Technologies (PGI25D09J) under SRM Regulations 2025."
  },
  {
    "code": "PGI25G04T",
    "title": "Data Engineering and Analytics",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "G",
    "theoryHours_L": 2,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 2,
    "totalContactHours": 2,
    "description": "Official syllabus for Data Engineering and Analytics (PGI25G04T) under SRM Regulations 2025."
  },
  {
    "code": "PGI25G05T",
    "title": "Distributed Data Processing Systems",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "G",
    "theoryHours_L": 2,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 2,
    "totalContactHours": 2,
    "description": "Official syllabus for Distributed Data Processing Systems (PGI25G05T) under SRM Regulations 2025."
  },
  {
    "code": "PGI25G06T",
    "title": "Quantum Machine Learning",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "G",
    "theoryHours_L": 2,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 2,
    "totalContactHours": 2,
    "description": "Official syllabus for Quantum Machine Learning (PGI25G06T) under SRM Regulations 2025."
  },
  {
    "code": "PGI25P01L",
    "title": "Internship",
    "programme": "MCA GEN AI",
    "semester": "III",
    "category": "P",
    "theoryHours_L": 0,
    "tutorialHours_T": 0,
    "practicalHours_P": 4,
    "credits_C": 2,
    "totalContactHours": 4,
    "description": "Official syllabus for Internship (PGI25P01L) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C01J",
    "title": "Object Oriented Programming using Java",
    "programme": "MCA",
    "semester": "I",
    "category": "C",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Object Oriented Programming using Java (PCA25C01J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C02T",
    "title": "Data Structures and Algorithms",
    "programme": "MCA",
    "semester": "I",
    "category": "C",
    "theoryHours_L": 4,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 4,
    "totalContactHours": 4,
    "description": "Official syllabus for Data Structures and Algorithms (PCA25C02T) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C03J",
    "title": "Database Technology",
    "programme": "MCA",
    "semester": "I",
    "category": "C",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Database Technology (PCA25C03J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25D02J",
    "title": "Advanced Web Technology",
    "programme": "MCA",
    "semester": "I",
    "category": "D",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Advanced Web Technology (PCA25D02J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25G01T",
    "title": "Cyber Security",
    "programme": "MCA",
    "semester": "I",
    "category": "G",
    "theoryHours_L": 4,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 2,
    "totalContactHours": 4,
    "description": "Official syllabus for Cyber Security (PCA25G01T) under SRM Regulations 2025."
  },
  {
    "code": "PCA25S01J",
    "title": "Data Mining Techniques",
    "programme": "MCA",
    "semester": "I",
    "category": "S",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Data Mining Techniques (PCA25S01J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C08J",
    "title": "Data Communication Networks",
    "programme": "MCA",
    "semester": "III",
    "category": "C",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Data Communication Networks (PCA25C08J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C09T",
    "title": "Cloud and Quantum Computing",
    "programme": "MCA",
    "semester": "III",
    "category": "C",
    "theoryHours_L": 4,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 4,
    "totalContactHours": 4,
    "description": "Official syllabus for Cloud and Quantum Computing (PCA25C09T) under SRM Regulations 2025."
  },
  {
    "code": "PCA25C10L",
    "title": "Capstone Project",
    "programme": "MCA",
    "semester": "III",
    "category": "C",
    "theoryHours_L": 0,
    "tutorialHours_T": 0,
    "practicalHours_P": 8,
    "credits_C": 4,
    "totalContactHours": 8,
    "description": "Official syllabus for Capstone Project (PCA25C10L) under SRM Regulations 2025."
  },
  {
    "code": "PCA25D07J",
    "title": "Software Quality Assurance",
    "programme": "MCA",
    "semester": "III",
    "category": "D",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Software Quality Assurance (PCA25D07J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25D08J",
    "title": "Augmented Reality and Virtual Reality",
    "programme": "MCA",
    "semester": "III",
    "category": "D",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Augmented Reality and Virtual Reality (PCA25D08J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25D09J",
    "title": "Computer Vision",
    "programme": "MCA",
    "semester": "III",
    "category": "D",
    "theoryHours_L": 3,
    "tutorialHours_T": 0,
    "practicalHours_P": 2,
    "credits_C": 4,
    "totalContactHours": 5,
    "description": "Official syllabus for Computer Vision (PCA25D09J) under SRM Regulations 2025."
  },
  {
    "code": "PCA25G04T",
    "title": "Blockchain Technology",
    "programme": "MCA",
    "semester": "III",
    "category": "G",
    "theoryHours_L": 2,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 2,
    "totalContactHours": 2,
    "description": "Official syllabus for Blockchain Technology (PCA25G04T) under SRM Regulations 2025."
  },
  {
    "code": "PCA25G05T",
    "title": "Cyber Forensics",
    "programme": "MCA",
    "semester": "III",
    "category": "G",
    "theoryHours_L": 2,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 2,
    "totalContactHours": 2,
    "description": "Official syllabus for Cyber Forensics (PCA25G05T) under SRM Regulations 2025."
  },
  {
    "code": "PCA25G06T",
    "title": "Big Data Analytics",
    "programme": "MCA",
    "semester": "III",
    "category": "G",
    "theoryHours_L": 2,
    "tutorialHours_T": 0,
    "practicalHours_P": 0,
    "credits_C": 2,
    "totalContactHours": 2,
    "description": "Official syllabus for Big Data Analytics (PCA25G06T) under SRM Regulations 2025."
  },
  {
    "code": "PCA25P01L",
    "title": "Internship",
    "programme": "MCA",
    "semester": "III",
    "category": "P",
    "theoryHours_L": 0,
    "tutorialHours_T": 0,
    "practicalHours_P": 4,
    "credits_C": 2,
    "totalContactHours": 4,
    "description": "Official syllabus for Internship (PCA25P01L) under SRM Regulations 2025."
  }
];

export const INITIAL_SECTIONS: SectionConfig[] = [
  {
    "id": "SEC_I_MCA_A",
    "name": "I MCA A",
    "programme": "MCA",
    "semester": "I",
    "studentCount": 60,
    "labBatches": 2,
    "studentsPerBatch": 30
  },
  {
    "id": "SEC_I_MCA_B",
    "name": "I MCA B",
    "programme": "MCA",
    "semester": "I",
    "studentCount": 60,
    "labBatches": 2,
    "studentsPerBatch": 30
  },
  {
    "id": "SEC_I_MCA_GA_A",
    "name": "I MCA GEN AI A",
    "programme": "MCA GEN AI",
    "semester": "I",
    "studentCount": 55,
    "labBatches": 2,
    "studentsPerBatch": 28
  },
  {
    "id": "SEC_I_MCA_GA_B",
    "name": "I MCA GEN AI B",
    "programme": "MCA GEN AI",
    "semester": "I",
    "studentCount": 60,
    "labBatches": 2,
    "studentsPerBatch": 30
  },
  {
    "id": "SEC_II_MCA_A",
    "name": "II MCA A",
    "programme": "MCA",
    "semester": "III",
    "studentCount": 65,
    "labBatches": 2,
    "studentsPerBatch": 33
  },
  {
    "id": "SEC_II_MCA_B",
    "name": "II MCA B",
    "programme": "MCA",
    "semester": "III",
    "studentCount": 63,
    "labBatches": 2,
    "studentsPerBatch": 32
  },
  {
    "id": "SEC_II_MCA_GA_A",
    "name": "II MCA GEN AI A",
    "programme": "MCA GEN AI",
    "semester": "III",
    "studentCount": 70,
    "labBatches": 2,
    "studentsPerBatch": 35
  },
  {
    "id": "SEC_II_MCA_GA_B",
    "name": "II MCA GEN AI B",
    "programme": "MCA GEN AI",
    "semester": "III",
    "studentCount": 67,
    "labBatches": 2,
    "studentsPerBatch": 34
  },
  {
    "id": "SEC_II_MCA_ELEC",
    "name": "II MCA",
    "programme": "MCA",
    "semester": "III",
    "studentCount": 46,
    "labBatches": 2,
    "studentsPerBatch": 23
  },
  {
    "id": "SEC_II_MCA_GA_ELEC",
    "name": "II MCA GEN AI",
    "programme": "MCA GEN AI",
    "semester": "III",
    "studentCount": 52,
    "labBatches": 2,
    "studentsPerBatch": 26
  },
  {
    "id": "SEC_II_UG",
    "name": "II UG",
    "programme": "MCA",
    "semester": "III",
    "studentCount": 60,
    "labBatches": 0,
    "studentsPerBatch": 60
  }
];

export const INITIAL_ALLOCATIONS: CourseAllocation[] = INITIAL_COURSES.map((c, i) => ({
  id: `ALLOC_INIT_${i}`,
  courseCode: c.code,
  courseTitle: c.title,
  programme: c.programme,
  semester: c.semester,
  section: c.programme === 'MCA GEN AI' ? 'I MCA GEN AI A' : 'I MCA A',
  studentCount: 60,
  theoryHours: c.theoryHours_L,
  practicalHours: c.practicalHours_P,
  totalHours: c.theoryHours_L + c.practicalHours_P,
  labBatches: c.practicalHours_P > 0 ? 2 : 0,
  mainFacultyId: null,
  mainFacultyName: undefined,
  asstFacultyId: null,
  asstFacultyName: undefined,
  status: 'UNALLOCATED',
}));

export const INITIAL_PREFERENCES: Record<string, FacultyPreferenceSubmission> = {};

export const INITIAL_CAMPUS_WORK: CampusWorkEntry[] = [
  {
    id: 'CW_001',
    facultyId: 'FAC001', // Dr K. Kalaiselvi
    hours: 4,
    description: 'HOD & Department Administration',
  },
  {
    id: 'CW_002',
    facultyId: 'FAC002', // Dr. R. Agusthiyar
    hours: 2,
    description: 'Academic Committee Lead',
  },
  {
    id: 'CW_003',
    facultyId: 'FAC003', // Dr S. Uma Rani
    hours: 2,
    description: 'Exam & Valuation Coordinator',
  },
];

const STORAGE_KEYS = {
  FACULTY: 'srm_erp_faculty_master_v3',
  COURSES: 'srm_erp_courses_master_v3',
  SECTIONS: 'srm_erp_sections_master_v3',
  ALLOCATIONS: 'srm_erp_allocations_v3',
  PREFERENCES: 'srm_erp_preferences_v3',
  CAMPUS_WORK: 'srm_erp_campus_work_v3',
  CURRENT_USER_ID: 'srm_erp_current_faculty_id_v3',
};

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error('Error loading stored key', key, e);
    return fallback;
  }
}

function saveStored<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Error saving key', key, e);
  }
}

export function useWorkloadData() {
  const [facultyList, setFacultyList] = useState<FacultyMember[]>(() =>
    loadStored(STORAGE_KEYS.FACULTY, INITIAL_FACULTY)
  );

  const [courseList, setCourseList] = useState<Course[]>(() =>
    loadStored(STORAGE_KEYS.COURSES, INITIAL_COURSES)
  );

  const [sectionList, setSectionList] = useState<SectionConfig[]>(() =>
    loadStored(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS)
  );

  const [allocations, setAllocations] = useState<CourseAllocation[]>(() =>
    loadStored(STORAGE_KEYS.ALLOCATIONS, INITIAL_ALLOCATIONS)
  );

  const [preferences, setPreferences] = useState<Record<string, FacultyPreferenceSubmission>>(
    () => loadStored(STORAGE_KEYS.PREFERENCES, INITIAL_PREFERENCES)
  );

  const [campusWorkList, setCampusWorkList] = useState<CampusWorkEntry[]>(() =>
    loadStored(STORAGE_KEYS.CAMPUS_WORK, INITIAL_CAMPUS_WORK)
  );

  const [currentFacultyId, setCurrentFacultyIdState] = useState<string>(() =>
    loadStored(STORAGE_KEYS.CURRENT_USER_ID, 'FAC007')
  );

  // Sync to local storage
  useEffect(() => {
    saveStored(STORAGE_KEYS.FACULTY, facultyList);
  }, [facultyList]);

  useEffect(() => {
    saveStored(STORAGE_KEYS.COURSES, courseList);
  }, [courseList]);

  useEffect(() => {
    saveStored(STORAGE_KEYS.SECTIONS, sectionList);
  }, [sectionList]);

  useEffect(() => {
    saveStored(STORAGE_KEYS.ALLOCATIONS, allocations);
  }, [allocations]);

  useEffect(() => {
    saveStored(STORAGE_KEYS.PREFERENCES, preferences);
  }, [preferences]);

  useEffect(() => {
    saveStored(STORAGE_KEYS.CAMPUS_WORK, campusWorkList);
  }, [campusWorkList]);

  useEffect(() => {
    saveStored(STORAGE_KEYS.CURRENT_USER_ID, currentFacultyId);
  }, [currentFacultyId]);

  const setCurrentFacultyId = (id: string) => {
    setCurrentFacultyIdState(id);
    saveStored(STORAGE_KEYS.CURRENT_USER_ID, id);
  };

  const updateFacultyDefaultHours = (facultyId: string, hours: number) => {
    setFacultyList((prev) =>
      prev.map((f) => (f.id === facultyId ? { ...f, defaultWorkloadHours: Math.max(0, hours) } : f))
    );
  };

  const updateFacultyMember = (updatedFaculty: FacultyMember) => {
    setFacultyList((prev) =>
      prev.map((f) => (f.id === updatedFaculty.id ? updatedFaculty : f))
    );
  };

  const addFacultyMember = (member: FacultyMember) => {
    setFacultyList((prev) => {
      const updated = [...prev, member];
      saveStored(STORAGE_KEYS.FACULTY, updated);
      return updated;
    });
  };

  const addCourse = (course: Course) => {
    setCourseList((prev) => {
      const updated = [...prev, course];
      saveStored(STORAGE_KEYS.COURSES, updated);
      return updated;
    });
  };

  const deleteFacultyMember = (id: string) => {
    setFacultyList((prev) => prev.filter((f) => f.id !== id));
    // Clear assignments
    setAllocations((prev) =>
      prev.map((a) => {
        let main = a.mainFacultyId;
        let asst = a.asstFacultyId;
        let changed = false;
        if (main === id) {
          main = null;
          changed = true;
        }
        if (asst === id) {
          asst = null;
          changed = true;
        }
        return changed
          ? {
              ...a,
              mainFacultyId: main,
              asstFacultyId: asst,
              status: main ? 'PARTIALLY_ALLOCATED' : 'UNALLOCATED',
            }
          : a;
      })
    );
    // Clear campus work
    setCampusWorkList((prev) => prev.filter((cw) => cw.facultyId !== id));
  };

  const updateAllocation = (updatedAlloc: CourseAllocation) => {
    setAllocations((prev) =>
      prev.map((a) => (a.id === updatedAlloc.id ? updatedAlloc : a))
    );
  };

  const createAllocation = (newAlloc: CourseAllocation) => {
    setAllocations((prev) => [...prev, newAlloc]);
  };

  const deleteAllocation = (id: string) => {
    setAllocations((prev) => prev.filter((a) => a.id !== id));
  };

  const addCampusWork = (entry: Omit<CampusWorkEntry, 'id'>) => {
    const newEntry: CampusWorkEntry = {
      ...entry,
      id: `CW_${Date.now()}`,
    };
    setCampusWorkList((prev) => [...prev, newEntry]);
  };

  const removeCampusWork = (id: string) => {
    setCampusWorkList((prev) => prev.filter((cw) => cw.id !== id));
  };

  const updateCampusWork = (entry: CampusWorkEntry) => {
    setCampusWorkList((prev) => prev.map((cw) => (cw.id === entry.id ? entry : cw)));
  };

  const submitFacultyPreferences = (
    facultyId: string,
    submittedPrefs: {
      courseCode: string;
      rank: number;
    }[]
  ) => {
    const faculty = facultyList.find((f) => f.id === facultyId);
    if (!faculty) return;

    const fullItems = submittedPrefs.map((p) => {
      const course = courseList.find((c) => c.code === p.courseCode);
      return {
        courseCode: p.courseCode,
        courseTitle: course?.title || p.courseCode,
        rank: p.rank,
        category: course?.category || 'C',
        programme: course?.programme || faculty.programme,
        semester: course?.semester || 'I',
        credits: course?.credits_C || 4,
        theoryHours: course?.theoryHours_L || 3,
        practicalHours: course?.practicalHours_P || 2,
      };
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const submission: FacultyPreferenceSubmission = {
      facultyId,
      facultyName: faculty.name,
      programme: faculty.programme,
      semester: 'I',
      academicYear: '2026-2027',
      submittedAt: dateStr,
      status: 'SUBMITTED',
      preferences: fullItems,
    };

    setPreferences((prev) => ({
      ...prev,
      [facultyId]: submission,
    }));
  };

  const resetAllToMockData = () => {
    setFacultyList(INITIAL_FACULTY);
    setCourseList(INITIAL_COURSES);
    setSectionList(INITIAL_SECTIONS);
    setAllocations(INITIAL_ALLOCATIONS);
    setPreferences(INITIAL_PREFERENCES);
    setCampusWorkList(INITIAL_CAMPUS_WORK);
    setCurrentFacultyId('FAC007');
    saveStored(STORAGE_KEYS.FACULTY, INITIAL_FACULTY);
    saveStored(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    saveStored(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS);
    saveStored(STORAGE_KEYS.ALLOCATIONS, INITIAL_ALLOCATIONS);
    saveStored(STORAGE_KEYS.PREFERENCES, INITIAL_PREFERENCES);
    saveStored(STORAGE_KEYS.CAMPUS_WORK, INITIAL_CAMPUS_WORK);
    saveStored(STORAGE_KEYS.CURRENT_USER_ID, 'FAC007');
  };

  // Computations
  const allWorkloads = calculateAllWorkloads(facultyList, allocations, preferences, campusWorkList);
  const currentFaculty = facultyList.find((f) => f.id === currentFacultyId) || facultyList[0];
  const currentFacultyWorkload = currentFaculty
    ? calculateFacultyWorkload(currentFaculty, allocations, preferences[currentFaculty.id], campusWorkList)
    : null;
  const currentFacultyPreferences = currentFaculty ? preferences[currentFaculty.id] : undefined;

  const dashboardMetrics = calculateDashboardMetrics(
    allWorkloads,
    allocations,
    courseList.length,
    sectionList.length
  );

  /**
   * Helper to retrieve grouped faculty for course dropdown:
   * 1) Faculty who indicated preference for this course (sorted by rank)
   * 2) Remaining faculty members
   */
  const getFacultyForCourseDropdown = (courseCode: string) => {
    const preferred: {
      faculty: FacultyMember;
      rank: number;
      remainingHours: number;
      defaultHours: number;
      allocatedHours: number;
      isOverloaded: boolean;
    }[] = [];

    const remaining: {
      faculty: FacultyMember;
      remainingHours: number;
      defaultHours: number;
      allocatedHours: number;
      isOverloaded: boolean;
    }[] = [];

    facultyList.forEach((f) => {
      const sub = preferences[f.id];
      const prefItem = sub?.preferences?.find((p) => p.courseCode === courseCode);
      const w = allWorkloads.find((x) => x.facultyId === f.id);
      const remainingHours = w ? w.remainingHours : f.defaultWorkloadHours;
      const allocatedHours = w ? w.allocatedHours : 0;
      const isOverloaded = w ? w.status === 'OVERLOADED' : false;

      if (prefItem) {
        preferred.push({
          faculty: f,
          rank: prefItem.rank,
          remainingHours,
          defaultHours: f.defaultWorkloadHours,
          allocatedHours,
          isOverloaded,
        });
      } else {
        remaining.push({
          faculty: f,
          remainingHours,
          defaultHours: f.defaultWorkloadHours,
          allocatedHours,
          isOverloaded,
        });
      }
    });

    // Sort preferred by rank ascending
    preferred.sort((a, b) => a.rank - b.rank);
    // Sort remaining by remaining hours descending
    remaining.sort((a, b) => b.remainingHours - a.remainingHours);

    return { preferred, remaining };
  };

  return {
    facultyList,
    courseList,
    sectionList,
    allocations,
    preferences,
    campusWorkList,
    currentFacultyId,
    currentFaculty,
    currentFacultyWorkload,
    currentFacultyPreferences,
    allWorkloads,
    dashboardMetrics,
    setCurrentFacultyId,
    updateFacultyDefaultHours,
    updateFacultyMember,
    addFacultyMember,
    addCourse,
    deleteFacultyMember,
    updateAllocation,
    createAllocation,
    deleteAllocation,
    addCampusWork,
    removeCampusWork,
    updateCampusWork,
    submitFacultyPreferences,
    resetAllToMockData,
    getFacultyForCourseDropdown,
  };
}
