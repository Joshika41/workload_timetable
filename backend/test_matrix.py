import json
from collections import namedtuple
from typing import List

# Mock objects to mimic DB
Subject = namedtuple("Subject", ["id", "course_code", "course_name", "theory_hours", "practical_hours"])
Section = namedtuple("Section", ["id", "name", "workspace_id"])
CurriculumOffering = namedtuple("CurriculumOffering", ["subject_id", "subject"])
RoleEnum = namedtuple("Role", ["value"])
AllocationComponent = namedtuple("AllocationComponent", ["faculty_id", "role", "theory_hours", "practical_hours"])
SubjectAllocation = namedtuple("SubjectAllocation", ["workspace_id", "subject_id", "section_id", "components"])
AcademicWorkspace = namedtuple("AcademicWorkspace", ["id", "programme_id", "academic_year_id", "semester_id", "programme"])
Programme = namedtuple("Programme", ["name"])
Semester = namedtuple("Semester", ["id", "semester_number"])

# Faculty map
fac_name_map = {
    1: "Mrs M. Divya",
    2: "Dr S. Chithra",
    3: "Dr S. Meenakshi",
    4: "Dr D. Kanchana"
}

def test_java_reference():
    ws_id = "test-ws"
    
    # Subject: JAVA
    # Required per section: 3 Theory + 4 Lab ? No wait, the example says:
    # Divya (3T, 2L) + Chithra (0T, 2L) = 3T, 4L total per section
    subj = Subject(id=1, course_code="JAVA101", course_name="Java Programming", theory_hours=3, practical_hours=4)
    offerings = [CurriculumOffering(subject_id=1, subject=subj)]
    
    sections = [
        Section(id=1, name="A", workspace_id=ws_id),
        Section(id=2, name="B", workspace_id=ws_id)
    ]
    
    # Allocations
    allocations = [
        SubjectAllocation(workspace_id=ws_id, subject_id=1, section_id=1, components=[
            AllocationComponent(faculty_id=1, role=RoleEnum("Incharge-1"), theory_hours=3, practical_hours=2),
            AllocationComponent(faculty_id=2, role=RoleEnum("Incharge-2"), theory_hours=0, practical_hours=2)
        ]),
        SubjectAllocation(workspace_id=ws_id, subject_id=1, section_id=2, components=[
            AllocationComponent(faculty_id=3, role=RoleEnum("Incharge-1"), theory_hours=3, practical_hours=2),
            AllocationComponent(faculty_id=4, role=RoleEnum("Incharge-2"), theory_hours=0, practical_hours=2)
        ])
    ]
    
    # Replicate calculation logic
    sections_count = len(sections)
    
    alloc_map = {1: {"A": allocations[0].components, "B": allocations[1].components}}
    
    subjects_data = []
    class_total_theory = 0
    class_total_lab = 0
    
    for off in offerings:
        s = off.subject
        req_theory = s.theory_hours * sections_count
        req_lab = s.practical_hours * sections_count
        req_total = req_theory + req_lab
        
        allocated_total = 0
        sec_data = {}
        
        for sec in sections:
            sec_name = sec.name
            comps = alloc_map[s.id].get(sec_name, [])
            
            in1 = None
            in2 = None
            for c in comps:
                t = c.theory_hours or 0
                l = c.practical_hours or 0
                tot = t + l
                allocated_total += tot
                
                c_data = {
                    "name": fac_name_map[c.faculty_id],
                    "theory": t,
                    "lab": l,
                    "total": tot
                }
                if c.role.value == "Incharge-1":
                    in1 = c_data
                elif c.role.value == "Incharge-2":
                    in2 = c_data
                    
            sec_data[sec_name] = {
                "Incharge-1": in1,
                "Incharge-2": in2
            }
            
        diff = req_total - allocated_total
        if diff == 0:
            status = "RECONCILED"
        else:
            status = "PARTIAL"
            
        class_total_theory += sum(c.theory_hours or 0 for s_comps in alloc_map[s.id].values() for c in s_comps)
        class_total_lab += sum(c.practical_hours or 0 for s_comps in alloc_map[s.id].values() for c in s_comps)
        
        subjects_data.append({
            "subject_code": s.course_code,
            "allocated_total": allocated_total,
            "required_total": req_total,
            "difference": diff,
            "status": status,
            "sections": sec_data
        })
        
    class_total = class_total_theory + class_total_lab
    
    print(json.dumps({
        "subjects": subjects_data,
        "total_hours": class_total,
        "total_theory": class_total_theory,
        "total_lab": class_total_lab
    }, indent=2))

if __name__ == "__main__":
    test_java_reference()
