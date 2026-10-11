import os, sys, pandas as pd
sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = 'data/institutions/FLABS/workspaces'
cyber_path = os.path.join(BASE_DIR, 'FLABS_Cyber_Security_Department_Master_Data_2026_27_FINAL.xlsx')
xl = pd.ExcelFile(cyber_path)
df_dq = pd.read_excel(xl, 'Data_Quality_Notes', header=1)
for _, r in df_dq.iterrows():
    print(dict(r))
