import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv('.env')
e = create_engine(os.environ['DATABASE_URL'])
with e.connect() as c:
    res = c.execute(text("SELECT id, email, department_id FROM users WHERE email LIKE '%sivasankari%'")).fetchall()
    print(res)
