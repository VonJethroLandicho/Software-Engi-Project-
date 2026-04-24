import os

def get_db():
    mode = os.getenv('DB_MODE', 'mock')
    if mode == 'mongo':
        import admin_side.services.mongo_database as db
        return db

    import admin_side.services.mongo_database as db
    return db