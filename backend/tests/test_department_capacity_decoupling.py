import unittest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.domain import Base, Department, Institution, PolicyConfig
from app.models.timetable import TimetableRoom
from app.routers.academic import save_department_capacity, get_department_capacity, DepartmentCapacityRequest

class TestDepartmentCapacityDecoupling(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)
        self.session = Session()

        # Seed institution and department
        inst = Institution(id=1, code="FLABS", name="Flabs Institute")
        dept = Department(id=5, institution_id=1, name="Computer Applications")
        self.session.add_all([inst, dept])
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_save_department_capacity_does_not_create_timetable_rooms(self):
        # Verify initial room count is 0
        self.assertEqual(self.session.query(TimetableRoom).count(), 0)

        req = DepartmentCapacityRequest(
            department_id=5,
            total_classrooms=6,
            classroom_capacity=60,
            total_labs=4,
            lab_capacity=35
        )

        # Call endpoint function
        res = save_department_capacity(req=req, db=self.session)
        self.assertTrue(res["success"])
        self.assertEqual(res["data"]["total_classrooms"], 6)

        # CRITICAL INVARIANT: No TimetableRoom rows created
        room_count = self.session.query(TimetableRoom).count()
        self.assertEqual(room_count, 0, f"Expected 0 TimetableRoom rows, but found {room_count}")

        # Verify policy_config row exists with correct values
        config = self.session.query(PolicyConfig).filter(PolicyConfig.key == "dept_5_capacity").first()
        self.assertIsNotNone(config)
        data = json.loads(config.value)
        self.assertEqual(data["total_classrooms"], 6)
        self.assertEqual(data["classroom_capacity"], 60)
        self.assertEqual(data["total_labs"], 4)
        self.assertEqual(data["lab_capacity"], 35)

        # Verify get_department_capacity retrieves it accurately
        get_res = get_department_capacity(department_id=5, db=self.session)
        self.assertEqual(get_res["total_classrooms"], 6)
        self.assertEqual(get_res["classroom_capacity"], 60)
        self.assertEqual(get_res["total_labs"], 4)
        self.assertEqual(get_res["lab_capacity"], 35)

    def test_save_department_capacity_does_not_mutate_existing_rooms(self):
        # Pre-seed a verified physical room
        verified_room = TimetableRoom(
            institution_id=1,
            room_code="REAL-101",
            room_name="Real Physical Classroom 101",
            room_type="CLASSROOM",
            capacity=70,
            active=True
        )
        self.session.add(verified_room)
        self.session.commit()

        self.assertEqual(self.session.query(TimetableRoom).count(), 1)

        req = DepartmentCapacityRequest(
            department_id=5,
            total_classrooms=10,
            classroom_capacity=55,
            total_labs=2,
            lab_capacity=40
        )
        save_department_capacity(req=req, db=self.session)

        # Pre-existing room must remain untouched
        rooms = self.session.query(TimetableRoom).all()
        self.assertEqual(len(rooms), 1)
        self.assertEqual(rooms[0].room_code, "REAL-101")
        self.assertEqual(rooms[0].capacity, 70)

if __name__ == '__main__':
    unittest.main()
