import os
from datetime import datetime, timedelta
from pymongo import MongoClient

client = MongoClient(os.getenv("MONGO_URI"))
db = client['mugshot_db']
services_col = db['services']

def get_service_duration(service_name):
    # Dynamically pull the exact minutes from the cloud database
    service = services_col.find_one({"name": service_name})
    return service["mins"] if service else 30

def is_time_available(existing_appointments, requested_time, requested_date, service_name):
    req_duration = get_service_duration(service_name)
    req_start = datetime.strptime(f"{requested_date} {requested_time}", "%Y-%m-%d %H:%M")
    req_end = req_start + timedelta(minutes=req_duration)

    for appt in existing_appointments:
        if appt['status'] in ['accepted', 'pending']:
            appt_dur = get_service_duration(appt['service'])
            appt_start = datetime.strptime(f"{appt['date']} {appt['time']}", "%Y-%m-%d %H:%M")
            appt_end = appt_start + timedelta(minutes=appt_dur)

            # COLLISION MATH
            if req_start < appt_end and req_end > appt_start:
                return False
                
    return True