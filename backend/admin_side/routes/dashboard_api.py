from flask import Blueprint, jsonify, request
from admin_side.services.database_adapter import get_db

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/state', methods=['GET'])
def get_state():
    db = get_db()
    return jsonify(db.get_full_state()), 200

@dashboard_bp.route('/status', methods=['POST'])
def update_status():
    data = request.json
    db = get_db()
    # Now accepts customer_id if provided (for starting cuts)
    customer_id = data.get('customer_id', None)
    db.update_barber_status(data['barber_id'], data['status'], customer_id)
    return jsonify({"success": True}), 200

@dashboard_bp.route('/edit-counter', methods=['POST'])
def edit_counter():
    data = request.json
    db = get_db()
    db.edit_cut_counter(data['barber_id'], data['new_count'])
    return jsonify({"success": True}), 200