from pathlib import Path
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

backend_dir = Path(__file__).resolve().parent.parent.parent
root_dir = backend_dir.parent

load_dotenv(backend_dir / ".env")
load_dotenv(root_dir / ".env")

# Determine the DATABASE_URL. Use SQLite as a local fallback when Docker/Postgres are unavailable.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./erp_local.db")

if DATABASE_URL.startswith("sqlite"):
    # Normalize relative SQLite paths so they always point to backend/erp_local.db
    if ":///" in DATABASE_URL:
        db_path = DATABASE_URL.split(":///", 1)[1]
        if not os.path.isabs(db_path):
            clean_rel = db_path.lstrip("./")
            abs_db_file = (backend_dir / clean_rel).resolve()
            DATABASE_URL = f"sqlite:///{abs_db_file}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
