from datetime import datetime, timedelta

# Official Service Durations (in minutes)
SERVICES = {
    "Haircut": 30,
    "Haircut & Style": 45,
    "Haircut & Shave": 60,
    "Kiddie MugShot": 45,
    "MugShot Favorite": 60,
    "MugShot Sulit": 45,
    "MugShot Supreme": 90,
    "MugShot Elite": 120,
    "Scalp / Hair Treatment": 45,
    "Beard Sculpting": 20,
    "Shave": 30,
    "Hair Coloring": 120,
    "Hair Art": 30,
    "Shampoo & Blow dry": 15
}

def get_service_duration(service_name):
    return SERVICES.get(service_name, 30) # Default to 30 mins if not found

def is_time_available(existing_appointments, requested_time, requested_date, service):
    # Calculate the requested block: Start Time to End Time
    req_duration = get_service_duration(service)
    req_start = datetime.strptime(f"{requested_date} {requested_time}", "%Y-%m-%d %H:%M")
    req_end = req_start + timedelta(minutes=req_duration)

    for appt in existing_appointments:
        # Check against both pending and accepted appointments so they don't double-book
        if appt['status'] in ['accepted', 'pending']:
            appt_dur = get_service_duration(appt['service'])
            appt_start = datetime.strptime(f"{appt['date']} {appt['time']}", "%Y-%m-%d %H:%M")
            appt_end = appt_start + timedelta(minutes=appt_dur)

            # COLLISION MATH: If the new start is before the old end, AND the new end is after the old start
            if req_start < appt_end and req_end > appt_start:
                return False
                
    return True