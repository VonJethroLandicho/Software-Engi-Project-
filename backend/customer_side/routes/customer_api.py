from flask import Blueprint, jsonify, request
from admin_side.services.database_adapter import get_db

customer_bp = Blueprint('customer', __name__)

@customer_bp.route('/state', methods=['GET'])
def get_public_state():
    db = get_db()
    return jsonify(db.get_customer_state()), 200

@customer_bp.route('/schedule/<int:barber_id>', methods=['GET'])
def get_schedule(barber_id):
    db = get_db()
    schedule = db.get_barber_schedule(barber_id)
    return jsonify({"schedule": schedule}), 200

@customer_bp.route('/book', methods=['POST'])
def book_appointment():
    data = request.json
    db = get_db()
    # Now passing name and contact to the database
    result = db.request_appointment(
        data['barber_id'], 
        data['date'], 
        data['time'], 
        data['service'],
        data['customer_name'],
        data['contact']
    )
    return jsonify(result), 200