import os, sys, pandas as pd
BASE_DIR = 'data/institutions/FLABS/workspaces'
aiml_path = os.path.join(BASE_DIR, 'FLABS_AIML_Department_Master_Data_2026_27.xlsx')
xl = pd.ExcelFile(aiml_path)
df_o = pd.read_excel(xl, 'Curriculum_Offerings', header=1)
bsc_o = df_o[df_o['programme_code'] == 'FLABS-BSC-AIML']

from app.database.connection import SessionLocal
from app.models.domain import CurriculumOffering, Subject

db = SessionLocal()
existing_offs = db.query(CurriculumOffering).filter_by(programme_id=3).all()
existing_codes = set()
for o in existing_offs:
    s = db.query(Subject).get(o.subject_id)
    existing_codes.add((o.semester, s.course_code))

incoming_codes = set()
for _, r in bsc_o.iterrows():
    incoming_codes.add((int(r['semester']), str(r['course_code']).strip()))

print(f"Existing count: {len(existing_codes)}")
print(f"Incoming count: {len(incoming_codes)}")
print(f"In incoming but not existing (new offerings): {len(incoming_codes - existing_codes)}")
for sem, code in sorted(incoming_codes - existing_codes):
    matches = bsc_o[(bsc_o['semester'] == sem) & (bsc_o['course_code'].astype(str).str.strip() == code)]
    if len(matches) > 0:
        row = matches.iloc[0]
        print(f"  + Sem {sem}: {code} - {row['display_title']} (placeholder={row['is_placeholder']})")
    else:
        print(f"  + Sem {sem}: {code} (no details)")

print(f"In existing but not incoming: {len(existing_codes - incoming_codes)}")
for sem, code in sorted(existing_codes - incoming_codes):
    print(f"  - Sem {sem}: {code}")

db.close()
