from app.database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()
sql = """
SELECT conname, contype, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname IN ('subject_allocations', 'allocation_components');
"""
res = db.execute(text(sql)).fetchall()
for r in res:
    print(r)
db.close()
