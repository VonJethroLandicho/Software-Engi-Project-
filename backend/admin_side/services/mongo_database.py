import os
import copy
from datetime import datetime, timedelta
from pymongo import MongoClient
from admin_side.services.time_manager import is_time_available

client = MongoClient(os.getenv("MONGO_URI"))
db = client['mugshot_db']

barbers_col = db['barbers']
appts_col = db['appointments']
users_col = db['users']            
reports_col = db['daily_reports'] 
services_col = db['services']
settings_col = db['settings'] 

def seed_database():
    if barbers_col.count_documents({}) == 0:
        initial_barbers = [
            {"id": 1, "name": "Barber 1", "status": "offline", "queue": [], "current_customer": None, "cuts_today": 0, "completed_services": []},
            {"id": 2, "name": "Barber 2", "status": "offline", "queue": [], "current_customer": None, "cuts_today": 0, "completed_services": []},
            {"id": 3, "name": "Barber 3", "status": "offline", "queue": [], "current_customer": None, "cuts_today": 0, "completed_services": []}
        ]
        barbers_col.insert_many(initial_barbers)

    if services_col.count_documents({}) == 0:
        initial_services = [
            { "name": "Haircut", "price": "P200", "desc": "With blow dry & pomade", "mins": 30, "available": True },
            { "name": "Haircut & Style", "price": "P240", "desc": "With shampoo, blow dry & pomade", "mins": 45, "available": True },
            { "name": "Haircut & Shave", "price": "P300", "desc": "With shave, shampoo, blow dry & pomade", "mins": 60, "available": True },
            { "name": "Kiddie MugShot", "price": "P270", "desc": "Haircut for kids aged 1 to 6", "mins": 45, "available": True },
            { "name": "MugShot Favorite", "price": "P400", "desc": "Cut, shampoo, blow dry, pomade & body massage", "mins": 60, "available": True },
            { "name": "MugShot Sulit", "price": "P350", "desc": "Cut, blow dry, pomade & body massage", "mins": 45, "available": True },
            { "name": "MugShot Supreme", "price": "P550", "desc": "Cut, beard sculpt/shave, wash, pomade & massage", "mins": 90, "available": True },
            { "name": "MugShot Elite", "price": "P700", "desc": "Cut, scalp treatment, wash, pomade & massage", "mins": 120, "available": True },
            { "name": "Scalp / Hair Treatment", "price": "P420", "desc": "With scalp massage, shampoo, blow dry & pomade", "mins": 45, "available": True },
            { "name": "Beard Sculpting", "price": "P200", "desc": "Standard beard shaping/trimming", "mins": 20, "available": True },
            { "name": "Shave", "price": "P150", "desc": "Full clean shave", "mins": 30, "available": True },
            { "name": "Hair Coloring", "price": "P470", "desc": "Basic colors only", "mins": 120, "available": True },
            { "name": "Hair Art", "price": "P150", "desc": "Depends on design complexity", "mins": 30, "available": True },
            { "name": "Shampoo & Blow dry", "price": "P110", "desc": "With pomade", "mins": 15, "available": True }
        ]
        services_col.insert_many(initial_services)

    if settings_col.count_documents({"_id": "global_clock"}) == 0:
        settings_col.insert_one({"_id": "global_clock", "offset_ms": 0})

seed_database()

def get_time_offset():
    doc = settings_col.find_one({"_id": "global_clock"})
    return doc.get("offset_ms", 0) if doc else 0

def get_now():
    offset_ms = get_time_offset()
    return datetime.now() + timedelta(milliseconds=offset_ms)

def set_global_time(offset_ms):
    settings_col.update_one({"_id": "global_clock"}, {"$set": {"offset_ms": int(offset_ms)}}, upsert=True)
    return True

def generate_id():
    return int(get_now().timestamp() * 1000) % 10000000

def add_service(name, price, desc, mins):
    services_col.insert_one({"name": name, "price": price, "desc": desc, "mins": int(mins), "available": True})
    return True

def edit_service(old_name, new_name, price, desc, mins):
    services_col.update_one(
        {"name": old_name}, 
        {"$set": {"name": new_name, "price": price, "desc": desc, "mins": int(mins)}}
    )
    return True

def remove_service(name):
    services_col.delete_one({"name": name})
    return True

def toggle_service_availability(name):
    svc = services_col.find_one({"name": name})
    if svc:
        current_status = svc.get("available", True)
        services_col.update_one({"name": name}, {"$set": {"available": not current_status}})
        return True
    return False

def sync_user_to_mongo(uid, email, display_name=None):
    user_data = {"uid": uid, "email": email, "last_login": datetime.utcnow()} 
    if display_name: user_data["name"] = display_name
    users_col.update_one({"uid": uid}, {"$set": user_data}, upsert=True)
    return True

def get_last_appointment(uid):
    last_appt = appts_col.find_one({"uid": uid}, sort=[("id", -1)], projection={"_id": 0})
    if last_appt: return {"found": True, "data": last_appt}
    return {"found": False}

def add_barber(name):
    new_barber = {
        "id": generate_id(), "name": name, "status": "offline", 
        "queue": [], "current_customer": None, "cuts_today": 0, "completed_services": []
    }
    barbers_col.insert_one(new_barber)
    return True

def remove_barber(barber_id):
    res = barbers_col.delete_one({"id": int(barber_id)})
    return res.deleted_count > 0

def save_current_records():
    barbers = list(barbers_col.find({}, {"_id": 0}))
    now = get_now() 

    iso_date = now.strftime("%Y-%m-%d") 
    display_date = now.strftime("%A, %B %d, %Y")

    existing = reports_col.find_one({"iso_date": iso_date}) or {
        "iso_date": iso_date, "display_date": display_date,
        "total_cuts": 0, "barbers": [], "services_breakdown": {}, "detailed_logs": []
    }

    merged_barbers = {}
    for b in existing.get("barbers", []):
        merged_barbers[b["name"]] = {"cuts": b.get("cuts", 0), "services": b.get("services", {})}
    
    merged_services = existing.get("services_breakdown", {})
    detailed_logs = existing.get("detailed_logs", [])
    current_live_cuts = 0

    for b in barbers:
        b_name = b["name"]
        b_cuts = b.get("cuts_today", 0)
        current_live_cuts += b_cuts
        
        if b_name not in merged_barbers:
            merged_barbers[b_name] = {"cuts": 0, "services": {}}
            
        merged_barbers[b_name]["cuts"] += b_cuts

        for record in b.get("completed_services", []):
            if isinstance(record, dict):
                svc_name = record.get("service", "Unknown")
                merged_services[svc_name] = merged_services.get(svc_name, 0) + 1
                merged_barbers[b_name]["services"][svc_name] = merged_barbers[b_name]["services"].get(svc_name, 0) + 1
                
                record["barber_name"] = b_name
                detailed_logs.append(record)
            else:
                merged_services[record] = merged_services.get(record, 0) + 1
                merged_barbers[b_name]["services"][record] = merged_barbers[b_name]["services"].get(record, 0) + 1

    new_total_cuts = existing.get("total_cuts", 0) + current_live_cuts
    final_barber_list = [{"name": k, "cuts": v["cuts"], "services": v["services"]} for k, v in merged_barbers.items()]

    reports_col.update_one(
        {"iso_date": iso_date},
        {"$set": {
            "display_date": display_date,
            "total_cuts": new_total_cuts,
            "barbers": final_barber_list,
            "services_breakdown": merged_services,
            "detailed_logs": detailed_logs
        }},
        upsert=True
    )
    
    barbers_col.update_many({}, {"$set": {"cuts_today": 0, "completed_services": []}})
    return True

def delete_history_record(iso_date):
    res = reports_col.delete_one({"iso_date": iso_date})
    return res.deleted_count > 0

def get_calendar_history():
    return list(reports_col.find({}, {"_id": 0}).sort("iso_date", -1))

def get_full_state():
    barbers = list(barbers_col.find({}, {"_id": 0}))
    
    # --- NEW: Dynamic Queue Limit Logic ---
    # Find all barbers who are currently clocked in
    online_barbers = [b for b in barbers if b["status"] != "offline"]
    
    if online_barbers:
        # Find the shortest line among all active barbers
        min_queue = min(len(b.get("queue", [])) for b in online_barbers)
        # Math: If min is 0 or 1, limit is 2. If min is 2 or 3, limit is 4. If 4 or 5, limit is 6.
        dynamic_limit = (min_queue // 2) * 2 + 2
    else:
        dynamic_limit = 2
        
    for b in barbers:
        b["current_limit"] = dynamic_limit # Pass the limit to the frontend
        if b["status"] == "offline": 
            b["is_valid_choice"] = False
        else: 
            b["is_valid_choice"] = len(b.get("queue", [])) < dynamic_limit
            
    appointments = list(appts_col.find({}, {"_id": 0}))
    services = list(services_col.find({}, {"_id": 0}))
    
    return {
        "barbers": barbers, 
        "appointments": appointments, 
        "services": services, 
        "time_offset": get_time_offset(),
        "current_limit": dynamic_limit
    }

def get_customer_state():
    safe_state = copy.deepcopy(get_full_state())
    for barber in safe_state["barbers"]:
        if barber.get("current_customer"): barber["current_customer"]["name"] = "Occupied"
        for customer in barber.get("queue", []): customer["name"] = "Waiting..."
    for appt in safe_state["appointments"]:
        appt["customer_name"] = "Hidden"
        appt["contact"] = "Hidden"
    return safe_state

def get_barber_schedule(barber_id):
    return list(appts_col.find({"barber_id": int(barber_id), "status": "accepted"}, {"_id": 0}))

def update_barber_status(barber_id, new_status, customer_id=None):
    barber = barbers_col.find_one({"id": int(barber_id)})
    if not barber: return False

    if barber["status"] == 'cutting' and new_status == 'cutting':
        return False

    if barber["status"] == 'cutting' and new_status == 'available':
        barber["cuts_today"] += 1
        if barber.get("current_customer") and "service" in barber["current_customer"]:
            cust = barber["current_customer"]
            start_str = cust.get("start_time")
            end_time = get_now()
            
            if start_str:
                start_time = datetime.fromisoformat(start_str)
                total_mins = int((end_time - start_time).total_seconds() / 60)
                start_fmt = start_time.strftime("%I:%M %p")
            else:
                start_fmt = "Unknown"
                total_mins = 0
            
            end_fmt = end_time.strftime("%I:%M %p")

            completed_record = {
                "service": cust.get("service", "Unknown"),
                "customer": cust.get("name", "Unknown"),
                "type": cust.get("type", "Walk-in"),
                "time_seated": start_fmt,
                "time_finished": end_fmt,
                "total_minutes": total_mins
            }
            
            completed = barber.get("completed_services", [])
            completed.append(completed_record)
            barber["completed_services"] = completed
        barber["current_customer"] = None

    if new_status == 'cutting' and customer_id is not None:
        customer = next((c for c in barber["queue"] if c["id"] == int(customer_id)), None)
        if customer:
            barber["queue"].remove(customer)
            customer["start_time"] = get_now().isoformat() 
            customer["type"] = "Walk-in"
            barber["current_customer"] = customer

    barber["status"] = new_status
    barbers_col.update_one({"id": int(barber_id)}, {"$set": {
        "status": barber["status"], "cuts_today": barber["cuts_today"],
        "current_customer": barber["current_customer"], "queue": barber["queue"],
        "completed_services": barber.get("completed_services", [])
    }})
    return True

def add_walk_in(barber_id, customer_name, service, mins):
    state = get_full_state() 
    barber = next((b for b in state["barbers"] if b["id"] == int(barber_id)), None)
    if not barber or not barber.get("is_valid_choice"): return False
    new_customer = {"id": generate_id(), "name": customer_name, "service": service, "mins": mins}
    barbers_col.update_one({"id": int(barber_id)}, {"$push": {"queue": new_customer}})
    return True

def remove_from_queue(barber_id, customer_id):
    res = barbers_col.update_one({"id": int(barber_id)}, {"$pull": {"queue": {"id": int(customer_id)}}})
    return res.modified_count > 0

def edit_cut_counter(barber_id, new_count):
    res = barbers_col.update_one({"id": int(barber_id)}, {"$set": {"cuts_today": int(new_count)}})
    return res.modified_count > 0

def request_appointment(barber_id, date_str, time_str, service_name, customer_name, contact, uid=None):
    try:
        req_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        today = get_now().date() 
        days_ahead = (req_date - today).days
        if days_ahead < 1 or days_ahead > 3:
            return {"success": False, "message": "Must book 1 to 3 days in advance based on official shop time."}
    except ValueError:
        return {"success": False, "message": "Invalid date format submitted."}

    try:
        req_time_obj = datetime.strptime(time_str, "%H:%M")
        start_time_obj = datetime.strptime("09:00", "%H:%M")
        end_time_obj = datetime.strptime("21:00", "%H:%M")
        
        if req_time_obj.time() < start_time_obj.time() or req_time_obj.time() > end_time_obj.time():
            return {"success": False, "message": "Booking hours are strictly between 09:00 AM and 09:00 PM."}
            
        service_record = services_col.find_one({"name": service_name})
        service_duration = service_record["mins"] if service_record else 30
        
        calc_end_time = req_time_obj + timedelta(minutes=service_duration)
        
        if calc_end_time.time() > end_time_obj.time():
            return {"success": False, "message": f"Cannot book '{service_name}' at {time_str}. The {service_duration} min duration exceeds our 9:00 PM closing time."}
    except ValueError:
        return {"success": False, "message": "Invalid time format submitted."}

    barber_appts = list(appts_col.find({"barber_id": int(barber_id)}, {"_id": 0}))
    if not is_time_available(barber_appts, time_str, date_str, service_name): 
        return {"success": False, "message": "That time is already booked."}
        
    appts_col.insert_one({
        "id": generate_id(), "uid": uid, "barber_id": int(barber_id),
        "date": date_str, "time": time_str, "service": service_name,
        "customer_name": customer_name, "contact": contact, "status": "pending"
    })
    return {"success": True, "message": "Appointment requested successfully."}

def manage_appointment(appt_id, action):
    if action == 'accept': 
        appts_col.update_one({"id": int(appt_id)}, {"$set": {"status": "accepted"}})
        return True
    
    elif action == 'seat': 
        appt = appts_col.find_one({"id": int(appt_id)})
        if not appt: return False
        
        barber = barbers_col.find_one({"id": appt["barber_id"]})
        if not barber or barber["status"] == "cutting":
            return False 
            
        service_obj = services_col.find_one({"name": appt.get("service")})
        mins = service_obj["mins"] if service_obj else 30
        
        customer_data = {
            "id": appt["id"],
            "name": appt.get("customer_name", "Unknown"),
            "service": appt.get("service", "Unknown"),
            "mins": mins,
            "start_time": get_now().isoformat(),
            "type": "Appointment"
        }
        
        barbers_col.update_one({"id": appt["barber_id"]}, {
            "$set": {
                "status": "cutting",
                "current_customer": customer_data
            }
        })
        appts_col.delete_one({"id": int(appt_id)}) 
        return True

    elif action == 'cancel': 
        appts_col.delete_one({"id": int(appt_id)})
        return True
    return False

# --- NEW: DATA AGGREGATOR FOR AI REPORTING ---
def get_aggregated_report(start_date, end_date):
    reports = list(reports_col.find({
        "iso_date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).sort("iso_date", 1))
    
    total_customers = 0
    barber_totals = {}
    service_totals = {}
    walkin_count = 0
    appt_count = 0
    hourly_counts = {str(h).zfill(2)+":00": 0 for h in range(9, 22)} 
    daily_trend = {}

    for r in reports:
        date = r["iso_date"]
        daily_trend[date] = daily_trend.get(date, 0) + r.get("total_cuts", 0)
        total_customers += r.get("total_cuts", 0)
        
        for log in r.get("detailed_logs", []):
            b_name = log.get("barber_name", "Unknown")
            barber_totals[b_name] = barber_totals.get(b_name, 0) + 1
            
            s_name = log.get("service", "Unknown")
            service_totals[s_name] = service_totals.get(s_name, 0) + 1
            
            c_type = log.get("type", "Walk-in")
            if c_type == "Appointment": appt_count += 1
            else: walkin_count += 1
            
            seated = log.get("time_seated", "")
            if seated and seated != "Unknown":
                try:
                    t_obj = datetime.strptime(seated, "%I:%M %p")
                    hour_key = t_obj.strftime("%H:00")
                    if hour_key in hourly_counts:
                        hourly_counts[hour_key] += 1
                except:
                    pass
    
    return {
        "total_customers": total_customers,
        "daily_trend": daily_trend,
        "barber_totals": barber_totals,
        "service_totals": service_totals,
        "walkin_vs_appt": {"Walk-in": walkin_count, "Appointment": appt_count},
        "hourly_counts": hourly_counts
    }