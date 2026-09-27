import pdfplumber
import re
import json
import os
import glob

# Try to find something that looks like Course Code, Title, L, T, P, C
# e.g., "UAI24101J Computing Fundamentals 3 0 3 4"

pdf_files = glob.glob('d:/Joshi/workload_timetable/frontend/docs/reference/*.pdf')
print("Found PDFs:", pdf_files)

all_subjects = {}

def extract_subjects_from_pdf(filepath):
    subjects = []
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text: continue
                # Match lines like: UAI24101J Computing Fundamentals 3 0 3 4
                # U[A-Z]{2,3}[0-9]{5,6}[A-Z0-9]? 
                # Let's use a simpler pattern: 3 uppercase letters, numbers, etc.
                lines = text.split('\n')
                for line in lines:
                    # Pattern: Starts with course code (e.g. UAI24101J or MCA101)
                    # followed by text, followed by 3 or 4 numbers
                    m = re.match(r'^([A-Z]{3,4}\d{4,6}[A-Z]*)\s+(.*?)\s+(\d)\s+(\d)\s+(\d)\s*(\d)?$', line.strip())
                    if m:
                        code = m.group(1)
                        name = m.group(2).strip()
                        l = int(m.group(3))
                        t = int(m.group(4))
                        p = int(m.group(5))
                        c = m.group(6)
                        subjects.append({
                            "course_code": code,
                            "course_name": name,
                            "theory_hours": l + t,
                            "practical_hours": p,
                            "credits": int(c) if c else l+t+p,
                            "category": "CORE"
                        })
    except Exception as e:
        print(f"Error extracting from {filepath}: {e}")
    return subjects

for pdf_file in pdf_files:
    filename = os.path.basename(pdf_file)
    subs = extract_subjects_from_pdf(pdf_file)
    if subs:
        all_subjects[filename] = subs
        print(f"Extracted {len(subs)} subjects from {filename}")

with open('d:/Joshi/workload_timetable/backend/extracted_subjects.json', 'w') as f:
    json.dump(all_subjects, f, indent=2)
print("Saved to extracted_subjects.json")
