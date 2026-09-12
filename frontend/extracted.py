def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Helper function to clean up Pandas DataFrames parsed from Excel."""
    df = df.dropna(how='all')
    
    # Strip whitespace, lowercase, and replace spaces with underscores for headers
    df.columns = df.columns.astype(str).str.strip().str.lower().str.replace(' ', '_')
    
    # Alias Mapping Dictionary for extreme resilience
    alias_map = {
        'facultyid': 'faculty_id',
        'id': 'faculty_id',
        'faculty_name': 'name',
        'dept': 'department',
        'limit': 'max_hours_limit',
        'max_hours': 'max_hours_limit',
        'max_limit': 'max_hours_limit',
        'theory': 'theory_hours',
        'lab': 'lab_hours',
        'incharge': 'incharge_hours'
    }
    df = df.rename(columns=alias_map)
    
    for col in df.select_dtypes(include=['object']):
        df[col] = df[col].astype(str).str.strip()
        
    df = df.where(pd.notnull(df), None)
    return df

@app.post("/api/admin/upload-metadata")
async def upload_metadata(
    syllabus_file: Optional[UploadFile] = File(None),
    faculty_file: Optional[UploadFile] = File(None),
    rooms_file: Optional[UploadFile] = File(None),
    total_hours_file: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    type: Optional[str] = Form(None),
    file_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.value != "ADMIN":
        raise HTTPException(status_code=403, detail="Only admins can upload metadata.")
        
    try:
        parsed_results = {}

        def process_df(df, hint=None):
            cols = list(df.columns)
            if 'course_code' in cols or hint == 'syllabus':
                db.query(Syllabus).delete()
                # Drop rows where course_code is missing
                df = df.dropna(subset=['course_code']) if 'course_code' in df.columns else df
                for _, row in df.iterrows():
                    if row.get('course_code'):
                        db.add(Syllabus(
                            course_code=str(row.get('course_code')),
                            course_title=str(row.get('course_title', '')),
                            course_type=str(row.get('course_type', '')),
                            category=str(row.get('category', ''))
                        ))
            elif 'room_number' in cols or hint == 'rooms':
                db.query(Room).delete()
                df = df.dropna(subset=['room_number']) if 'room_number' in df.columns else df
                for _, row in df.iterrows():
                    if row.get('room_number'):
                        capacity = row.get('capacity', 0)
                        db.add(Room(
                            room_number=str(row.get('room_number')),
                            room_type=str(row.get('room_type', '')),
                            capacity=int(capacity) if pd.notnull(capacity) else 0
                        ))
            elif 'max_hours_limit' in cols or hint == 'total_hours':
                db.query(WorkloadConfiguration).delete()
                df = df.dropna(subset=['faculty_id']) if 'faculty_id' in df.columns else df
                for _, row in df.iterrows():
                    if row.get('faculty_id'):
                        max_limit = row.get('max_hours_limit', 16)
                        db.add(WorkloadConfiguration(
                            faculty_id=str(row.get('faculty_id')),
                            max_hours_limit=int(max_limit) if pd.notnull(max_limit) else 16
                        ))
            elif 'name' in cols and 'faculty_id' in cols or hint == 'faculty':
                db.query(Faculty).delete()
                df = df.dropna(subset=['faculty_id']) if 'faculty_id' in df.columns else df
                
                faculty_list = []
                for _, row in df.iterrows():
                    f_id = row.get('faculty_id')
                    if f_id:
                        fac = Faculty(
                            id=str(f_id),
                            name=str(row.get('name', '')),
                            department=str(row.get('department', ''))
                        )
                        db.add(fac)
                        faculty_list.append({
                            "faculty_id": str(f_id),
                            "name": str(row.get('name', '')),
                            "department": str(row.get('department', '')),
                            "theory_hours": 0,
                            "lab_hours": 0,
                            "incharge_hours": 0,
                            "max_hours_limit": 16
                        })
                parsed_results["faculty"] = faculty_list

        files_to_process = [
            (syllabus_file, 'syllabus'),
            (faculty_file, 'faculty'),
            (rooms_file, 'rooms'),
            (total_hours_file, 'total_hours'),
            (file, type or file_type)
        ]
        
        for f, hint in files_to_process:
            if f:
                process_df(clean_dataframe(pd.read_excel(io.BytesIO(await f.read()))), hint)

        db.commit()

        # Update returned max_hours_limit from the newly inserted WorkloadConfigurations
        if "faculty" in parsed_results:
            limits = {w.faculty_id: w.max_hours_limit for w in db.query(WorkloadConfiguration).all()}
            for f in parsed_results["faculty"]:
                f["max_hours_limit"] = limits.get(f["faculty_id"], 16)

        return {
            "message": "Successfully processed and uploaded metadata.", 
            "success": True,
            **parsed_results
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to process files: {str(e)}")
