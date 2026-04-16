from flask import Blueprint, jsonify, request
from admin_side.services.database_adapter import get_db

queue_bp = Blueprint('queue', __name__)

@queue_bp.route('/walk-in', methods=['POST', 'OPTIONS'])
def add_walk_in():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.json
    db = get_db()
    # Now extracts service and mins, defaulting to Haircut (30 mins) if somehow missed
    service = data.get('service', 'Haircut')
    mins = data.get('mins', 30)
    
    success = db.add_walk_in(data['barber_id'], data['customer_name'], service, mins)
    return jsonify({"success": success}), 200

@queue_bp.route('/remove', methods=['POST'])
def remove_walk_in():
    data = request.json
    db = get_db()
    success = db.remove_from_queue(data['barber_id'], data['customer_id'])
    return jsonify({"success": success}), 200