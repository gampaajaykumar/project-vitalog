from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from models import db, User, HealthMetricReading
from datetime import datetime, timedelta
import os

app = Flask(__name__, static_folder='static')
CORS(app)

# Configure database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# Helper function to get current user
def get_current_user():
    user_id = request.headers.get('X-User-ID')
    if not user_id:
        return None
    return User.query.get(int(user_id))

# Create test data on first request
@app.before_first_request
def create_test_data():
    if not User.query.first():
        print("Creating test user and metrics...")
        try:
            # Create test user
            user = User(username='testuser', email='test@example.com')
            user.set_password('testpass123')
            db.session.add(user)
            db.session.commit()

            # Create test metrics
            metrics = []
            current_time = datetime.utcnow()
            
            for i in range(30):
                # Weight metrics
                metrics.append(HealthMetricReading(
                    user_id=user.id,
                    metric_type='Weight',
                    value=str(round(70 + (i * 0.5), 1)),
                    unit='kg',
                    recorded_at=current_time - timedelta(days=i),
                    notes=f"Weight measurement day {i}"
                ))
                
                # Blood Pressure metrics
                metrics.append(HealthMetricReading(
                    user_id=user.id,
                    metric_type='Blood Pressure',
                    value=f"{120 + (i % 10)}/{80 + (i % 5)}",
                    unit='mmHg',
                    recorded_at=current_time - timedelta(days=i),
                    notes=f"BP measurement day {i}"
                ))
                
                # Blood Sugar metrics
                metrics.append(HealthMetricReading(
                    user_id=user.id,
                    metric_type='Blood Sugar',
                    value=str(90 + (i % 20)),
                    unit='mg/dL',
                    recorded_at=current_time - timedelta(days=i),
                    notes=f"Glucose measurement day {i}"
                ))

            db.session.add_all(metrics)
            db.session.commit()
            print("Successfully created test data")
        except Exception as e:
            db.session.rollback()
            print(f"Error creating test data: {str(e)}")

# Authentication routes
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or 'username' not in data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User created successfully', 'user_id': user.id}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
        
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401
    
    return jsonify({'message': 'Login successful', 'user_id': user.id}), 200

@app.route('/logout', methods=['POST'])
def logout():
    # In a real application, you might want to:
    # 1. Invalidate the user's session/token
    # 2. Log the logout event
    # For now, we'll just return a success response
    return jsonify({'message': 'Logout successful'}), 200

# Health Metric routes
@app.route('/metrics', methods=['GET'])
def get_metrics():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    metric_type = request.args.get('type')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    sort = request.args.get('sort', 'desc')

    query = HealthMetricReading.query.filter_by(user_id=user.id)

    if metric_type:
        query = query.filter_by(metric_type=metric_type)

    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            query = query.filter(HealthMetricReading.recorded_at >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = end_date + timedelta(days=1)
            query = query.filter(HealthMetricReading.recorded_at <= end_date)
    except ValueError as e:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if sort.lower() == 'asc':
        query = query.order_by(HealthMetricReading.recorded_at.asc())
    else:
        query = query.order_by(HealthMetricReading.recorded_at.desc())

    metrics = query.all()

    return jsonify([{
        'id': m.id,
        'metric_type': m.metric_type,
        'value': m.value,
        'unit': m.unit,
        'recorded_at': m.recorded_at.isoformat(),
        'notes': m.notes
    } for m in metrics])

@app.route('/metrics/summary', methods=['GET'])
def get_summary():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    metric_type = request.args.get('type')
    if not metric_type:
        return jsonify({'error': 'Metric type required'}), 400
    
    latest = HealthMetricReading.query.filter_by(
        user_id=user.id,
        metric_type=metric_type
    ).order_by(HealthMetricReading.recorded_at.desc()).first()
    
    if not latest:
        return jsonify({'message': 'No readings found'}), 404
    
    return jsonify({
        'metric_type': latest.metric_type,
        'value': latest.value,
        'unit': latest.unit,
        'recorded_at': latest.recorded_at.isoformat()
    })

@app.route('/metrics', methods=['POST'])
def create_metric():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    if not data or 'metric_type' not in data or 'value' not in data or 'unit' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        recorded_at = datetime.fromisoformat(data.get('recorded_at', datetime.utcnow().isoformat()))
    except ValueError:
        recorded_at = datetime.utcnow()
    
    metric = HealthMetricReading(
        user_id=user.id,
        metric_type=data['metric_type'],
        value=str(data['value']),
        unit=data['unit'],
        recorded_at=recorded_at,
        notes=data.get('notes', '')
    )
    
    db.session.add(metric)
    db.session.commit()
    
    return jsonify({'message': 'Metric created successfully', 'id': metric.id}), 201

@app.route('/metrics/<int:metric_id>', methods=['PUT'])
def update_metric(metric_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    metric = HealthMetricReading.query.get(metric_id)
    if not metric or metric.user_id != user.id:
        return jsonify({'error': 'Metric not found'}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    if 'metric_type' in data:
        metric.metric_type = data['metric_type']
    if 'value' in data:
        metric.value = str(data['value'])
    if 'unit' in data:
        metric.unit = data['unit']
    if 'notes' in data:
        metric.notes = data['notes']
    
    if 'recorded_at' in data:
        try:
            metric.recorded_at = datetime.fromisoformat(data['recorded_at'])
        except ValueError:
            pass
    
    db.session.commit()
    
    return jsonify({'message': 'Metric updated successfully'})

@app.route('/metrics/<int:metric_id>', methods=['DELETE'])
def delete_metric(metric_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    metric = HealthMetricReading.query.get(metric_id)
    if not metric or metric.user_id != user.id:
        return jsonify({'error': 'Metric not found'}), 404
    
    db.session.delete(metric)
    db.session.commit()
    
    return jsonify({'message': 'Metric deleted successfully'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)