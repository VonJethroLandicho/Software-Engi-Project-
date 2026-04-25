from datetime import datetime, timedelta
def get_service_duration(service_name, service_durations=None):
    """Resolve a service duration from a provided lookup map."""
    if service_durations and service_name in service_durations:
        try:
            return int(service_durations[service_name])
        except Exception:
            return 30
    return 30

def is_time_available(existing_appointments, requested_time, requested_date, service_name, service_durations=None):
    req_duration = get_service_duration(service_name, service_durations)
    req_start = datetime.strptime(f"{requested_date} {requested_time}", "%Y-%m-%d %H:%M")
    req_end = req_start + timedelta(minutes=req_duration)

    for appt in existing_appointments:
        if appt['status'] in ['accepted', 'pending']:
            appt_dur = get_service_duration(appt['service'], service_durations)
            appt_start = datetime.strptime(f"{appt['date']} {appt['time']}", "%Y-%m-%d %H:%M")
            appt_end = appt_start + timedelta(minutes=appt_dur)

            # COLLISION MATH
            if req_start < appt_end and req_end > appt_start:
                return False
                
    return True