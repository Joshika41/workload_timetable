import os
import sys
import openpyxl
import pandas as pd

# Set utf-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cyber_path = os.path.join(BASE_DIR, 'data', 'institutions', 'FLABS', 'workspaces', 'FLABS_Cyber_Security_Department_Master_Data_2026_27_FINAL.xlsx')
aiml_path = os.path.join(BASE_DIR, 'data', 'institutions', 'FLABS', 'workspaces', 'FLABS_AIML_Department_Master_Data_2026_27.xlsx')

def inspect_workbook(name, path):
    print(f"\n==================================================")
    print(f" WORKBOOK: {name} ({os.path.basename(path)})")
    print(f"==================================================")
    xl = pd.ExcelFile(path)
    print("Sheets:", xl.sheet_names)
    
    for s in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=s, header=1) # header is at row index 1 (2nd row)
        print(f"\n--- Sheet: {s} (rows: {len(df)}) ---")
        print("Columns:", list(df.columns))
        if len(df) > 0:
            print("First row:")
            for col in df.columns[:8]:
                print(f"  {col}: {df.iloc[0][col]}")

if __name__ == "__main__":
    inspect_workbook("CYBER SECURITY", cyber_path)
    inspect_workbook("AIML", aiml_path)
