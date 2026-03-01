"""
FRIZZLY Admin Dashboard - PostgreSQL Version for Railway
"""
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
import psycopg2
from psycopg2.extras import RealDictCursor, Json
import os
import json
from datetime import datetime
import logging
from logging.handlers import RotatingFileHandler

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'change-me-in-production')

# Setup logging
if not os.path.exists('logs'):
    os.mkdir('logs')

file_handler = RotatingFileHandler('logs/debug_logs.log', maxBytes=10240000, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.DEBUG)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.DEBUG)
app.logger.info('Dashboard startup')

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# PostgreSQL connection
def get_db():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=os.getenv('POSTGRES_PORT', '5432'),
        database=os.getenv('POSTGRES_DB', 'railway'),
        user=os.getenv('POSTGRES_USER', 'postgres'),
        password=os.getenv('POSTGRES_PASSWORD', 'password')
    )

class User:
    def __init__(self, email, role='admin'):
        self.email = email
        self.role = role
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False
    
    def get_id(self):
        return self.email

@login_manager.user_loader
def load_user(email):
    return User(email)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        if email == 'admin@frizzly.com' and password == 'admin123':
            user = User(email)
            login_user(user)
            return redirect(url_for('dashboard'))
        flash('Invalid credentials')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def dashboard():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT 
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
            COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered_orders,
            SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as total_revenue
        FROM orders
    """)
    stats = dict(cur.fetchone())
    
    cur.execute("SELECT COUNT(*) as total_products FROM products")
    stats['total_products'] = cur.fetchone()['total_products']
    
    cur.execute("SELECT COUNT(*) as total_users FROM users")
    stats['total_users'] = cur.fetchone()['total_users']
    
    cur.execute("SELECT COUNT(*) as low_stock_products FROM products WHERE stock < 10")
    stats['low_stock_products'] = cur.fetchone()['low_stock_products']
    
    cur.execute("SELECT * FROM orders ORDER BY timestamp DESC LIMIT 10")
    recent_orders = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return render_template('dashboard.html', stats=stats, recent_orders=recent_orders)

@app.route('/orders', methods=['GET', 'POST'])
@login_required
def orders():
    if request.method == 'POST':
        # Handle bulk update
        status = request.form.get('status')
        order_ids = request.form.getlist('order_ids[]')  # Fix: add [] for multiple values
        
        if order_ids and status:
            conn = get_db()
            cur = conn.cursor()
            
            # Batch update for efficiency
            placeholders = ','.join(['%s'] * len(order_ids))
            cur.execute(f"""
                UPDATE orders 
                SET status = %s, updated_at = NOW() 
                WHERE id IN ({placeholders})
            """, [status] + order_ids)
            
            conn.commit()
            cur.close()
            conn.close()
            
            flash(f'{len(order_ids)} orders updated to {status}')
        else:
            flash('No orders selected or status not provided')
        
        return redirect(url_for('orders'))
    
    # GET request
    status_filter = request.args.get('status')
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    if status_filter:
        cur.execute("SELECT * FROM orders WHERE status = %s ORDER BY timestamp DESC", (status_filter,))
    else:
        cur.execute("SELECT * FROM orders ORDER BY timestamp DESC")
    
    orders = cur.fetchall()
    cur.close()
    conn.close()
    
    return render_template('orders.html', orders=orders, valid_statuses=VALID_STATUSES)

# Valid order statuses
VALID_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'FAILED',
    'REFUNDED'
]

@app.route('/orders/<order_id>')
@login_required
def order_detail(order_id):
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    order = cur.fetchone()
    
    # Get available drivers
    cur.execute("SELECT * FROM drivers WHERE status = 'available' ORDER BY name")
    available_drivers = cur.fetchall()
    
    cur.close()
    conn.close()
    
    if not order:
        flash('Order not found')
        return redirect(url_for('orders'))
    
    return render_template('order_detail.html', order=order, valid_statuses=VALID_STATUSES, available_drivers=available_drivers)

@app.route('/orders/<order_id>/update', methods=['POST'])
@login_required
def update_order(order_id):
    status = request.form.get('status')
    driver_id = request.form.get('driver_id')
    
    # Update PostgreSQL
    conn = get_db()
    cur = conn.cursor()
    
    if driver_id:
        # Get driver info
        cur.execute("SELECT name, phone FROM drivers WHERE id = %s", (driver_id,))
        driver = cur.fetchone()
        if driver:
            cur.execute("""
                UPDATE orders 
                SET driver_id = %s, driver_name = %s, driver_phone = %s, updated_at = NOW() 
                WHERE id = %s
            """, (driver_id, driver[0], driver[1], order_id))
            # Update driver status
            cur.execute("UPDATE drivers SET status = 'on_delivery', updated_at = NOW() WHERE id = %s", (driver_id,))
    
    if status:
        cur.execute("UPDATE orders SET status = %s, updated_at = NOW() WHERE id = %s", (status, order_id))
    
    conn.commit()
    cur.close()
    conn.close()
    
    # Update Firebase (client-side will handle this via JS)
    flash('Order updated successfully')
    return redirect(url_for('order_detail', order_id=order_id))

@app.route('/products')
@login_required
def products():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM products ORDER BY created_at DESC")
    products = cur.fetchall()
    cur.close()
    conn.close()
    
    return render_template('products.html', products=products)

# Product categories (matching Android app)
CATEGORIES = [
    'Fruits',
    'Vegetables'
]

@app.route('/products/add', methods=['GET', 'POST'])
@login_required
def add_product():
    if request.method == 'POST':
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO products (id, name, description, price, category, stock, image_url, is_active)
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s)
        """, (
            request.form.get('name'),
            request.form.get('description'),
            float(request.form.get('price')),
            request.form.get('category'),
            int(request.form.get('stock')),
            request.form.get('image_url'),
            True
        ))
        conn.commit()
        cur.close()
        conn.close()
        
        flash('Product added successfully')
        return redirect(url_for('products'))
    
    return render_template('add_product.html', categories=[{'name': c} for c in CATEGORIES])

@app.route('/products/<product_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_product(product_id):
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    if request.method == 'POST':
        cur.execute("""
            UPDATE products SET 
                name = %s, description = %s, price = %s, 
                category = %s, stock = %s, image_url = %s, updated_at = NOW()
            WHERE id = %s
        """, (
            request.form.get('name'),
            request.form.get('description'),
            float(request.form.get('price')),
            request.form.get('category'),
            int(request.form.get('stock')),
            request.form.get('image_url'),
            product_id
        ))
        conn.commit()
        cur.close()
        conn.close()
        
        flash('Product updated successfully')
        return redirect(url_for('products'))
    
    cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
    product = cur.fetchone()
    cur.close()
    conn.close()
    
    return render_template('edit_product.html', product=product, categories=[{'name': c} for c in CATEGORIES])

@app.route('/users')
@login_required
def users():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM users ORDER BY created_at DESC")
    users = cur.fetchall()
    cur.close()
    conn.close()
    
    return render_template('users.html', users=users)

@app.route('/delivery')
@login_required
def delivery():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get orders that are out for delivery or ready for pickup
    cur.execute("""
        SELECT * FROM orders 
        WHERE status IN ('OUT_FOR_DELIVERY', 'READY_FOR_PICKUP') 
        ORDER BY timestamp DESC
    """)
    deliveries = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return render_template('delivery.html', deliveries=deliveries)

@app.route('/drivers')
@login_required
def drivers():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
            COUNT(CASE WHEN status = 'on_delivery' THEN 1 END) as on_delivery,
            COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline
        FROM drivers
    """)
    stats = dict(cur.fetchone())
    
    cur.execute("SELECT * FROM drivers ORDER BY created_at DESC")
    drivers = cur.fetchall()
    cur.close()
    conn.close()
    
    return render_template('drivers.html', drivers=drivers, stats=stats)

@app.route('/drivers/add', methods=['GET', 'POST'])
@login_required
def add_driver():
    if request.method == 'POST':
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO drivers (id, name, phone, email, vehicle_type, status)
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, 'available')
        """, (
            request.form.get('name'),
            request.form.get('phone'),
            request.form.get('email'),
            request.form.get('vehicle_type')
        ))
        conn.commit()
        cur.close()
        conn.close()
        
        flash('Driver added successfully')
        return redirect(url_for('drivers'))
    
    return render_template('add_driver.html')

@app.route('/drivers/<driver_id>')
@login_required
def driver_detail(driver_id):
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM drivers WHERE id = %s", (driver_id,))
    driver = cur.fetchone()
    cur.close()
    conn.close()
    
    if not driver:
        flash('Driver not found')
        return redirect(url_for('drivers'))
    
    return render_template('driver_detail.html', driver=driver)

@app.route('/drivers/<driver_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_driver(driver_id):
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    if request.method == 'POST':
        cur.execute("""
            UPDATE drivers SET 
                name = %s, phone = %s, email = %s, 
                vehicle_type = %s, status = %s, updated_at = NOW()
            WHERE id = %s
        """, (
            request.form.get('name'),
            request.form.get('phone'),
            request.form.get('email'),
            request.form.get('vehicle_type'),
            request.form.get('status'),
            driver_id
        ))
        conn.commit()
        cur.close()
        conn.close()
        
        flash('Driver updated successfully')
        return redirect(url_for('drivers'))
    
    cur.execute("SELECT * FROM drivers WHERE id = %s", (driver_id,))
    driver = cur.fetchone()
    cur.close()
    conn.close()
    
    return render_template('edit_driver.html', driver=driver)

@app.template_filter('timestamp_to_date')
def timestamp_to_date(timestamp):
    if timestamp:
        return datetime.fromtimestamp(timestamp / 1000).strftime('%Y-%m-%d %H:%M')
    return 'N/A'

@app.template_filter('format_date')
def format_date(dt):
    if dt:
        return dt.strftime('%Y-%m-%d %H:%M')
    return 'N/A'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
