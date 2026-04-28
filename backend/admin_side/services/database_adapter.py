import os
import importlib

def get_db():
    mode = os.getenv('DB_MODE', 'mock')
    module_name = 'admin_side.services.mongo_database'

    # Current project stores operational data in MongoDB.
    # Keep mode check for compatibility, but load same backend for now.
    if mode != 'mongo':
        module_name = 'admin_side.services.mongo_database'

    try:
        db = importlib.import_module(module_name)
        if hasattr(db, 'init_storage'):
            db.init_storage()
        return db
    except Exception as e:
        raise RuntimeError(
            f"Database initialization failed for '{module_name}'. "
            f"Check MONGO_URI/network/TLS certificates. Root error: {e}"
        ) from e