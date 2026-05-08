import sqlite3

def migrate():
    conn = sqlite3.connect('database.db')
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
        
    conn.close()

if __name__ == '__main__':
    migrate()
