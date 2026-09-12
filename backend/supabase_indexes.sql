-- supabase_indexes.sql
-- Run this in the Supabase SQL Editor to improve Outer Join performance for the Matrix

-- Indexes for Department
CREATE INDEX IF NOT EXISTS idx_department_is_active ON departments(is_active);

-- Indexes for Cohort
CREATE INDEX IF NOT EXISTS idx_cohort_department_id ON cohorts(department_id);
CREATE INDEX IF NOT EXISTS idx_cohort_program_type ON cohorts(program_type);
CREATE INDEX IF NOT EXISTS idx_cohort_semester_type ON cohorts(semester_type);
CREATE INDEX IF NOT EXISTS idx_cohort_is_active ON cohorts(is_active);

-- Indexes for Syllabus
CREATE INDEX IF NOT EXISTS idx_syllabus_program_type ON syllabus(program_type);
CREATE INDEX IF NOT EXISTS idx_syllabus_semester_type ON syllabus(semester_type);
CREATE INDEX IF NOT EXISTS idx_syllabus_is_active ON syllabus(is_active);

-- Indexes for CohortSyllabusMapping
CREATE INDEX IF NOT EXISTS idx_mapping_cohort_id ON cohort_syllabus_mapping(cohort_id);
CREATE INDEX IF NOT EXISTS idx_mapping_subject_code ON cohort_syllabus_mapping(subject_code);

-- Indexes for SubjectPreference
CREATE INDEX IF NOT EXISTS idx_preference_subject_code ON subject_preferences(subject_code);
CREATE INDEX IF NOT EXISTS idx_preference_faculty_id ON subject_preferences(faculty_id);
CREATE INDEX IF NOT EXISTS idx_preference_is_active ON subject_preferences(is_active);
