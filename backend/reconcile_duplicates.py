from app.database.connection import SessionLocal
from app.models.domain import AllocationComponent, SubjectAllocation

db = SessionLocal()

# Find all duplicate AllocationComponents grouped by (allocation_id, faculty_id, role) or (allocation_id)
comps = db.query(AllocationComponent).all()
print(f"Total AllocationComponents before cleanup: {len(comps)}")

# Let's inspect duplicates for each allocation_id
by_alloc = {}
for c in comps:
    by_alloc.setdefault(c.allocation_id, []).append(c)

deleted_ids = []
for alloc_id, alloc_comps in by_alloc.items():
    if len(alloc_comps) > 1:
        print(f"Allocation {alloc_id} has {len(alloc_comps)} components:")
        # Check if they are duplicates for the same faculty
        # Group by faculty_id
        by_fac = {}
        for c in alloc_comps:
            by_fac.setdefault(c.faculty_id, []).append(c)
        
        for fac_id, fac_comps in by_fac.items():
            if len(fac_comps) > 1:
                # Keep the first one, delete the rest
                keep = fac_comps[0]
                to_delete = fac_comps[1:]
                print(f"  Keeping component {keep.id} (T={keep.theory_hours}, P={keep.practical_hours}, role={keep.role})")
                for d in to_delete:
                    print(f"  Deleting duplicate component {d.id} (T={d.theory_hours}, P={d.practical_hours}, role={d.role})")
                    deleted_ids.append(d.id)
                    db.delete(d)

if deleted_ids:
    db.commit()
    print(f"Successfully deleted {len(deleted_ids)} duplicate AllocationComponent rows: {deleted_ids}")
else:
    print("No duplicates found to delete.")

comps_after = db.query(AllocationComponent).all()
print(f"Total AllocationComponents after cleanup: {len(comps_after)}")
db.close()
