import sys

file_path = 'c:/Users/Dhana/Downloads/workload-backend/routers/preferences.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    return {
        "faculty_department": faculty_rec.department if faculty_rec else None,
        "subjects": ['''

replacement = '''    if not syllabus_records:
        return {"faculty_department": faculty_rec.department if faculty_rec else None, "subjects": [], "constraints": []}
        
    return {
        "faculty_department": faculty_rec.department if faculty_rec else None,
        "subjects": ['''

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated backend route successfully.')
else:
    print('Target string not found in preferences.py')
