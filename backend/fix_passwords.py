from passlib.context import CryptContext
import sqlite3

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed_pw = pwd_context.hash("Demo@123")

conn = sqlite3.connect('university_timetable.db')
c = conn.cursor()
c.execute("UPDATE users SET hashed_password=?", (hashed_pw,))
try:
    c.execute("UPDATE users SET password_hash=?", (hashed_pw,))
except:
    pass
conn.commit()
conn.close()

print(f"Passwords updated to valid hash for Demo@123: {hashed_pw}")
