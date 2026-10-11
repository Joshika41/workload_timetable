from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.models.domain import User, RoleEnum, AcademicWorkspace, Department, Institution
import json

client = TestClient(app)

def test_matrix_api():
    db = SessionLocal()
    
    ws = None
    hod = None
    hods = db.query(User).filter(User.role == RoleEnum.HOD).all()
    for h in hods:
        ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.department_id == h.department_id).first()
        if ws:
            hod = h
            break
            
    if not ws:
        print("No workspace found for any HOD. Skipping test.")
        return
        
    # Get token for HOD
    from app.auth.jwt import create_access_token
    token = create_access_token({"sub": str(hod.id), "role": RoleEnum.HOD.value})
    
    # Make request
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get(f"/api/workload/class-matrix?workspace_id={ws.id}", headers=headers)
    
    print(f"Status Code: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        print(f"Returned {len(data)} class blocks.")
        if data:
            print("First class block keys:", data[0].keys())
            print("Sections count:", len(data[0].get("sections", [])))
            print("Subjects count:", len(data[0].get("subjects", [])))
            # Check zero-section FLABS state (if Flabs)
            dept = db.query(Department).filter(Department.id == ws.department_id).first()
            if dept and dept.institution_id == 2: # FLABS
                assert len(data[0].get("sections", [])) == 0
                print("FLABS zero-section check passed.")
    else:
        print(res.json())
        
if __name__ == "__main__":
    test_matrix_api()
