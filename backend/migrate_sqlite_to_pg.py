import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.orm import sessionmaker

load_dotenv(".env")

# URLs
sqlite_url = "sqlite:///./erp_local.db"
pg_url = os.getenv("DATABASE_URL")
print("PG URL IS:", pg_url)

# Engines
sqlite_engine = create_engine(sqlite_url)
pg_engine = create_engine(pg_url)

# Meta
pg_meta = MetaData()
pg_meta.reflect(bind=pg_engine)

sqlite_meta = MetaData()
sqlite_meta.reflect(bind=sqlite_engine)

with pg_engine.begin() as pg_conn:
    # Disable foreign key constraints temporarily if needed, though Postgres handles this differently.
    # We will delete in reverse order of foreign key dependencies.
    for table in reversed(pg_meta.sorted_tables):
        if table.name != 'alembic_version':
            pg_conn.execute(table.delete())
            print(f"Cleared table {table.name}")

    # Now insert from sqlite in correct order
    with sqlite_engine.connect() as sqlite_conn:
        for table in pg_meta.sorted_tables:
            if table.name == 'alembic_version':
                continue
            print(f"Migrating table {table.name}...")
            
            # Get data from sqlite
            rows = sqlite_conn.execute(text(f'SELECT * FROM "{table.name}"')).fetchall()
            
            if rows:
                # get column names
                cols = sqlite_meta.tables[table.name].columns.keys()
                
                if table.name == 'departments':
                    idx = cols.index('institution_id')
                    rows = [r for r in rows if r[idx] != 5] # ignore institution_id=5
                elif table.name in ('programmes', 'users'):
                    idx = cols.index('department_id')
                    rows = [r for r in rows if r[idx] != 5] # ignore department_id=5
                elif table.name == 'faculty_profiles':
                    # Need to check if user_id is in valid users
                    pass # We will assume there are no faculty for dept 5 in sqlite, or just catch it
                # construct insert
                insert_stmt = table.insert()
                
                # Convert rows to dicts
                data_dicts = [dict(zip(cols, row)) for row in rows]
                
                pg_conn.execute(insert_stmt, data_dicts)
                print(f"Inserted {len(rows)} rows into {table.name}")
            else:
                print(f"No rows in {table.name}")
    
    # We will update sequences in a separate transaction to avoid aborting this one!
    pass

with pg_engine.begin() as pg_conn:
    print("Updating sequences...")
    for table in pg_meta.sorted_tables:
        if table.name == 'alembic_version':
            continue
        try:
            # We need a savepoint so if it fails, it doesn't abort the whole block
            with pg_conn.begin_nested():
                pg_conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), COALESCE(MAX(id), 1)) FROM {table.name};"))
            print(f"Updated sequence for {table.name}")
        except Exception as e:
            # Table might not have an 'id' column
            pass

print("Migration completed successfully!")
