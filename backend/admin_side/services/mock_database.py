from admin_side.services.time_manager import is_time_available, SERVICES
from datetime import datetime, timedelta
import copy

MOCK_STATE = {
    "barbers": [
        {"id": 1, "name": "Barber 1", "status": "offline", "queue": [], "current_customer": None, "cuts_today": 0},
        {"id": 2, "name": "Barber 2", "status": "offline", "queue": [], "current_customer": None, "cuts_today": 0},
        {"id": 3, "name": "Barber 3", "status": "offline", "queue": [], "current_customer": None, "cuts_today": 0}
    ],
    "appointments": [] 
}

appt_counter = 1
walkin_counter = 1

def update_choices_availability(MOCK_STATE):
    for b in MOCK_STATE["barbers"]:
        if b["status"] == "offline": 
            b["is_valid_choice"] = False
        else:
            b["is_valid_choice"] = len(b["queue"]) < 2

def get_full_state():
    update_choices_availability(MOCK_STATE)
    return MOCK_STATE

def get_customer_state():
    update_choices_availability(MOCK_STATE)
    safe_state = copy.deepcopy(MOCK_STATE)
    for barber in safe_state["barbers"]:
        if barber["current_customer"]:
            barber["current_customer"]["name"] = "Occupied"
        for customer in barber["queue"]:
            customer["name"] = "Waiting..."
            
    # SECURITY: Scrub private info from appointments before sending to the public
    for appt in safe_state["appointments"]:
        appt["customer_name"] = "Hidden"
        appt["contact"] = "Hidden"
        
    return safe_state

def get_barber_schedule(barber_id):
    return [a for a in MOCK_STATE["appointments"] if a["barber_id"] == barber_id and a["status"] == "accepted"]

def update_barber_status(barber_id, new_status, customer_id=None):
    for barber in MOCK_STATE["barbers"]:
        if barber["id"] == barber_id:
            if barber["status"] == 'cutting' and new_status == 'available':
                barber["cuts_today"] += 1
                barber["current_customer"] = None
            if new_status == 'cutting' and customer_id is not None:
                customer = next((c for c in barber["queue"] if c["id"] == int(customer_id)), None)
                if customer:
                    barber["queue"].remove(customer)
                    # Timestamp exactly when they sit down!
                    customer["start_time"] = datetime.now().isoformat()
                    barber["current_customer"] = customer
            barber["status"] = new_status
            return True
    return False

def add_walk_in(barber_id, customer_name, service, mins):
    global walkin_counter
    get_full_state() 
    for barber in MOCK_STATE["barbers"]:
        if barber["id"] == barber_id:
            if not barber["is_valid_choice"]: return False
            barber["queue"].append({
                "id": walkin_counter, 
                "name": customer_name,
                "service": service,
                "mins": mins
            })
            walkin_counter += 1
            return True
    return False

def remove_from_queue(barber_id, customer_id):
    for barber in MOCK_STATE["barbers"]:
        if barber["id"] == barber_id:
            barber["queue"] = [c for c in barber["queue"] if c["id"] != int(customer_id)]
            get_full_state()
            return True
    return False

def edit_cut_counter(barber_id, new_count):
    for barber in MOCK_STATE["barbers"]:
        if barber["id"] == barber_id:
            barber["cuts_today"] = int(new_count)
            return True
    return False

def request_appointment(barber_id, date_str, time_str, service, customer_name, contact):
    global appt_counter
    
    try:
        req_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        today = datetime.now().date()
        days_ahead = (req_date - today).days
        if days_ahead < 1 or days_ahead > 3:
            return {"success": False, "message": "Must book 1 to 3 days in advance. No same day booking."}
    except Exception:
        pass

    try:
        req_time_obj = datetime.strptime(time_str, "%H:%M")
        start_time_obj = datetime.strptime("09:00", "%H:%M")
        end_time_obj = datetime.strptime("21:00", "%H:%M")
        
        if req_time_obj.time() < start_time_obj.time() or req_time_obj.time() > end_time_obj.time():
            return {"success": False, "message": "Booking hours are strictly between 09:00 AM and 09:00 PM."}
            
        service_duration = SERVICES.get(service, 30)
        calc_end_time = req_time_obj + timedelta(minutes=service_duration)
        
        if calc_end_time > end_time_obj:
            return {"success": False, "message": f"Cannot book '{service}' at this time. The appointment exceeds our 9:00 PM closing time."}
    except Exception:
        pass

    barber_appts = [a for a in MOCK_STATE["appointments"] if a["barber_id"] == int(barber_id)]
    if not is_time_available(barber_appts, time_str, date_str, service): 
        return {"success": False, "message": "That time is already booked."}
        
    MOCK_STATE["appointments"].append({
        "id": appt_counter,
        "barber_id": int(barber_id),
        "date": date_str,
        "time": time_str,
        "service": service,
        "customer_name": customer_name,
        "contact": contact,
        "status": "pending"
    })
    appt_counter += 1
    return {"success": True, "message": "Appointment requested successfully."}

def manage_appointment(appt_id, action):
    for appt in MOCK_STATE["appointments"]:
        if appt["id"] == appt_id:
            if action == 'accept': appt["status"] = "accepted"
            elif action == 'cancel': MOCK_STATE["appointments"].remove(appt)
            return True
    return False