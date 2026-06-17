from flask import Blueprint, jsonify, request,abort, make_response
from app import db
from app.models import Product, Category
import os
from flask import send_from_directory, current_app
from app.models import ProductImage
import hashlib
import json
from sqlalchemy import text
from sqlalchemy.orm.attributes import flag_modified
from app.category_config import PERFUME_CATEGORY_DEFINITIONS
from app.coupon_store import calculate_discount

import smtplib
import os
from email.mime.text import MIMEText
from email.utils import formataddr
from flask import Blueprint, request, jsonify




public_bp = Blueprint('public', __name__)
ADMIN_SETTINGS_TABLE = "admin_settings"
HOME_FEATURED_PRODUCTS_KEY = "home_featured_product_ids"
HOME_MARQUEE_SETTINGS_KEY = "home_marquee_settings"
DEFAULT_HOME_MARQUEE_SETTINGS = {
    "enabled": True,
    "custom_text": "Precios referenciales en USD",
    "rates": {
        "usd": {"label": "Dólar", "flag": "🇺🇸", "value": ""},
        "ars": {"label": "Bolívar", "flag": "🇻🇪", "value": ""},
        "brl": {"label": "Peso colombiano", "flag": "🇨🇴", "value": ""},
    },
}

def _ensure_public_settings_table():
    db.session.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {ADMIN_SETTINGS_TABLE} (
            key VARCHAR(120) PRIMARY KEY,
            value TEXT NOT NULL
        )
    """))

def _is_product_hidden(product):
    return any(
        isinstance(item, dict)
        and item.get("__type") == "multi_category_meta"
        and item.get("is_active_product") is False
        for item in (product.flavor_catalog or [])
    )

def _product_category_ids(product):
    ids = [int(product.category_id)]
    for item in (product.flavor_catalog or []):
        if isinstance(item, dict) and item.get("__type") == "multi_category_meta":
            for raw_id in item.get("extra_category_ids") or []:
                try:
                    category_id = int(raw_id)
                except Exception:
                    continue
                if category_id > 0 and category_id not in ids:
                    ids.append(category_id)
    return ids

def _get_public_setting(key, default=None):
    _ensure_public_settings_table()
    row = db.session.execute(
        text(f"SELECT value FROM {ADMIN_SETTINGS_TABLE} WHERE key = :key"),
        {"key": key},
    ).first()
    if not row:
        return default
    try:
        return json.loads(row[0])
    except Exception:
        return default

def _normalize_home_marquee_settings(value):
    data = value if isinstance(value, dict) else {}
    base = json.loads(json.dumps(DEFAULT_HOME_MARQUEE_SETTINGS))
    normalized = {
        "enabled": bool(data.get("enabled", base["enabled"])),
        "custom_text": str(data.get("custom_text", base["custom_text"]) or "").strip()[:180],
        "rates": {},
    }

    incoming_rates = data.get("rates") if isinstance(data.get("rates"), dict) else {}
    for code, defaults in base["rates"].items():
        item = incoming_rates.get(code) if isinstance(incoming_rates.get(code), dict) else {}
        normalized["rates"][code] = {
            "label": defaults["label"],
            "flag": defaults["flag"],
            "value": str(item.get("value", "") or "").strip()[:40],
        }

    return normalized

@public_bp.route('/')
def home():
    return jsonify({'msg':'Home Page'})

@public_bp.route('/demo')
def demo():
    return jsonify({'msg':'Este es un mensaje que viene desde el backend, especificamente la Demo Page... :)'}), 200

@public_bp.route('/about')
def about():
    return jsonify({'msg':'About Page'})

# === RUTAS PÚBLICAS PARA EL CATÁLOGO ===

@public_bp.route('/products', methods=['GET'])
def get_products():
    """Obtener todos los productos activos"""
    try:
        # Parámetros opcionales de filtrado
        category_id = request.args.get('category_id', type=int)
        search = request.args.get('search', '')
        
        # Query base
        query = Product.query.filter(Product.is_active == True)
        
        # Filtrar por búsqueda si se especifica
        if search:
            query = query.filter(Product.name.ilike(f'%{search}%'))
        
        products = [product for product in query.all() if not _is_product_hidden(product)]
        if category_id:
            products = [product for product in products if category_id in _product_category_ids(product)]
        return jsonify([product.serialize() for product in products]), 200
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener productos: ' + str(e)}), 500

@public_bp.route('/products/<int:product_id>', methods=['GET'])
def get_product_by_id(product_id):
    """Obtener un producto específico por ID"""
    try:
        product = Product.query.filter(
            Product.id == product_id, 
            Product.is_active == True
        ).first()
        
        if not product:
            return jsonify({'error': 'Producto no encontrado'}), 404

        if _is_product_hidden(product):
            return jsonify({'error': 'Producto no encontrado'}), 404
            
        return jsonify(product.serialize()), 200
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener producto: ' + str(e)}), 500

@public_bp.route('/categories', methods=['GET'])
def get_categories():
    """Obtener las categorías canónicas del catálogo"""
    try:
        return jsonify(PERFUME_CATEGORY_DEFINITIONS), 200
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener categorías: ' + str(e)}), 500

@public_bp.route('/categories/<int:category_id>/products', methods=['GET'])
def get_products_by_category(category_id):
    """Obtener productos de una categoría específica"""
    try:
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Categoría no encontrada'}), 404
            
        products = Product.query.filter(Product.is_active == True).all()
        products = [
            product for product in products
            if not _is_product_hidden(product) and category_id in _product_category_ids(product)
        ]
        
        return jsonify({
            'category': category.serialize(),
            'products': [product.serialize() for product in products]
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener productos de la categoría: ' + str(e)}), 500

@public_bp.route('/home-featured-products', methods=['GET'])
def get_home_featured_products():
    try:
        product_ids = _get_public_setting(HOME_FEATURED_PRODUCTS_KEY, []) or []
        product_ids = [int(product_id) for product_id in product_ids if int(product_id) > 0]
        if not product_ids:
            return jsonify({'product_ids': []}), 200

        products = Product.query.filter(
            Product.id.in_(product_ids),
            Product.is_active == True
        ).all()
        visible_ids = {
            int(product.id)
            for product in products
            if not _is_product_hidden(product)
        }
        return jsonify({'product_ids': [product_id for product_id in product_ids if product_id in visible_ids]}), 200
    except Exception as e:
        return jsonify({'error': 'Error al obtener productos destacados: ' + str(e)}), 500


@public_bp.route('/home-marquee-settings', methods=['GET'])
def get_home_marquee_settings():
    try:
        settings = _get_public_setting(HOME_MARQUEE_SETTINGS_KEY, DEFAULT_HOME_MARQUEE_SETTINGS)
        return jsonify(_normalize_home_marquee_settings(settings)), 200
    except Exception as e:
        return jsonify({'error': 'Error al obtener cotizaciones de Inicio: ' + str(e)}), 500
    

@public_bp.route('/send-mail', methods=['POST'])
def send_mail():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone")
    message = data.get("message")

    body = f"""
    Nueva solicitud mayorista:
    Nombre: {name}
    Email: {email}
    Teléfono: {phone}
    Mensaje: {message}
    """

    try:
        # 🧠 Forzamos UTF-8 explícitamente
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = "Nueva solicitud mayorista"
        msg["From"] = formataddr(("Web Zarpados Vaps", os.getenv("MAIL_USERNAME")))
        msg["To"] = "nicolasdelfino585@gmail.com"
        msg.set_charset("utf-8")  # 👈 fuerza codificación real

        # 📬 Envío seguro
        with smtplib.SMTP_SSL(os.getenv("MAIL_SERVER"), 465) as server:
            server.login(os.getenv("MAIL_USERNAME"), os.getenv("MAIL_PASSWORD"))
            server.sendmail(
                os.getenv("MAIL_USERNAME"),
                ["nicolasdelfino585@gmail.com"],
                msg.as_string().encode("utf-8")  # 👈 importante: convertir a bytes UTF-8
            )

        return jsonify({"message": "ok"}), 200

    except Exception as e:
        print("⚠️ Error enviando correo:", e)
        return jsonify({"error": str(e)}), 500
        
        
@public_bp.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    folder = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.getcwd(), 'uploads'))
    return send_from_directory(folder, filename, max_age=60*60*24*30)  # cache 30 días



@public_bp.route('/img/<int:image_id>')
def serve_image(image_id: int):
    img = ProductImage.query.get(image_id)
    if not img or not img.bytes:
        abort(404)

    # ETag basado en digest si existe, sino en hash de bytes
    etag = img.digest or hashlib.sha256(img.bytes).hexdigest()

    # Respuesta binaria con cabeceras de caché agresivas
    resp = make_response(img.bytes)
    resp.headers['Content-Type'] = img.mime_type or 'application/octet-stream'
    resp.headers['Cache-Control'] = 'public, max-age=31536000, immutable'  # 1 año + immutable
    resp.headers['ETag'] = etag
    return resp

from app.models import Order, OrderItem, now_cba_naive


@public_bp.route('/orders', methods=['POST'])
def create_order():
    try:
        data = request.get_json() or {}
        shipping_address = data.get("shipping_address") or {}
        if not isinstance(shipping_address, dict):
            shipping_address = {"address": str(shipping_address)}

        billing_address = data.get("billing_address") or {}
        if not isinstance(billing_address, dict):
            billing_address = {}

        coupon_code = str(
            data.get("coupon_code")
            or data.get("coupon")
            or shipping_address.get("coupon")
            or ""
        ).strip()
        shipping_address.pop("coupon", None)

        subtotal_amount = 0
        for item in data.get("order_items", []):
            try:
                qty = int(item.get("quantity", 1) or 1)
            except (TypeError, ValueError):
                qty = 1

            try:
                price = float(item.get("price") or 0)
            except (TypeError, ValueError):
                price = 0

            subtotal_amount += max(0, qty) * max(0, price)

        coupon_snapshot = calculate_discount(subtotal_amount, coupon_code) if coupon_code else None
        if coupon_snapshot:
            billing_address["coupon"] = coupon_snapshot

        customer_phone = (
            data.get("customer_phone")
            or data.get("phone")
            or shipping_address.get("phone")
        )

        order = Order(
            total_amount=float(coupon_snapshot["total"] if coupon_snapshot else round(subtotal_amount)),
            payment_method=data.get("payment_method") or "coordinar",
            customer_first_name=data.get("customer_first_name"),
            customer_phone=customer_phone,
            shipping_address=shipping_address,
            billing_address=billing_address,
            status="pending"
        )

        db.session.add(order)
        db.session.flush()  # obtiene order.id

        for item in data.get("order_items", []):

            # tamaño ml seguro
            raw_size_ml = item.get("selected_size_ml")
            try:
                selected_size_ml = int(raw_size_ml) if raw_size_ml not in (None, "") else None
            except (TypeError, ValueError):
                selected_size_ml = None

            # cantidad segura
            try:
                qty = int(item.get("quantity", 1) or 1)
            except (TypeError, ValueError):
                qty = 1

            # precio seguro
            try:
                price = float(item.get("price") or 0)
            except (TypeError, ValueError):
                price = 0

            product_id = item.get("product_id")

            order_item = OrderItem(
                order_id=order.id,
                product_id=product_id,
                quantity=qty,
                price=price,
                selected_flavor=item.get("selected_flavor"),
                selected_size_ml=selected_size_ml
            )
            db.session.add(order_item)

            # ✅ Descontar stock real para que AdminProducts quede consistente
            if product_id:
                product = Product.query.get(product_id)
            else:
                product = None

            if product:
                try:
                    product.stock = max(0, int(product.stock or 0) - qty)
                except (TypeError, ValueError):
                    product.stock = 0

                if selected_size_ml is not None and product.volume_options:
                    options = json.loads(json.dumps(product.volume_options or []))

                    for row in options:
                        try:
                            row_ml = int(row.get("ml")) if row.get("ml") not in (None, "") else None
                        except (TypeError, ValueError):
                            row_ml = None

                        if row_ml == selected_size_ml:
                            try:
                                row["stock"] = max(0, int(row.get("stock") or 0) - qty)
                            except (TypeError, ValueError):
                                row["stock"] = 0
                            break

                    product.volume_options = options
                    flag_modified(product, "volume_options")

                    try:
                        product.stock = sum(max(0, int(x.get("stock") or 0)) for x in options)
                    except Exception:
                        product.stock = 0

        db.session.commit()

        return jsonify({"msg": "orden creada"}), 201

    except Exception as e:
        db.session.rollback()
        print("ERROR creando orden:", e)
        return jsonify({"error": str(e)}), 500
