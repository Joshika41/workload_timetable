import sys
import docx
import pandas as pd
from pathlib import Path
import PyPDF2

def extract_docx(file_path):
    doc = docx.Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs])

def extract_xlsx(file_path):
    df = pd.read_excel(file_path, sheet_name=None)
    result = []
    for sheet_name, sheet_data in df.items():
        result.append(f"Sheet: {sheet_name}")
        result.append(sheet_data.to_string())
    return "\n".join(result)

def extract_pdf(file_path):
    reader = PyPDF2.PdfReader(file_path)
    result = []
    for page in reader.pages:
        result.append(page.extract_text())
    return "\n".join(result)

def main():
    docs_dir = Path(r"d:\Joshi\workload_timetable\frontend\docs\reference")
    for file_path in docs_dir.iterdir():
        print(f"--- Extracting {file_path.name} ---")
        try:
            if file_path.suffix == ".docx":
                print(extract_docx(file_path)[:2000] + "\n... (truncated)\n")
            elif file_path.suffix == ".xlsx":
                print(extract_xlsx(file_path)[:2000] + "\n... (truncated)\n")
            elif file_path.suffix == ".pdf":
                print(extract_pdf(file_path)[:2000] + "\n... (truncated)\n")
        except Exception as e:
            print(f"Error extracting {file_path.name}: {e}")

if __name__ == "__main__":
    main()
