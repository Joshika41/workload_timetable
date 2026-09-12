from database import SessionLocal
from sqlalchemy import text
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=['bcrypt'], deprecated=['auto'])
db = SessionLocal()

try:
    result = db.execute(text("SELECT id, email FROM users WHERE email='faculty@srm.edu'")).fetchone()
    
    if not result:
        hashed = pwd_context.hash('faculty123')
        db.execute(text("INSERT INTO users (email, hashed_password, role) VALUES (:email, :pw, 'FACULTY')"), {'email': 'faculty@srm.edu', 'pw': hashed})
        db.commit()
        result = db.execute(text("SELECT id FROM users WHERE email='faculty@srm.edu'")).fetchone()
        print('Created user faculty@srm.edu id=' + str(result[0]))
    else:
        print('User faculty@srm.edu exists id=' + str(result[0]))
    
    user_id = result[0]
    
    fac = db.execute(text('SELECT id, erp_id FROM faculty WHERE user_id=:uid'), {'uid': user_id}).fetchone()
    if fac:
        db.execute(text("UPDATE faculty SET erp_id='t7t6', name='Demo Faculty', designation='Assistant Professor' WHERE user_id=:uid"), {'uid': user_id})
        db.commit()
        print('Updated faculty id=' + str(fac[0]) + ' with erp_id=t7t6')
    else:
        db.execute(text("INSERT INTO faculty (user_id, name, erp_id, designation, max_theory_hrs, max_lab_hrs, is_active) VALUES (:uid, 'Demo Faculty', 't7t6', 'Assistant Professor', 0.0, 0.0, 1)"), {'uid': user_id})
        db.commit()
        print('Created faculty profile with erp_id=t7t6')
    
    print('ERP ID: t7t6 | Email: faculty@srm.edu | Password: faculty123')
finally:
    db.close()
