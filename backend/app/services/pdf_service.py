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
        # Fetch the workload data using existing service (all workspaces in dept)
        workload_data = self.workload_service.get_faculty_workload(db, department_id, None)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        elements.append(Paragraph(f"Faculty Workload Report", styles['Title']))
        elements.append(Spacer(1, 12))
        
        # Table data
        data = [["ERP ID", "Faculty Name", "Designation", "Total Hours", "Subjects"]]
        
        for faculty in workload_data:
            subjects_str = ", ".join([s['subject_name'] for s in faculty['assignments']])
            data.append([
                faculty['erp_id'],
                faculty['faculty_name'],
                faculty['designation'],
                str(faculty['total_teaching_hours']),
                subjects_str
            ])
            
        # Create table
        table = Table(data, colWidths=[80, 150, 100, 80, 300])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1A365D")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('WORDWRAP', (0,0), (-1,-1), 'RTL'),
        ]))
        
        elements.append(table)
        doc.build(elements)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
