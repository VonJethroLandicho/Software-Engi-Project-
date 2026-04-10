from flask import Blueprint, jsonify, request
from admin_side.services.database_adapter import get_db

appointment_bp = Blueprint('appointment', __name__)

@appointment_bp.route('/request', methods=['POST'])
def request_appt():
    data = request.json
    db = get_db()
    success = db.request_appointment(data['barber_id'], data['time'], data['service'])
    return jsonify({"success": success}), 200

@appointment_bp.route('/manage', methods=['POST'])
def manage_appt():
    data = request.json
    db = get_db()
    db.manage_appointment(data['appt_id'], data['action'])
    return jsonify({"success": True}), 200