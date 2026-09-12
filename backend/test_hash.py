from passlib.context import CryptContext
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
print(pwd.verify('password123', '\'.replace('\\$', '$')))
