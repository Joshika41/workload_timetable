import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '..', 'erp_local.db')

def run():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # 1. Add code column if it doesn't exist
    try:
        cur.execute("ALTER TABLE institutions ADD COLUMN code VARCHAR DEFAULT ''")
    except sqlite3.OperationalError:
        pass # Column might already exist
        
    # 2. Identify Flabs and FLABS
    cur.execute("SELECT id, name, code FROM institutions")
    institutions = cur.fetchall()
    print(f"Current institutions: {institutions}")
    
    flabs_id = None
    flabs_upper_id = None
    
    for i_id, name, code in institutions:
        if name == "Flabs":
            flabs_id = i_id
        elif name == "FLABS":
            flabs_upper_id = i_id
            
    if flabs_id and flabs_upper_id:
        print(f"Merging {flabs_upper_id} (FLABS) into {flabs_id} (Flabs)")
        
        # Inventory references
        cur.execute("SELECT id, name FROM departments WHERE institution_id = ?", (flabs_upper_id,))
        depts = cur.fetchall()
        print(f"Repointing {len(depts)} departments from FLABS to Flabs")
        
        # Repoint
        cur.execute("UPDATE departments SET institution_id = ? WHERE institution_id = ?", (flabs_id, flabs_upper_id))
        
        # Delete duplicate
        cur.execute("DELETE FROM institutions WHERE id = ?", (flabs_upper_id,))
        print("Deleted duplicate FLABS institution")
    
    # Assign canonical codes
    code_map = {
        "E&T": "ET",
        "Flabs": "FLABS",
        "Management": "MGMT",
        "B-Arch": "BARCH"
    }
    
    for i_id, name, code in institutions:
        if name in code_map:
            cur.execute("UPDATE institutions SET code = ? WHERE id = ?", (code_map[name], i_id))
            
    conn.commit()
    
    cur.execute("SELECT id, name, code FROM institutions")
    print(f"Final institutions: {cur.fetchall()}")
    
    conn.close()

if __name__ == "__main__":
    run()
