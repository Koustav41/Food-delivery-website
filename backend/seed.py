import os
from app import create_app
from models import db, FoodItem, User
try:
    from werkzeug.security import generate_password_hash
except ImportError:
    import hashlib, binascii

    def generate_password_hash(password, method='pbkdf2:sha256', salt_length=8):
        if method != 'pbkdf2:sha256':
            raise ValueError('Unsupported hash method')
        salt = binascii.hexlify(os.urandom(salt_length)).decode()
        dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
        return f"pbkdf2:sha256:260000${salt}${binascii.hexlify(dk).decode()}"

app = create_app()

with app.app_context():
    db.create_all()
    
    # Add Admin User
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', password_hash=generate_password_hash('admin123'), role='admin')
        db.session.add(admin)
        print("Admin user created (admin / admin123)")


    foods = [
        FoodItem(title="Chicken Gourmet Cheeseburger", description="Juicy chicken breast patty with fresh lettuce, tomato, and melted cheese on a brioche bun.", price=200, image="img/burger.png", is_veg=False),
        FoodItem(title="Chicken Pepperoni Pizza", description="Hot, freshly baked pizza with loaded pepperoni and gooey mozzarella cheese.", price=350, image="img/pizza.png", is_veg=False),
        FoodItem(title="Healthy Mixed Salad", description="Fresh mixed greens with cherry tomatoes, cucumbers, and our signature vinaigrette.", price=150, image="img/salad.png", is_veg=True),
        FoodItem(title="Panner Tikka", description="A classic Indian dish made with marinated cottage cheese cooked in a tandoor.", price=250, image="img/Paneer-Tikka-Featured-1.jpg", is_veg=True),
        FoodItem(title="Spaghetti Carbonara", description="Classic Italian pasta dish with creamy sauce, pancetta, and Parmesan cheese.", price=200, image="img/Spaghetti-Carbonara-Plated.jpg", is_veg=True),
    ]   
    
    for food in foods:
        if not FoodItem.query.filter_by(title=food.title).first():
            db.session.add(food)
            
    db.session.commit()
    print("Database seeded successfully!")
