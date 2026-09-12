import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
# Base is intentionally NOT imported/defined here anymore, it belongs in models.py
# Wait, let's keep Base here if models.py expects it from database.py, or define it in models.py.
# In models.py we have: from sqlalchemy.ext.declarative import declarative_base; Base = declarative_base()
# But wait, other routers might import Base from database.py. Let's just define it here to be safe, or just import it from models if needed.
# Actually, the user's previous models.py defined Base itself. Let's define it here just in case.
from sqlalchemy.ext.declarative import declarative_base

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set. Please set it to a valid Postgres connection string.")

# Supabase Postgres optimized connection pool
engine = create_engine(
    DATABASE_URL, 
    pool_size=5, 
    max_overflow=10,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
