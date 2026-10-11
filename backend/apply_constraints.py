from app.database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()
print("Adding unique constraint uq_subject_allocations_ws_sec_subj...")
try:
    db.execute(text("""
        ALTER TABLE subject_allocations 
        ADD CONSTRAINT uq_subject_allocations_ws_sec_subj 
        UNIQUE (workspace_id, section_id, subject_id);
    """))
    db.commit()
    print("Successfully added uq_subject_allocations_ws_sec_subj to subject_allocations!")
except Exception as e:
    db.rollback()
    print(f"Error adding constraint: {e}")

# Also check if we can add unique constraint on allocation_components (allocation_id, role) or (allocation_id)
# Wait, can an allocation have Incharge-1 and Incharge-2?
# In prompt:
# "However, within the SAME academic context, subject offering and section:
# - only one active faculty assignment may exist for that subject-section
# - another faculty must not be assigned that same subject in that same section
# - changing the role must not bypass this uniqueness rule"
# That means each SubjectAllocation (which is already specific to workspace_id, section_id, subject_id) can have at most one component!
# Let's check:
try:
    db.execute(text("""
        ALTER TABLE allocation_components 
        ADD CONSTRAINT uq_allocation_components_alloc_id 
        UNIQUE (allocation_id);
    """))
    db.commit()
    print("Successfully added uq_allocation_components_alloc_id to allocation_components!")
except Exception as e:
    db.rollback()
    print(f"Error adding constraint on allocation_components: {e}")

db.close()
