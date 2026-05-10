from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, FoodItem, Order, OrderItem
import os

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
         allow_headers=['Content-Type', 'Authorization', 'X-User-Id'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    # Configuration
    base_dir = os.path.abspath(os.path.dirname(__name__))
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(base_dir, 'database.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'super-secret-cravebite-key-change-in-production'
    
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
        role = data.get('role', 'user')
        new_user = User(username=data['username'], password_hash=hashed_password, role=role)
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
            return jsonify({
                'message': 'Logged in successfully', 
                'user': {'id': user.id, 'username': user.username, 'role': user.role}
            }), 200
            
        return jsonify({'error': 'Invalid username or password'}), 401
        
    @app.route('/api/logout', methods=['POST'])
    def logout():
        return jsonify({'message': 'Logged out successfully'}), 200

    # --- Phase 4: Food Display ---
    @app.route('/api/foods', methods=['GET'])
    def get_foods():
        foods = FoodItem.query.filter_by(is_available=True).all()
        return jsonify([{
            'id': f.id,
            'title': f.title,
            'description': f.description,
            'price': f.price,
            'image': f.image,
            'is_veg': f.is_veg
        } for f in foods]), 200

    # --- Phase 6: Order System ---
    @app.route('/api/orders', methods=['POST'])
    def create_order():
        user_id = request.headers.get('X-User-Id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
            
        data = request.get_json()
        if not data or 'items' not in data:
            return jsonify({'error': 'Invalid order data'}), 400
            
        total = sum(item['price'] * item['quantity'] for item in data['items'])
        address = data.get('address', 'Not specified')
        payment_method = data.get('paymentMethod', 'card')
        
        order = Order(user_id=user_id, total_amount=total, address=address, payment_method=payment_method)
        db.session.add(order)
        db.session.commit()
        
        for item in data['items']:
            order_item = OrderItem(order_id=order.id, food_id=item['id'], quantity=item['quantity'], price_at_time=item['price'])
            db.session.add(order_item)
            
        db.session.commit()
        return jsonify({'message': 'Order placed successfully', 'order_id': order.id}), 201

    @app.route('/api/orders', methods=['GET'])
    def get_orders():
        user_id = request.headers.get('X-User-Id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
        result = []
        for o in orders:
            items = []
            for i in o.items:
                food = db.session.get(FoodItem, i.food_id)
                items.append({
                    'id': i.food_id,
                    'title': food.title if food else 'Unknown',
                    'quantity': i.quantity,
                    'price': i.price_at_time,
                    'image': food.image if food else 'img/burger.png'
                })
            result.append({
                'id': 'ORD-' + str(o.id),
                'db_id': o.id,
                'date': o.created_at.isoformat() + 'Z',
                'status': o.status,
                'total': o.total_amount,
                'address': o.address,
                'paymentMethod': o.payment_method,
                'user': o.user.username,
                'items': items
            })
        return jsonify(result), 200

    # --- Phase 7: Admin Panel ---
    def admin_required(f):
        def wrap(*args, **kwargs):
            user_id = request.headers.get('X-User-Id')
            if not user_id:
                return jsonify({'error': 'Unauthorized'}), 401
            user = db.session.get(User, user_id)
            if not user or user.role != 'admin':
                return jsonify({'error': 'Forbidden'}), 403
            return f(*args, **kwargs)
        wrap.__name__ = f.__name__
        return wrap

    @app.route('/api/admin/orders', methods=['GET'])
    @admin_required
    def get_all_orders():
        orders = Order.query.order_by(Order.created_at.desc()).all()
        result = []
        for o in orders:
            items = []
            for i in o.items:
                food = db.session.get(FoodItem, i.food_id)
                items.append({
                    'id': i.food_id,
                    'title': food.title if food else 'Unknown',
                    'quantity': i.quantity,
                    'price': i.price_at_time,
                    'image': food.image if food else 'img/burger.png'
                })
            result.append({
                'id': 'ORD-' + str(o.id),
                'db_id': o.id,
                'date': o.created_at.isoformat() + 'Z',
                'status': o.status,
                'total': o.total_amount,
                'address': o.address,
                'paymentMethod': o.payment_method,
                'user': o.user.username,
                'items': items
            })
        return jsonify(result), 200

    @app.route('/api/admin/orders/<int:order_id>/status', methods=['PUT'])
    @admin_required
    def update_order_status(order_id):
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'error': 'Status required'}), 400
            
        order = db.session.get(Order, order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
            
        order.status = data['status']
        db.session.commit()
        return jsonify({'message': 'Status updated successfully'}), 200

    @app.route('/api/admin/foods', methods=['POST'])
    @admin_required
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
