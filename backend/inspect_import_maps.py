import os
import sys
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = 'data/institutions/FLABS/workspaces'
cyber_path = os.path.join(BASE_DIR, 'FLABS_Cyber_Security_Department_Master_Data_2026_27_FINAL.xlsx')
aiml_path = os.path.join(BASE_DIR, 'FLABS_AIML_Department_Master_Data_2026_27.xlsx')

print('=== CYBER Supabase_Import_Map Details ===')
xl_c = pd.ExcelFile(cyber_path)
df_c = pd.read_excel(xl_c, 'Supabase_Import_Map', header=1)
for _, r in df_c.iterrows():
    print(f"{r['logical_table']} from {r['source_sheet']} (PK: {r['primary_key']}, FK: {r['important_foreign_keys']}, Mode: {r['import_mode']})")

print('\n=== AIML Supabase_Import_Map Details ===')
xl_a = pd.ExcelFile(aiml_path)
df_a = pd.read_excel(xl_a, 'Supabase_Import_Map', header=1)
for _, r in df_a.iterrows():
    print(f"{r['logical_table']} from {r['source_sheet']} (PK: {r['primary_key']}, FK: {r['important_foreign_keys']}, Mode: {r['import_mode']})")
