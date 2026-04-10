from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app) 

from admin_side.routes.dashboard_api import dashboard_bp
from admin_side.routes.queue_api import queue_bp
from admin_side.routes.appointment_api import appointment_bp
from customer_side.routes.customer_api import customer_bp

# Register all modules
app.register_blueprint(dashboard_bp, url_prefix='/api/admin')
app.register_blueprint(queue_bp, url_prefix='/api/admin/queue')
app.register_blueprint(appointment_bp, url_prefix='/api/admin/appointments')
app.register_blueprint(customer_bp, url_prefix='/api/customer')

if __name__ == '__main__':
    print("Mugshot Backend Server Running...")
    app.run(debug=True, port=5000)