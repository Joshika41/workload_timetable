from sqlalchemy.orm import Session
from app.models.domain import FacultyProfile, PolicyConfig

class FacultyService:
    def get_faculty_target_workload(self, db: Session, faculty: FacultyProfile) -> int:
        """Resolve the canonical target workload for a faculty member."""
        # 1. If explicit faculty-specific target exists, use it.
        if faculty.target_workload is not None:
            return faculty.target_workload

        # 2. Otherwise, use the existing policy/designation fallback.
        key_map = {
            "Professor": "max_professor",
            "Associate Professor": "max_associate",
            "Assistant Professor": "max_assistant"
        }
        
        designation_cap = None
        key = None
        # More robust designation matching
        desig = (faculty.designation or "").lower()
        if "professor" in desig and "associate" not in desig and "assistant" not in desig:
            key = "max_professor"
            designation_cap = 12
        elif "associate" in desig:
            key = "max_associate"
            designation_cap = 14
        elif "assistant" in desig:
            key = "max_assistant"
            designation_cap = 16
            
        if key:
            if not hasattr(self, '_policy_cache'):
                self._policy_cache = {}
            if key not in self._policy_cache:
                policy = db.query(PolicyConfig).filter(PolicyConfig.key == key).first()
                self._policy_cache[key] = int(policy.value) if (policy and policy.value and policy.value.isdigit()) else None
            if self._policy_cache[key] is not None:
                return self._policy_cache[key]
                
        if designation_cap is not None:
            return designation_cap
            
        return 18

    def get_faculty_capacity(self, db: Session, faculty: FacultyProfile, current_teaching_hours: int) -> int:
        target = self.get_faculty_target_workload(db, faculty)
        total_workload = current_teaching_hours + (faculty.campus_work_hours or 0)
        return max(0, target - total_workload)
