import os, sys, pandas as pd
BASE_DIR = 'data/institutions/FLABS/workspaces'
cyber_path = os.path.join(BASE_DIR, 'FLABS_Cyber_Security_Department_Master_Data_2026_27_FINAL.xlsx')
xl = pd.ExcelFile(cyber_path)
df_s = pd.read_excel(xl, 'Subjects', header=1)
df_o = pd.read_excel(xl, 'Curriculum_Offerings', header=1)
codes = ['PCS25D13J', 'PCS25G11J', 'PCS25D22J', 'PCS25D23J', 'PCS25C31J', 'PCS25D32J', 'PCS25D33J']
print('=== IN CYBER SECURITY SUBJECTS SHEET ===')
print(df_s[df_s['course_code'].isin(codes)][['course_code', 'course_title', 'data_status']])
print('=== IN CYBER SECURITY OFFERINGS SHEET ===')
print(df_o[df_o['course_code'].isin(codes)][['programme_code', 'semester', 'course_code', 'display_title', 'is_placeholder', 'import_scope']])
