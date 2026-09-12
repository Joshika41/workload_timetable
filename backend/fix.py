with open('seed_users.py', 'r') as f:
    content = f.read()

new_content = content.replace('db.commit()', '''
        print("\nSeeding admin and dean users...")
        for default_user in [("admin", Role.ADMIN), ("dean", Role.DEAN)]:
            username, role = default_user
            if not db.query(User).filter(User.username == username).first():
                db.add(User(username=username, password_hash=get_password_hash("password123"), role=role))
                print(f"Created {username} user")
        db.commit()''', 1)

with open('seed_users.py', 'w') as f:
    f.write(new_content)
