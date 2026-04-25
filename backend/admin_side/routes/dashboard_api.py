import json
from flask import Blueprint, jsonify, request
from admin_side.services.database_adapter import get_db
from admin_side.services.ai_service import generate_report_analysis

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/state', methods=['GET'])
def get_state():
    db = get_db()
    return jsonify(db.get_full_state()), 200

@dashboard_bp.route('/status', methods=['POST'])
def update_status():
    data = request.json
    db = get_db()
    customer_id = data.get('customer_id', None)
    db.update_barber_status(data['barber_id'], data['status'], customer_id)
    return jsonify({"success": True}), 200

@dashboard_bp.route('/appointments/manage', methods=['POST'])
def api_manage_appointment():
    data = request.json
    db = get_db()
    success = db.manage_appointment(data['appt_id'], data['action'])
    if success:
        return jsonify({"success": True}), 200
    else:
        return jsonify({"success": False}), 400

@dashboard_bp.route('/edit-counter', methods=['POST'])
def edit_counter():
    data = request.json
    db = get_db()
    db.edit_cut_counter(data['barber_id'], data['new_count'])
    return jsonify({"success": True}), 200

@dashboard_bp.route('/add-barber', methods=['POST'])
def api_add_barber():
    data = request.json
    db = get_db()
    db.add_barber(data['name'])
    return jsonify({"success": True}), 200

@dashboard_bp.route('/remove-barber', methods=['POST'])
def api_remove_barber():
    data = request.json
    db = get_db()
    db.remove_barber(data['barber_id'])
    return jsonify({"success": True}), 200

@dashboard_bp.route('/add-service', methods=['POST'])
def api_add_service():
    data = request.json
    db = get_db()
    db.add_service(data['name'], data['price'], data['desc'], data['mins'])
    return jsonify({"success": True}), 200

@dashboard_bp.route('/edit-service', methods=['POST'])
def api_edit_service():
    data = request.json
    db = get_db()
    db.edit_service(data['old_name'], data['new_name'], data['price'], data['desc'], data['mins'])
    return jsonify({"success": True}), 200

@dashboard_bp.route('/remove-service', methods=['POST'])
def api_remove_service():
    data = request.json
    db = get_db()
    db.remove_service(data['name'])
    return jsonify({"success": True}), 200

@dashboard_bp.route('/toggle-service', methods=['POST'])
def api_toggle_service():
    data = request.json
    db = get_db()
    db.toggle_service_availability(data['name'])
    return jsonify({"success": True}), 200

@dashboard_bp.route('/set-official-time', methods=['POST'])
def api_set_official_time():
    data = request.json
    db = get_db()
    db.set_global_time(data['offset_ms'])
    return jsonify({"success": True}), 200

@dashboard_bp.route('/save-records', methods=['POST'])
def api_save_records():
    db = get_db()
    db.save_current_records() 
    return jsonify({"success": True}), 200

@dashboard_bp.route('/calendar-history', methods=['GET'])
def api_calendar_history():
    db = get_db()
    return jsonify({"history": db.get_calendar_history()}), 200

@dashboard_bp.route('/delete-history', methods=['POST'])
def api_delete_history():
    data = request.json
    db = get_db()
    success = db.delete_history_record(data['iso_date'])
    return jsonify({"success": success}), 200

# NEW: AI Report Generation Endpoint
@dashboard_bp.route('/generate-report', methods=['POST'])
def api_generate_report():
    data = request.json
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    
    db = get_db()
    aggregated_data = db.get_aggregated_report(start_date, end_date)
    
    ai_analysis = generate_report_analysis(json.dumps(aggregated_data)) or {}
            
    return jsonify({
        "success": True, 
        "data": aggregated_data, 
        "ai_analysis": ai_analysis
    }), 200