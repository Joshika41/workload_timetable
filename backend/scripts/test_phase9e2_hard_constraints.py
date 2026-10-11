import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.models.timetable import TimetableRoom, TimetableFacultyAvailability, TimetableSectionAvailability, TimetableRoomAvailability, TeachingSession, AvailabilityStatusEnum
from app.models.domain import Section
from scripts.run_simulation_solve import run_simulation
from scripts.seed_timetable_simulation import seed_simulation

DB_URL = "sqlite:///test_sim.db"

def setup_db(db_url):
    seed_simulation(db_url)
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal(), engine

def run_test(name, mutate_db_func, expected_status_or_violation):
    print(f"\n======================================")
    print(f"RUNNING TEST: {name}")
    print(f"======================================")
    import time
    db_url = f"sqlite:///test_sim_{name.replace(' ', '_')}_{int(time.time()*1000)}.db"
    db, engine = setup_db(db_url)
    mutate_db_func(db)
    db.close()
    engine.dispose()
    
    try:
        status, violations = run_simulation(db_url, seed_db=False)
        status_name = status.name if hasattr(status, 'name') else str(status)
        
        print(f"\n[TEST RESULT] Status: {status_name}")
        if violations:
            print("[TEST RESULT] Violations:")
            for v in violations:
                print(f" - {v}")
        
        if callable(expected_status_or_violation):
            assert expected_status_or_violation(status_name, violations)
        elif expected_status_or_violation == "INFEASIBLE":
            assert status_name == "FAILED", f"Expected FAILED but got {status_name}"
            # KAIROS might return status 3 or FAILED. The ERP sets TimetableStatusEnum.FAILED if not OPTIMAL/FEASIBLE
        else:
            assert any(expected_status_or_violation in v for v in violations), f"Expected violation '{expected_status_or_violation}' not found"
        print(f"[TEST PASSED] {name}")
    except Exception as e:
        print(f"[TEST FAILED] {name} - Exception: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            db.close()
            engine.dispose()
        except:
            pass

# Mutations

def mutate_capacity(db):
    # Make room too small for section A (students=60)
    for r in db.query(TimetableRoom).all():
        r.capacity = 30
    db.commit()

def mutate_room_type(db):
    # Make all rooms CLASSROOM, but one session needs LAB
    for r in db.query(TimetableRoom).all():
        r.room_type = "CLASSROOM"
    db.commit()

def mutate_faculty_unavailable(db):
    # Make fac_cs unavailable on all slots of all days
    from app.models.timetable import TimetableConfiguration
    config_id = db.query(TimetableConfiguration).first().id
    for d in range(7):
        for p in range(1, 7):
            db.add(TimetableFacultyAvailability(faculty_id=1, configuration_id=config_id, day_index=d, period_number=p, status=AvailabilityStatusEnum.UNAVAILABLE))
    db.commit()

def mutate_section_unavailable(db):
    # Make sec_a unavailable on all slots
    from app.models.timetable import TimetableConfiguration
    config_id = db.query(TimetableConfiguration).first().id
    for d in range(7):
        for p in range(1, 7):
            db.add(TimetableSectionAvailability(section_id=1, configuration_id=config_id, day_index=d, period_number=p, status=AvailabilityStatusEnum.UNAVAILABLE))
    db.commit()

def mutate_room_unavailable(db):
    # Make all rooms unavailable on all slots
    from app.models.timetable import TimetableConfiguration
    config_id = db.query(TimetableConfiguration).first().id
    for r in db.query(TimetableRoom).all():
        for d in range(7):
            for p in range(1, 7):
                db.add(TimetableRoomAvailability(room_id=r.id, configuration_id=config_id, day_index=d, period_number=p, status=AvailabilityStatusEnum.UNAVAILABLE))
    db.commit()

def mutate_none(db):
    pass # Feasible regression

if __name__ == "__main__":
    run_test("Room Capacity Check", mutate_capacity, "INFEASIBLE")
    
    run_test("Room Suitability Check (Lab)", mutate_room_type, "INFEASIBLE")
    
    run_test("Faculty Availability", mutate_faculty_unavailable, "INFEASIBLE")
    
    run_test("Section Availability", mutate_section_unavailable, "INFEASIBLE")
    
    run_test("Room Availability", mutate_room_unavailable, "INFEASIBLE")
    
    run_test("Feasible Regression", mutate_none, lambda st, v: st == "COMPLETED" and len(v) == 0)

