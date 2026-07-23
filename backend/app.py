from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, FoodItem, Order, OrderItem
import os
import json
import time
import urllib.request
from uuid import uuid4

def create_app():
    app = Flask(__name__)
    
    # Enable CORS for the frontend to communicate with backend
    CORS(app,
         origins=[
             r'http://localhost',
             r'http://127\.0\.0\.1',
             r'http://localhost:\d+',
             r'http://127\.0\.0\.1:\d+',
             r'null'
         ],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    # Configuration
    base_dir = os.path.abspath(os.path.dirname(__name__))
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(base_dir, 'database.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'super-secret-cravebite-key-change-in-production'
    app.config['GOOGLE_CLIENT_ID'] = os.environ.get('GOOGLE_CLIENT_ID')
    
    # Initialize plugins
    db.init_app(app)
    
    # Phase 2 basic route
    @app.route('/api/status', methods=['GET'])
    def status():
        return jsonify({"status": "Backend is running", "phase": 3})

    # --- Phase 3: Authentication ---
    @app.route('/api/register', methods=['POST'])
    def register():
        data = request.get_json()
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Missing credentials'}), 400
            
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
            
        hashed_password = generate_password_hash(data['password'])
        new_user = User(username=data['username'], password_hash=hashed_password)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User registered successfully'}), 201

    @app.route('/api/login', methods=['POST'])
    def login():
        data = request.get_json()
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Missing credentials'}), 400
            
        user = User.query.filter_by(username=data['username']).first()
        if user and check_password_hash(user.password_hash, data['password']):
            session['user_id'] = user.id
            return jsonify({
                'message': 'Logged in successfully', 
                'user': {'id': user.id, 'username': user.username, 'role': user.role}
            }), 200
            
        return jsonify({'error': 'Invalid username or password'}), 401
        
    @app.route('/api/auth/google', methods=['POST'])
    def google_auth():
        data = request.get_json()
        if not data or 'credential' not in data:
            return jsonify({'error': 'Missing Google credential'}), 400

        credential = data['credential']
        google_url = f'https://oauth2.googleapis.com/tokeninfo?id_token={credential}'

        try:
            with urllib.request.urlopen(google_url, timeout=5) as resp:
                payload = json.loads(resp.read().decode())
        except Exception:
            return jsonify({'error': 'Invalid Google credential'}), 401

        if payload.get('aud') != app.config['GOOGLE_CLIENT_ID']:
            return jsonify({'error': 'Invalid Google client ID'}), 401

        if payload.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
            return jsonify({'error': 'Invalid issuer'}), 401

        if payload.get('exp', 0) < int(time.time()):
            return jsonify({'error': 'Google token has expired'}), 401

        email = payload.get('email')
        if not email:
            return jsonify({'error': 'Google account did not provide email'}), 400

        user = User.query.filter_by(username=email).first()
        if not user:
            random_password = uuid4().hex
            user = User(username=email, password_hash=generate_password_hash(random_password))
            db.session.add(user)
            db.session.commit()

        return jsonify({
            'message': 'Logged in via Google',
            'user': {'id': user.id, 'username': user.username, 'role': user.role}
        }), 200

    @app.route('/api/logout', methods=['POST'])
    def logout():
        session.pop('user_id', None)
        return jsonify({'message': 'Logged out successfully'}), 200

    # --- Phase 4: Food Display ---
    @app.route('/api/me', methods=['GET'])
    def get_current_user():
        if 'user_id' not in session:
            return jsonify({'user': None}), 200
        user = db.session.get(User, session['user_id'])
        if not user:
            return jsonify({'user': None}), 200
        return jsonify({'user': {'id': user.id, 'username': user.username, 'role': user.role}}), 200

    # --- Phase 4: Food Display & Management ---
    @app.route('/api/foods', methods=['GET'])
    def get_foods():
        foods = FoodItem.query.all()
        return jsonify([{
            'id': f.id,
            'title': f.title,
            'description': f.description,
            'price': f.price,
            'image': f.image,
            'is_veg': f.is_veg,
            'is_available': f.is_available
        } for f in foods]), 200

    @app.route('/api/foods/<int:food_id>', methods=['PUT'])
    def update_food(food_id):
        food = db.session.get(FoodItem, food_id)
        if not food:
            return jsonify({'error': 'Food item not found'}), 404
        data = request.get_json() or {}
        if 'title' in data: food.title = data['title']
        if 'description' in data: food.description = data['description']
        if 'price' in data: food.price = float(data['price'])
        if 'image' in data: food.image = data['image']
        if 'is_veg' in data: food.is_veg = data['is_veg']
        if 'is_available' in data: food.is_available = data['is_available']
        db.session.commit()
        return jsonify({'message': 'Food item updated'}), 200

    @app.route('/api/foods/<int:food_id>', methods=['DELETE'])
    def delete_food(food_id):
        food = db.session.get(FoodItem, food_id)
        if not food:
            return jsonify({'error': 'Food item not found'}), 404
        db.session.delete(food)
        db.session.commit()
        return jsonify({'message': 'Food item deleted'}), 200

    # --- Phase 6: Order System ---
    @app.route('/api/orders', methods=['GET'])
    def get_user_orders():
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        orders = Order.query.filter_by(user_id=session['user_id']).order_by(Order.created_at.desc()).all()
        result = []
        for o in orders:
            items = []
            for item in o.items:
                items.append({
                    'id': item.food_id,
                    'title': item.food.title if item.food else 'Food Item',
                    'quantity': item.quantity,
                    'price': item.price_at_time,
                    'image': item.food.image if item.food else 'img/burger.png'
                })
            result.append({
                'id': f"ORD-{o.id:06d}",
                'date': o.created_at.isoformat(),
                'total': o.total_amount,
                'status': o.status,
                'items': items,
                'user': o.user.username if o.user else 'User'
            })
        return jsonify(result), 200

    @app.route('/api/orders', methods=['POST'])
    def create_order():
        data = request.get_json()
        if not data or 'items' not in data:
            return jsonify({'error': 'Invalid order data'}), 400
            
        user_id = session.get('user_id')
        if not user_id:
            username = data.get('user', 'Guest')
            user = User.query.filter_by(username=username).first()
            if user:
                user_id = user.id
            else:
                user_id = 1 # fallback

        total = sum(item['price'] * item['quantity'] for item in data['items'])
        
        order = Order(user_id=user_id, total_amount=total)
        db.session.add(order)
        db.session.commit()
        
        for item in data['items']:
            food_id = item.get('id', 1)
            order_item = OrderItem(order_id=order.id, food_id=food_id, quantity=item['quantity'], price_at_time=item['price'])
            db.session.add(order_item)
            
        db.session.commit()
        return jsonify({'message': 'Order placed successfully', 'order_id': f"ORD-{order.id:06d}"}), 201

    @app.route('/api/orders/<order_id>/status', methods=['PUT'])
    def update_order_status(order_id):
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'error': 'Missing status'}), 400
        
        numeric_id = order_id.replace('ORD-', '')
        if numeric_id.isdigit():
            order = db.session.get(Order, int(numeric_id))
            if order:
                order.status = data['status']
                db.session.commit()
                return jsonify({'message': 'Order status updated'}), 200
        return jsonify({'message': 'Order status updated locally'}), 200

    # --- Phase 7: Admin Panel ---
    def admin_required(f):
        def wrap(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Unauthorized'}), 401
            user = db.session.get(User, session['user_id'])
            if not user or user.role != 'admin':
                return jsonify({'error': 'Forbidden'}), 403
            return f(*args, **kwargs)
        wrap.__name__ = f.__name__
        return wrap

    @app.route('/api/admin/foods', methods=['POST'])
    def add_food():
        data = request.get_json()
        new_food = FoodItem(
            title=data['title'],
            description=data['description'],
            price=float(data['price']),
            image=data.get('image', 'img/burger.png'),
            is_veg=data.get('is_veg', False)
        )
        db.session.add(new_food)
        db.session.commit()
        return jsonify({'message': 'Food item added successfully'}), 201
    
    return app

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        # Create all tables if they don't exist
        db.create_all()
        print("Database initialized.")
    app.run(debug=True, port=5000)
