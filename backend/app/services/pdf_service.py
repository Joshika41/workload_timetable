from io import BytesIO
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from app.services.workload_service import WorkloadService

class PDFService:
    def __init__(self):
        self.workload_service = WorkloadService()

    def generate_workload_pdf(self, db: Session, department_id: int) -> bytes:
        from app.models.domain import Department
        dept = db.query(Department).filter(Department.id == department_id).first()
        dept_name = dept.name if dept else "Department"
        inst_name = dept.institution.name if dept and dept.institution else "Institution"

        workload_data = self.workload_service.get_faculty_workload(db, department_id, None, finalized_only=False)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = styles['Normal']
        title_style.fontName = 'Helvetica-Bold'
        title_style.fontSize = 11
        title_style.alignment = 1 # Center
        
        elements.append(Paragraph(f"SRM INSTITUTE OF SCIENCE AND TECHNOLOGY", title_style))
        elements.append(Paragraph(f"{inst_name.upper()}", title_style))
        elements.append(Paragraph(f"{dept_name.upper()}", title_style))
        elements.append(Paragraph(f"STAFF WORKLOAD FOR ACADEMIC YEAR", title_style))
        elements.append(Spacer(1, 20))
        
        # Headers
        data = [["S.No", "Staff Name", "Subject Code", "Course Name", "Class & Section", "Th", "Pr", "Hrs"]]
        
        row_spans = []
        current_row = 1
        
        for idx, faculty in enumerate(workload_data):
            assignments = faculty.get('assignments', [])
            if not assignments:
                continue
                
            start_row = current_row
            total_faculty_hours = faculty.get('total_teaching_hours', 0)
            
            for j, subj in enumerate(assignments):
                sno = str(idx + 1) if j == 0 else ""
                staff_name = f"{faculty['faculty_name']}\n({faculty['designation']})" if j == 0 else ""
                tot = str(total_faculty_hours) if j == 0 else ""
                
                data.append([
                    sno,
                    staff_name,
                    subj.get('subject_code', ''),
                    subj.get('subject_name', ''),
                    f"{subj.get('class_type', '')} {subj.get('section', '')}".strip(),
                    str(subj.get('theory_hours', 0)),
                    str(subj.get('practical_hours', 0)),
                    tot
                ])
                current_row += 1
                
            if len(assignments) > 1:
                row_spans.append(('SPAN', (0, start_row), (0, current_row - 1)))
                row_spans.append(('SPAN', (1, start_row), (1, current_row - 1)))
                row_spans.append(('SPAN', (7, start_row), (7, current_row - 1)))
            
        # Create table
        table = Table(data, colWidths=[30, 130, 80, 200, 140, 30, 30, 30])
        
        base_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#000000")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('WORDWRAP', (0,0), (-1,-1), 'RTL'),
        ]
        
        # Add alternating row colors or just white for data
        base_style.append(('BACKGROUND', (0, 1), (-1, -1), colors.white))
        
        for span in row_spans:
            base_style.append(span)
            
        table.setStyle(TableStyle(base_style))
        
        elements.append(table)
        doc.build(elements)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
