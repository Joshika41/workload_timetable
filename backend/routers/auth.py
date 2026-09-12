import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional
import jwt
import models
from database import SessionLocal

router = APIRouter()

SECRET_KEY = os.environ["JWT_SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour sessions

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ─── RBAC: ADMIN is the omnipotent role ───────────────
ADMIN_ROLES = {"ADMIN"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def _get_role_str(user: models.User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)

def verify_admin_role(current_user: models.User = Depends(get_current_user)):
    """Grants access to ADMIN role."""
    if _get_role_str(current_user) not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required.")
    return current_user

def verify_faculty_role(current_user: models.User = Depends(get_current_user)):
    if _get_role_str(current_user) != "FACULTY":
        raise HTTPException(status_code=403, detail="Forbidden: Faculty access required.")
    return current_user

# ─── Login ────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/api/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    role_str = _get_role_str(user)
    access_token = create_access_token(
        data={"sub": str(user.id), "role": role_str},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# ─── Create User (Admin-only, RBAC-consolidated) ───────────────────────────────
class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str
    faculty_id: Optional[int] = None
    send_email: bool = True

@router.post("/api/auth/create-user")
def create_user(
    request: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_admin_role)
):
    existing = db.query(models.User).filter(models.User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = get_password_hash(request.password)

    requested_role = request.role.upper()
    role_enum = {
        "FACULTY": models.RoleEnum.FACULTY,
        "DEAN": models.RoleEnum.DEAN,
        "ADMIN": models.RoleEnum.ADMIN,
    }.get(requested_role, models.RoleEnum.FACULTY)

    new_user = models.User(
        email=request.email,
        hashed_password=hashed_pw,
        role=role_enum
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Link to faculty profile if provided
    if requested_role == "FACULTY" and request.faculty_id:
        faculty_record = db.query(models.Faculty).filter(models.Faculty.id == request.faculty_id).first()
        if faculty_record:
            faculty_record.user_id = new_user.id
            db.commit()

    # Try SMTP dispatch if configured
    email_sent = False
    if request.send_email:
        smtp_host = os.environ.get("SMTP_HOST")
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASS")
        smtp_port = int(os.environ.get("SMTP_PORT", 587))

        if smtp_host and smtp_user and smtp_pass:
            try:
                msg = MIMEMultipart()
                msg["From"] = smtp_user
                msg["To"] = request.email
                msg["Subject"] = "Your SRM ERP Account Credentials"
                body = (
                    f"Dear User,\n\n"
                    f"Your ERP account has been created.\n\n"
                    f"Login Email: {request.email}\n"
                    f"Temporary Password: {request.password}\n\n"
                    f"Please log in and change your password immediately.\n\n"
                    f"Portal: http://localhost:8080\n\n"
                    f"Regards,\nSRM ERP Administration"
                )
                msg.attach(MIMEText(body, "plain"))
                server = smtplib.SMTP(smtp_host, smtp_port)
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
                server.quit()
                email_sent = True
            except Exception as e:
                print(f"[SMTP FAIL] {e}")
        else:
            print(f"[SMTP MOCK] Credentials for {request.email}: {request.password}")

    return {
        "message": "User created successfully",
        "user_id": new_user.id,
        "email": request.email,
        "role": role_enum.value,
        "email_sent": email_sent
    }

# ─── Send Credentials to Existing Faculty ─────────────────────────────────────
class SendCredentialsRequest(BaseModel):
    faculty_id: int
    new_password: Optional[str] = None

@router.post("/api/admin/send-credentials")
def send_credentials(
    request: SendCredentialsRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_admin_role)
):
    """Re-send (or generate) credentials for an existing faculty member."""
    faculty = db.query(models.Faculty).filter(models.Faculty.id == request.faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    user = db.query(models.User).filter(models.User.id == faculty.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Faculty has no user account. Use Generate Credentials first.")

    import secrets as secrets_mod
    temp_password = request.new_password or secrets_mod.token_urlsafe(10)
    user.hashed_password = get_password_hash(temp_password)
    db.commit()

    email_sent = False
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_user_env = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))

    if smtp_host and smtp_user_env and smtp_pass:
        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_user_env
            msg["To"] = user.email
            msg["Subject"] = "Your SRM ERP Login Credentials"
            body = (
                f"Dear {faculty.name},\n\n"
                f"Your ERP credentials have been updated.\n\n"
                f"Login Email: {user.email}\n"
                f"Temporary Password: {temp_password}\n\n"
                f"Please log in at http://localhost:8080 and update your password.\n\n"
                f"Regards,\nSRM ERP Administration"
            )
            msg.attach(MIMEText(body, "plain"))
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(smtp_user_env, smtp_pass)
            server.send_message(msg)
            server.quit()
            email_sent = True
        except Exception as e:
            print(f"[SMTP FAIL] {e}")

    return {
        "message": "Credentials updated" + (" and emailed" if email_sent else " (SMTP not configured, copy manually)"),
        "faculty_name": faculty.name,
        "email": user.email,
        "temp_password": temp_password,  # Always returned so admin can copy if SMTP not set up
        "email_sent": email_sent
    }

# ─── Fetch all faculty list for admin ─────────────────────────────────────────
@router.get("/api/admin/faculty-list")
def get_faculty_list(db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    faculties = db.query(models.Faculty).filter(models.Faculty.is_active == True).all()
    result = []
    for f in faculties:
        user = db.query(models.User).filter(models.User.id == f.user_id).first()
        result.append({
            "id": f.id,
            "faculty_id": f.id,
            "name": f.name,
            "erp_id": getattr(f, "erp_id", None),
            "designation": f.designation,
            "department": getattr(f, "department", None),
            "email": user.email if user else None,
            "has_account": user is not None,
        })
    return result

