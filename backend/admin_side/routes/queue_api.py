from flask import Blueprint, jsonify, request
from admin_side.services.database_adapter import get_db

queue_bp = Blueprint('queue', __name__)

@queue_bp.route('/walk-in', methods=['POST', 'OPTIONS'])
def add_walk_in():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.json
    db = get_db()
    success = db.add_walk_in(data['barber_id'], data['customer_name'])
    return jsonify({"success": success}), 200

@queue_bp.route('/remove', methods=['POST'])
def remove_walk_in():
    data = request.json
    db = get_db()
    success = db.remove_from_queue(data['barber_id'], data['customer_id'])
    return jsonify({"success": success}), 200