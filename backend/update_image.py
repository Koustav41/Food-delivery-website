import sqlite3

def update_image():
    try:
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        
        new_url = "img/Paneer-Tikka-Featured-1.jpg"
        
        cursor.execute('UPDATE food_item SET image = ? WHERE title = ?', (new_url, "Panner Tikka"))
        new_url = "img/Spaghetti-Carbonara-Plated.jpg"
        
        cursor.execute('UPDATE food_item SET image = ? WHERE title = ?', (new_url, "Spaghetti Carbonara"))
        conn.commit()
        print(f"Updated {cursor.rowcount} rows.")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    update_image()
