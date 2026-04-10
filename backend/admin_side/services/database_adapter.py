import os

def get_db():
    mode = os.getenv('DB_MODE', 'mock')
    if mode == 'mock':
        import admin_side.services.mock_database as db
        return db
    else:
        # Import firebase_sync here in the future
        pass