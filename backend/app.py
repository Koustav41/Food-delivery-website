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
         allow_headers=['Content-Type', 'Authorization'],
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
        
    @app.route('/api/logout', methods=['POST'])
    def logout():
        session.pop('user_id', None)
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
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
            
        data = request.get_json()
        if not data or 'items' not in data:
            return jsonify({'error': 'Invalid order data'}), 400
            
        total = sum(item['price'] * item['quantity'] for item in data['items'])
        
        order = Order(user_id=session['user_id'], total_amount=total)
        db.session.add(order)
        db.session.commit()
        
        for item in data['items']:
            order_item = OrderItem(order_id=order.id, food_id=item['id'], quantity=item['quantity'], price_at_time=item['price'])
            db.session.add(order_item)
            
        db.session.commit()
        return jsonify({'message': 'Order placed successfully', 'order_id': order.id}), 201

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
