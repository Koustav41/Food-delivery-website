import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), 'database.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute('ALTER TABLE food_item ADD COLUMN is_veg BOOLEAN DEFAULT 0')
        print("Column is_veg added.")
    except Exception as e:
        print(f"Column might already exist: {e}")
        
    try:
        cursor.execute('UPDATE food_item SET is_veg = 1 WHERE title LIKE "%Salad%"')
        conn.commit()
        print("Updated existing salad to veg.")
    except Exception as e:
        print(f"Error updating records: {e}")

    user_cols = [
        ('full_name', 'TEXT'),
        ('email', 'TEXT'),
        ('phone', 'TEXT'),
        ('address', 'TEXT'),
        ('avatar', 'TEXT DEFAULT "img/burger.png"')
    ]
    for col_name, col_type in user_cols:
        try:
            cursor.execute(f'ALTER TABLE user ADD COLUMN {col_name} {col_type}')
            conn.commit()
            print(f"Column user.{col_name} added.")
        except Exception as e:
            print(f"Column user.{col_name} might already exist: {e}")

    conn.close()

if __name__ == '__main__':
    migrate()
