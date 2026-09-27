from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, academic, faculty, preferences, allocation, workload

app = FastAPI(
    title="Workload and Timetable Portal API",
    description="Backend API for SRM University Workload and Timetable Portal (Phase A)",
    version="1.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8080", "http://127.0.0.1:5173"], # For dev only. Update for prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(academic.router, prefix="/api", tags=["Academic Context"])
app.include_router(faculty.router, prefix="/api/faculty", tags=["Faculty"])
app.include_router(preferences.router, prefix="/api", tags=["Preferences"])
app.include_router(allocation.router, prefix="/api/allocations", tags=["Allocations"])
app.include_router(workload.router, prefix="/api/workload", tags=["Workload"])

@app.get("/health")
def health_check():
    return {"status": "ok"}

