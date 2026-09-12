import sqlite3
from database import engine, Base

def sync():
    conn = sqlite3.connect('university_timetable.db')
    c = conn.cursor()
    
    # 1. Drop workload_allocations so create_all can recreate it with correct schema
    try:
        c.execute("DROP TABLE workload_allocations;")
    except:
        pass
        
    # 2. Alter faculty to add faculty_id and department if missing
    try:
        c.execute("ALTER TABLE faculty ADD COLUMN faculty_id VARCHAR;")
        c.execute("UPDATE faculty SET faculty_id = CAST(id AS VARCHAR);")
    except Exception as e:
        print("faculty_id already exists or error:", e)
        
    try:
        c.execute("ALTER TABLE faculty ADD COLUMN department VARCHAR DEFAULT 'MCA';")
    except Exception as e:
        print("department already exists or error:", e)
        
    conn.commit()
    conn.close()

    # 3. Create missing tables defined in database.py
    Base.metadata.create_all(bind=engine)
    print("Database synced successfully.")

if __name__ == "__main__":
    sync()
