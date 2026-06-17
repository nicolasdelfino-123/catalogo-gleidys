"""
Panel de administración para gestionar productos
Este archivo contendrá las rutas administrativas para CRUD de productos
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, text
from sqlalchemy.orm.attributes import flag_modified
from app import db
from app.models import Product, Category, User,ProductImage,now_cba_naive
from flask import current_app, send_from_directory, url_for
from werkzeug.utils import secure_filename
from PIL import Image, ImageOps # pip install pillow
from flask import url_for
# backend/app/routes/admin_bp.py
from flask import Blueprint, request, jsonify, current_app, url_for
import os, io, hashlib, uuid
from app.models import Order, OrderItem  # asegurate que esté arriba también
from flask import redirect
import json
from app.category_config import CATEGORY_ID_TO_NAME, DEFAULT_CATEGORY_ID




admin_bp = Blueprint('admin', __name__)

ADMIN_HIDDEN_ORDER_MARKER = "__ADMIN_HIDDEN__"
ADMIN_SETTINGS_TABLE = "admin_settings"
HOME_FEATURED_PRODUCTS_KEY = "home_featured_product_ids"
HOME_MARQUEE_SETTINGS_KEY = "home_marquee_settings"
PRICE_ADJUSTMENT_ROLLBACK_KEY = "price_adjustment_rollback"
PRICE_ADJUSTMENT_HISTORY_KEY = "price_adjustment_history"
MAX_HOME_FEATURED_PRODUCTS = 12
MULTI_CATEGORY_META_TYPE = "multi_category_meta"
ADMIN_HIDDEN_PRODUCT_KEY = "is_active_product"
BEST_SELLERS_CATEGORY_ID = 999999
BEST_SELLERS_CATEGORY_NAME = "Más Vendidos"
DEFAULT_HOME_MARQUEE_SETTINGS = {
    "enabled": True,
    "custom_text": "Precios referenciales en USD",
    "rates": {
        "usd": {"label": "Dólar", "flag": "🇺🇸", "value": ""},
        "ars": {"label": "Bolívar", "flag": "🇻🇪", "value": ""},
        "brl": {"label": "Peso colombiano", "flag": "🇨🇴", "value": ""},
    },
}

def _ensure_admin_settings_table():
    db.session.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {ADMIN_SETTINGS_TABLE} (
            key VARCHAR(120) PRIMARY KEY,
            value TEXT NOT NULL
        )
    """))

def _get_admin_setting(key, default=None):
    _ensure_admin_settings_table()
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

def _set_admin_setting(key, value):
    _ensure_admin_settings_table()
    payload = json.dumps(value)
    result = db.session.execute(
        text(f"UPDATE {ADMIN_SETTINGS_TABLE} SET value = :value WHERE key = :key"),
        {"key": key, "value": payload},
    )
    if result.rowcount == 0:
        db.session.execute(
            text(f"INSERT INTO {ADMIN_SETTINGS_TABLE} (key, value) VALUES (:key, :value)"),
            {"key": key, "value": payload},
        )

def _delete_admin_setting(key):
    _ensure_admin_settings_table()
    db.session.execute(
        text(f"DELETE FROM {ADMIN_SETTINGS_TABLE} WHERE key = :key"),
        {"key": key},
    )

def _normalize_featured_product_ids(value):
    if not isinstance(value, list):
        return None

    ids = []
    seen = set()
    for raw_id in value:
        try:
            product_id = int(raw_id)
        except Exception:
            return None
        if product_id <= 0:
            return None
        if product_id in seen:
            continue
        seen.add(product_id)
        ids.append(product_id)

    return ids

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

def _serialize_admin_order(order):
    billing_address = dict(order.billing_address or {}) if isinstance(order.billing_address, dict) else order.billing_address

    return {
        "id": order.id,
        "status": order.status,
        "public_order_number": order.public_order_number,
        "total_amount": float(order.total_amount or 0),
        "shipping_cost": float(order.shipping_cost or 0),
        "payment_method": order.payment_method,
        "payment_id": order.payment_id,
        "external_reference": order.external_reference,
        "customer_first_name": order.customer_first_name,
        "customer_last_name": order.customer_last_name,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "customer_comment": order.customer_comment,
        "coupon": billing_address.get("coupon") if isinstance(billing_address, dict) else None,
        "shipping_address": order.shipping_address,
        "billing_address": billing_address,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "order_items": [item.serialize() for item in order.order_items],
        "customer_dni": order.customer_dni,
        "customer_postal_code": (
            order.shipping_address.get("postalCode") if isinstance(order.shipping_address, dict) else None
        ),
    }

def _ensure_category_exists(category_id: int, category_name: str | None = None):
    category_id = int(category_id)
    clean_category_name = str(category_name or "").strip()

    if category_id == BEST_SELLERS_CATEGORY_ID:
        clean_category_name = BEST_SELLERS_CATEGORY_NAME

    if category_id not in CATEGORY_ID_TO_NAME and not clean_category_name:
        category_id = DEFAULT_CATEGORY_ID

    category = Category.query.get(category_id)
    if category:
        return category

    # Si no existe el ID exacto, lo creamos con nombre estable para evitar FK errors.
    name = clean_category_name or CATEGORY_ID_TO_NAME.get(category_id, CATEGORY_ID_TO_NAME[DEFAULT_CATEGORY_ID])
    by_name = Category.query.filter_by(name=name).first()
    if by_name:
        return by_name

    category = Category(
        id=category_id,
        name=name,
        description=f"Categoría auto-creada ({name})"
    )
    db.session.add(category)
    db.session.flush()
    return category

# === Helpers de sabores/stock por sabor ===
def _normalize_catalog(catalog):
    norm = []
    for x in (catalog or []):
        if isinstance(x, dict):
            name = str(x.get('name','')).strip()
            active = bool(x.get('active', True))
            try:
                stock = int(x.get('stock', 0))
            except Exception:
                stock = 0
        else:
            # por si llega string suelto
            name, active, stock = str(x).strip(), True, 0
        norm.append({'name': name, 'active': active, 'stock': max(stock, 0)})
    return norm

def _sum_active_stock(catalog):
    return sum(int(f.get('stock', 0)) for f in (catalog or []) if f.get('active'))

def _normalize_volume_options(rows):
    normalized = []
    for row in (rows or []):
        if not isinstance(row, dict):
            continue

        try:
            ml = int(float(row.get('ml')))
        except Exception:
            continue
        if ml <= 0:
            continue

        price = None
        raw_price = row.get('price')
        if raw_price not in ("", None):
            try:
                val = float(raw_price)
                price = val if val > 0 else None
            except Exception:
                price = None

        price_wholesale = None
        raw_wh = row.get('price_wholesale')
        if raw_wh not in ("", None):
            try:
                val = float(raw_wh)
                price_wholesale = val if val > 0 else None
            except Exception:
                price_wholesale = None

        stock = 0
        raw_stock = row.get('stock')
        if raw_stock not in ("", None):
            try:
                stock = max(0, int(float(raw_stock)))
            except Exception:
                stock = 0

        normalized.append({
            'ml': ml,
            'price': price,
            'price_wholesale': price_wholesale,
            'stock': stock,
        })

    # evita duplicados por ml (último valor gana)
    by_ml = {}
    for item in normalized:
        by_ml[item['ml']] = item
    return [by_ml[k] for k in sorted(by_ml.keys())]

def _sum_volume_stock(rows):
    return sum(max(0, int(x.get('stock', 0) or 0)) for x in (rows or []))

def _is_product_hidden_from_admin(product):
    return any(
        isinstance(item, dict)
        and item.get('__type') == MULTI_CATEGORY_META_TYPE
        and item.get(ADMIN_HIDDEN_PRODUCT_KEY) is False
        for item in (product.flavor_catalog or [])
    )

def _normalize_extra_category_ids(value, primary_category_id=None):
    if not isinstance(value, list):
        return []
    ids = []
    seen = set()
    primary = int(primary_category_id) if primary_category_id not in ("", None) else None
    for raw_id in value:
        try:
            category_id = int(raw_id)
        except Exception:
            continue
        if category_id <= 0 or category_id == primary or category_id in seen:
            continue
        seen.add(category_id)
        ids.append(category_id)
    return ids

def _catalog_with_multi_category_meta(catalog, extra_category_ids=None):
    rows = [dict(item) if isinstance(item, dict) else item for item in (catalog or [])]
    extra_ids = _normalize_extra_category_ids(extra_category_ids)
    meta_found = False

    for item in rows:
        if isinstance(item, dict) and item.get('__type') == MULTI_CATEGORY_META_TYPE:
            item["extra_category_ids"] = extra_ids
            meta_found = True
            break

    if not meta_found and extra_ids:
        rows.append({'__type': MULTI_CATEGORY_META_TYPE, "extra_category_ids": extra_ids})

    return rows

def _product_category_ids(product):
    ids = [int(product.category_id)]
    for item in (product.flavor_catalog or []):
        if isinstance(item, dict) and item.get('__type') == MULTI_CATEGORY_META_TYPE:
            for raw_id in item.get("extra_category_ids") or []:
                try:
                    category_id = int(raw_id)
                except Exception:
                    continue
                if category_id > 0 and category_id not in ids:
                    ids.append(category_id)
    return ids

def _catalog_with_product_hidden_marker(catalog):
    rows = [dict(item) if isinstance(item, dict) else item for item in (catalog or [])]
    for item in rows:
        if isinstance(item, dict) and item.get('__type') == MULTI_CATEGORY_META_TYPE:
            item[ADMIN_HIDDEN_PRODUCT_KEY] = False
            return rows
    return rows + [{'__type': MULTI_CATEGORY_META_TYPE, ADMIN_HIDDEN_PRODUCT_KEY: False}]

# Middleware para verificar que el usuario sea admin
def admin_required():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    return user and user.is_admin

def _serve_spa_for_admin_navigation():
    wants_html = (
        request.method == "GET" and
        request.accept_mimetypes.best_match(["text/html", "application/json"]) == "text/html"
    )
    if wants_html and not request.headers.get("Authorization"):
        return current_app.send_static_file("index.html")
    return None

# =======================
#       PRODUCTOS
# =======================

@admin_bp.route('/products', methods=['POST'])
@jwt_required()
def create_product():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    try:
        data = request.get_json() or {}

        # stock puede venir calculado si flavor_stock_mode = true
        required = ['name', 'price', 'category_id']
        for r in required:
            if r not in data:
                return jsonify({'error': f'Falta el campo requerido: {r}'}), 400

        # ===== precio mayorista opcional =====
        price_wholesale = None
        if data.get('price_wholesale') not in ("", None):
            try:
                price_wholesale = float(data['price_wholesale'])
            except:
                price_wholesale = None

        # ===== soporte de stock por sabor =====
        catalog = _normalize_catalog(data.get('flavor_catalog'))
        flavor_stock_mode = bool(data.get('flavor_stock_mode', False))
        flavor_enabled = bool(data.get('flavor_enabled', False))
        active_flavors = [f['name'] for f in catalog if f.get('active')] if catalog else (data.get('flavors') or [])

        volume_ml = None
        if data.get('volume_ml') not in ("", None):
            try:
                volume_ml = max(0, int(float(data.get('volume_ml'))))
            except Exception:
                volume_ml = None
        volume_options = _normalize_volume_options(data.get('volume_options'))

        # stock total coherente
        if flavor_stock_mode:
            computed_stock = _sum_active_stock(catalog)
        elif len(volume_options) > 0:
            computed_stock = _sum_volume_stock(volume_options)
        else:
            try:
                computed_stock = int(data.get('stock', 0))
            except Exception:
                computed_stock = 0

        safe_category = _ensure_category_exists(int(data['category_id']), data.get('category_name'))
        extra_category_ids = _normalize_extra_category_ids(data.get('extra_category_ids'), safe_category.id)
        for extra_category_id in extra_category_ids:
            _ensure_category_exists(extra_category_id)
        catalog = _catalog_with_multi_category_meta(catalog, extra_category_ids)

        product = Product(
            name=data['name'],
            description=data.get('description', ''),
            short_description=data.get('short_description', ''),
            price=float(data['price']),
            price_wholesale=price_wholesale,   # ✅ AHORA SE GUARDA
            stock=computed_stock,
            category_id=safe_category.id,
            image_url=data.get('image_url', ''),
            brand=data.get('brand', ''),
            is_active=bool(data.get('is_active', True)),

            # sabores visibles (strings)
            flavors=active_flavors,
            flavor_enabled=flavor_enabled,

            # catálogo completo + modo
            flavor_catalog=catalog,
            flavor_stock_mode=flavor_stock_mode,

            volume_ml=volume_ml,
            volume_options=volume_options,

            created_at=now_cba_naive(),
        )
        db.session.add(product)
        db.session.commit()
        return jsonify({'message': 'Producto creado exitosamente', 'product': product.serialize()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al crear producto: {str(e)}'}), 500


@admin_bp.route('/products/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    try:
        data = request.get_json() or {}
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Producto no encontrado'}), 404

        # Actualizaciones parciales de campos de texto simples
        for field in ['name', 'description', 'short_description', 'brand', 'image_url']:
            if field in data:
                setattr(product, field, data[field] or '')

        # numéricos / flags base
      

        if 'price' in data:
            product.price = float(data['price'])

        # ✅ guardar precio mayorista
        if 'price_wholesale' in data:
            try:
                product.price_wholesale = float(data['price_wholesale']) if data['price_wholesale'] not in ("", None) else None
            except:
                product.price_wholesale = None

        if 'category_id' in data:
            next_category_id = int(data['category_id'])
            safe_category = _ensure_category_exists(next_category_id, data.get('category_name'))
            product.category_id = safe_category.id
        if 'extra_category_ids' in data:
            extra_category_ids = _normalize_extra_category_ids(data.get('extra_category_ids'), product.category_id)
            for extra_category_id in extra_category_ids:
                _ensure_category_exists(extra_category_id)
            product.flavor_catalog = _catalog_with_multi_category_meta(product.flavor_catalog or [], extra_category_ids)
            flag_modified(product, "flavor_catalog")
        if 'is_active' in data:
            product.is_active = bool(data['is_active'])
        if 'volume_ml' in data:
            try:
                raw = data.get('volume_ml')
                product.volume_ml = None if raw in ("", None) else max(0, int(float(raw)))
            except Exception:
                product.volume_ml = None
        volume_options_updated = False
        if 'volume_options' in data:
            product.volume_options = _normalize_volume_options(data.get('volume_options'))
            volume_options_updated = True
        # 🔥 AGREGAR ESTO
        if volume_options_updated and product.volume_options and len(product.volume_options) > 0:
            first = product.volume_options[0]
            if first.get('price') is not None:
                product.price = float(first.get('price'))
            if first.get('price_wholesale') is not None:
                product.price_wholesale = float(first.get('price_wholesale'))


        # ===== NUEVO: catálogo y modo =====
        if ('flavor_catalog' in data) or ('flavor_stock_mode' in data) or ('flavor_enabled' in data) or ('flavors' in data):
            catalog = _normalize_catalog(data.get('flavor_catalog') if 'flavor_catalog' in data else product.flavor_catalog)
            product.flavor_catalog = catalog

            if 'flavor_stock_mode' in data:
                product.flavor_stock_mode = bool(data['flavor_stock_mode'])

            if 'flavor_enabled' in data:
                product.flavor_enabled = bool(data['flavor_enabled'])

            # flavors visibles = nombres de los activos del catálogo (si hay), sino respeta 'flavors'
            if catalog:
                product.flavors = [f['name'] for f in catalog if f.get('active')]
            elif 'flavors' in data:
                product.flavors = data.get('flavors', []) or []

            if 'extra_category_ids' in data:
                extra_category_ids = _normalize_extra_category_ids(data.get('extra_category_ids'), product.category_id)
                product.flavor_catalog = _catalog_with_multi_category_meta(product.flavor_catalog or [], extra_category_ids)
                flag_modified(product, "flavor_catalog")

            # stock total coherente
            if product.flavor_stock_mode:
                product.stock = _sum_active_stock(catalog)
            elif 'stock' in data:
                try:
                    product.stock = int(data['stock'])
                except Exception:
                    product.stock = 0
            elif volume_options_updated:
                product.stock = _sum_volume_stock(product.volume_options or [])
        else:
            # sin cambios de catálogo: respetar 'stock' si vino
            if 'stock' in data:
                try:
                    product.stock = int(data['stock'])
                except Exception:
                    product.stock = 0
            elif volume_options_updated and not product.flavor_stock_mode:
                product.stock = _sum_volume_stock(product.volume_options or [])
        product.created_at = now_cba_naive()
        db.session.commit()
        return jsonify({'message': 'Producto actualizado exitosamente', 'product': product.serialize()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al actualizar producto: {str(e)}'}), 500


@admin_bp.route('/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Producto no encontrado'}), 404

        product.flavor_catalog = _catalog_with_product_hidden_marker(product.flavor_catalog)
        flag_modified(product, "flavor_catalog")

        db.session.commit()
        return jsonify({'message': 'Producto ocultado', 'product_id': product_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar producto: {str(e)}'}), 500



@admin_bp.route('/products', methods=['GET'])
@jwt_required(optional=True)
def get_all_products_admin():
    """Obtener todos los productos (incluyendo inactivos) para admin"""
    spa_response = _serve_spa_for_admin_navigation()
    if spa_response:
        return spa_response

    if not admin_required():
        return jsonify({'error': 'Acceso denegado. Se requieren permisos de administrador.'}), 403
    
    try:
        products = [product for product in Product.query.all() if not _is_product_hidden_from_admin(product)]
        return jsonify([product.serialize() for product in products]), 200
        
    except Exception as e:
        return jsonify({'error': f'Error al obtener productos: {str(e)}'}), 500


def _round_price_without_cents(value, factor):
    if value in ("", None):
        return None
    try:
        numeric = float(value)
    except Exception:
        return None
    if numeric <= 0:
        return numeric
    return max(0, int(round(numeric * factor)))

def _adjust_volume_prices_by_scope(volume_options, factor, price_scope):
    next_options = []
    for row in (volume_options or []):
        if not isinstance(row, dict):
            continue
        next_row = dict(row)
        if price_scope in ("both", "retail"):
            next_row["price"] = _round_price_without_cents(next_row.get("price"), factor)
        if price_scope in ("both", "wholesale"):
            next_row["price_wholesale"] = _round_price_without_cents(next_row.get("price_wholesale"), factor)
        next_options.append(next_row)
    return next_options

def _price_scope_label(price_scope):
    if price_scope == "retail":
        return "solo minorista"
    if price_scope == "wholesale":
        return "solo mayorista"
    return "minorista y mayorista"

def _serialize_price_adjustment(setting):
    if not setting:
        return {"pending": False, "adjustment": None}
    products = setting.get("products") if isinstance(setting, dict) else []
    target_type = setting.get("target_type", "category")
    target_label = setting.get("target_label") or setting.get("category_label") or "Categoria"
    return {
        "pending": True,
        "adjustment": {
            "id": setting.get("id"),
            "target_type": target_type,
            "target_label": target_label,
            "category_ids": setting.get("category_ids", []),
            "category_label": target_label,
            "brand": setting.get("brand"),
            "price_scope": setting.get("price_scope", "both"),
            "price_scope_label": _price_scope_label(setting.get("price_scope", "both")),
            "percent": setting.get("percent", 0),
            "affected_count": len(products or []),
            "created_at": setting.get("created_at"),
        },
    }

def _get_price_adjustment_history():
    history = _get_admin_setting(PRICE_ADJUSTMENT_HISTORY_KEY, []) or []
    return history if isinstance(history, list) else []

def _set_price_adjustment_history(history):
    _set_admin_setting(PRICE_ADJUSTMENT_HISTORY_KEY, history)

def _public_price_adjustment_record(record):
    products = record.get("products") if isinstance(record, dict) else []
    target_type = record.get("target_type", "category")
    target_label = record.get("target_label") or record.get("category_label") or record.get("brand") or "Seleccion"
    return {
        "id": record.get("id"),
        "target_type": target_type,
        "target_label": target_label,
        "category_ids": record.get("category_ids", []),
        "category_label": record.get("category_label"),
        "brand": record.get("brand"),
        "price_scope": record.get("price_scope", "both"),
        "price_scope_label": _price_scope_label(record.get("price_scope", "both")),
        "percent": record.get("percent", 0),
        "affected_count": len(products or []),
        "created_at": record.get("created_at"),
        "status": record.get("status", "pending"),
    }

def _serialize_price_adjustment_history():
    history = _get_price_adjustment_history()
    return [_public_price_adjustment_record(item) for item in reversed(history)]

def _restore_price_adjustment_record(record):
    restored = 0
    for snapshot in record.get("products", []):
        product = Product.query.get(snapshot.get("id"))
        if not product:
            continue
        product.price = float(snapshot.get("price") or 0)
        raw_wholesale = snapshot.get("price_wholesale")
        product.price_wholesale = float(raw_wholesale) if raw_wholesale not in ("", None) else None
        product.volume_options = _normalize_volume_options(snapshot.get("volume_options") or [])
        flag_modified(product, "volume_options")
        restored += 1
    return restored

@admin_bp.route('/price-adjustment', methods=['GET'])
@jwt_required()
def get_price_adjustment():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    setting = _get_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY, None)
    return jsonify(_serialize_price_adjustment(setting)), 200


@admin_bp.route('/price-adjustment/history', methods=['GET'])
@jwt_required()
def get_price_adjustment_history():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    return jsonify({'history': _serialize_price_adjustment_history()}), 200


@admin_bp.route('/price-adjustment/apply', methods=['POST'])
@jwt_required()
def apply_price_adjustment():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    try:
        pending = _get_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY, None)
        if pending:
            return jsonify({'error': 'Ya hay un ajuste pendiente. Confirmalo o deshacelo antes de aplicar otro.'}), 409

        data = request.get_json() or {}
        target_type = str(data.get('target_type') or 'category').strip().lower()
        if target_type not in ('category', 'brand'):
            return jsonify({'error': 'Elegí si el ajuste es por categoría o por marca.'}), 400

        price_scope = str(data.get('price_scope') or 'both').strip().lower()
        if price_scope not in ('both', 'retail', 'wholesale'):
            return jsonify({'error': 'Elegí si el ajuste aplica a minorista, mayorista o ambos.'}), 400

        try:
            percent = float(data.get('percent'))
        except Exception:
            return jsonify({'error': 'Ingresá un porcentaje válido.'}), 400

        if percent == 0 or percent <= -100 or percent > 1000:
            return jsonify({'error': 'Ingresá un porcentaje entre -99 y 1000, distinto de 0.'}), 400

        factor = 1 + (percent / 100)

        category_ids = []
        brand = None
        if target_type == 'brand':
            brand = str(data.get('brand') or '').strip()
            if not brand:
                return jsonify({'error': 'Elegí una marca válida.'}), 400
            products = Product.query.filter(Product.brand == brand).all()
            target_label = brand
        else:
            raw_category_ids = data.get('category_ids') or []
            seen = set()
            for raw_id in raw_category_ids:
                try:
                    category_id = int(raw_id)
                except Exception:
                    continue
                if category_id > 0 and category_id not in seen:
                    seen.add(category_id)
                    category_ids.append(category_id)

            if not category_ids:
                return jsonify({'error': 'Elegí una categoría válida.'}), 400
            products = [
                product for product in Product.query.all()
                if any(category_id in _product_category_ids(product) for category_id in category_ids)
            ]
            target_label = str(data.get('category_label') or 'Categoria')

        products = [product for product in products if not _is_product_hidden_from_admin(product)]

        if not products:
            return jsonify({'error': 'No hay productos visibles para ese criterio.'}), 400

        rollback_products = []
        for product in products:
            rollback_products.append({
                "id": product.id,
                "price": product.price,
                "price_wholesale": product.price_wholesale,
                "volume_options": product.volume_options or [],
            })

            if price_scope in ('both', 'retail'):
                product.price = _round_price_without_cents(product.price, factor) or 0
            if price_scope in ('both', 'wholesale'):
                product.price_wholesale = _round_price_without_cents(product.price_wholesale, factor)
            product.volume_options = _normalize_volume_options(_adjust_volume_prices_by_scope(product.volume_options or [], factor, price_scope))
            flag_modified(product, "volume_options")

        rollback = {
            "id": str(uuid.uuid4()),
            "target_type": target_type,
            "target_label": target_label,
            "category_ids": category_ids,
            "category_label": target_label if target_type == 'category' else None,
            "brand": brand,
            "price_scope": price_scope,
            "percent": percent,
            "created_at": now_cba_naive().isoformat(),
            "status": "pending",
            "products": rollback_products,
        }
        _set_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY, rollback)
        history = _get_price_adjustment_history()
        history.append(rollback)
        _set_price_adjustment_history(history)
        db.session.commit()

        return jsonify({
            'message': 'Precios actualizados',
            **_serialize_price_adjustment(rollback),
            'history': _serialize_price_adjustment_history(),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al ajustar precios: {str(e)}'}), 500


@admin_bp.route('/price-adjustment/undo', methods=['POST'])
@jwt_required()
def undo_price_adjustment():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    try:
        data = request.get_json(silent=True) or {}
        adjustment_id = str(data.get("id") or "").strip()
        pending = _get_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY, None)
        history = _get_price_adjustment_history()

        record = None
        if adjustment_id:
            record = next((item for item in history if str(item.get("id")) == adjustment_id), None)
        else:
            record = pending

        if not record:
            return jsonify({'error': 'No se encontró el ajuste para deshacer.'}), 404

        restored = _restore_price_adjustment_record(record)
        for item in history:
            if str(item.get("id")) == str(record.get("id")):
                item["status"] = "undone"

        if pending and str(pending.get("id")) == str(record.get("id")):
            _delete_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY)

        _set_price_adjustment_history(history)
        db.session.commit()
        return jsonify({
            'message': 'Ajuste deshecho',
            'restored_count': restored,
            'pending': False,
            'adjustment': None,
            'history': _serialize_price_adjustment_history(),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al deshacer ajuste: {str(e)}'}), 500


@admin_bp.route('/price-adjustment/confirm', methods=['POST'])
@jwt_required()
def confirm_price_adjustment():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    try:
        pending = _get_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY, None)
        if pending:
            history = _get_price_adjustment_history()
            for item in history:
                if str(item.get("id")) == str(pending.get("id")):
                    item["status"] = "confirmed"
            _set_price_adjustment_history(history)
        _delete_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY)
        db.session.commit()
        return jsonify({
            'message': 'Ajuste confirmado',
            'pending': False,
            'adjustment': None,
            'history': _serialize_price_adjustment_history(),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al confirmar ajuste: {str(e)}'}), 500


@admin_bp.route('/price-adjustment/history/<adjustment_id>', methods=['DELETE'])
@jwt_required()
def delete_price_adjustment_history_item(adjustment_id):
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403
    try:
        history = _get_price_adjustment_history()
        next_history = [item for item in history if str(item.get("id")) != str(adjustment_id)]
        if len(next_history) == len(history):
            return jsonify({'error': 'Ajuste no encontrado.'}), 404

        pending = _get_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY, None)
        if pending and str(pending.get("id")) == str(adjustment_id):
            _delete_admin_setting(PRICE_ADJUSTMENT_ROLLBACK_KEY)

        _set_price_adjustment_history(next_history)
        db.session.commit()
        return jsonify({
            'message': 'Ajuste eliminado del historial',
            'history': _serialize_price_adjustment_history(),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar ajuste del historial: {str(e)}'}), 500


@admin_bp.route('/home-featured-products', methods=['GET'])
@jwt_required()
def get_home_featured_products():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado. Se requieren permisos de administrador.'}), 403

    try:
        product_ids = _get_admin_setting(HOME_FEATURED_PRODUCTS_KEY, []) or []
        product_ids = _normalize_featured_product_ids(product_ids) or []
        return jsonify({'product_ids': product_ids}), 200
    except Exception as e:
        return jsonify({'error': f'Error al obtener destacados de Inicio: {str(e)}'}), 500


@admin_bp.route('/home-featured-products', methods=['PUT'])
@jwt_required()
def update_home_featured_products():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado. Se requieren permisos de administrador.'}), 403

    try:
        data = request.get_json() or {}
        product_ids = _normalize_featured_product_ids(data.get('product_ids'))
        if product_ids is None:
            return jsonify({'error': 'product_ids debe ser una lista de IDs numéricos'}), 400

        if len(product_ids) > MAX_HOME_FEATURED_PRODUCTS:
            return jsonify({'error': f'Solo podés seleccionar hasta {MAX_HOME_FEATURED_PRODUCTS} productos para Inicio.'}), 400

        existing_ids = set()
        if product_ids:
            rows = db.session.query(Product.id).filter(Product.id.in_(product_ids)).all()
            existing_ids = {int(row[0]) for row in rows}

        missing_ids = [product_id for product_id in product_ids if product_id not in existing_ids]
        if missing_ids:
            return jsonify({'error': 'Hay productos inexistentes en la selección', 'missing_ids': missing_ids}), 400

        _set_admin_setting(HOME_FEATURED_PRODUCTS_KEY, product_ids)
        db.session.commit()

        return jsonify({'product_ids': product_ids}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al guardar destacados de Inicio: {str(e)}'}), 500


@admin_bp.route('/home-marquee-settings', methods=['GET'])
@jwt_required()
def get_home_marquee_settings():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado. Se requieren permisos de administrador.'}), 403

    try:
        settings = _get_admin_setting(HOME_MARQUEE_SETTINGS_KEY, DEFAULT_HOME_MARQUEE_SETTINGS)
        return jsonify(_normalize_home_marquee_settings(settings)), 200
    except Exception as e:
        return jsonify({'error': f'Error al obtener cotizaciones de Inicio: {str(e)}'}), 500


@admin_bp.route('/home-marquee-settings', methods=['PUT'])
@jwt_required()
def update_home_marquee_settings():
    if not admin_required():
        return jsonify({'error': 'Acceso denegado. Se requieren permisos de administrador.'}), 403

    try:
        settings = _normalize_home_marquee_settings(request.get_json() or {})
        _set_admin_setting(HOME_MARQUEE_SETTINGS_KEY, settings)
        db.session.commit()
        return jsonify(settings), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al guardar cotizaciones de Inicio: {str(e)}'}), 500


# =======================
#       CATEGORÍAS
# =======================

@admin_bp.route('/categories', methods=['POST'])
@jwt_required()
def create_category():
    """Crear una nueva categoría (solo admin)"""
    if not admin_required():
        return jsonify({'error': 'Acceso denegado. Se requieren permisos de administrador.'}), 403
    
    try:
        data = request.get_json() or {}
        
        if 'name' not in data:
            return jsonify({'error': 'Campo requerido: name'}), 400
        
        category = Category(
            name=data['name'],
            description=data.get('description', '')
        )
        
        db.session.add(category)
        db.session.commit()
        
        return jsonify({
            'message': 'Categoría creada exitosamente',
            'category': category.serialize()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al crear categoría: {str(e)}'}), 500




@admin_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_image():
    """
    Sube una imagen desde Admin, la optimiza y la guarda en la BD (ProductImage).
    Devuelve la URL interna: /public/img/<id>
    Campos aceptados (form-data):
      - image: archivo
      - product_id (opcional): int para asociar al producto
      - format (opcional): 'webp' | 'jpeg' (default: webp)
      - max_size (opcional): lado mayor, int (default: 1600)
    """
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403

    file = request.files.get('image')
    if not file:
        return jsonify({'error': 'Falta el archivo "image"'}), 400

    # Parámetros opcionales
    target_format = (request.form.get('format') or 'webp').lower()
    max_size = int(request.form.get('max_size') or 1600)
    product_id = request.form.get('product_id')
    product_id = int(product_id) if product_id and product_id.isdigit() else None

    # Leer bytes originales (para digest/ETag)
    original_bytes = file.read()
    if not original_bytes:
        return jsonify({'error': 'Archivo vacío'}), 400

    # Abrir con Pillow y normalizar orientación
    try:
        img = Image.open(io.BytesIO(original_bytes))
        img = ImageOps.exif_transpose(img)
        # Convertimos a RGB para evitar problemas de modo (p.ej. PNG con alpha → lo podés mantener si querés)
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGB')
    except Exception as e:
        return jsonify({'error': f'No se pudo leer la imagen: {str(e)}'}), 400

    # Resize "thumbnail" mantiene aspect ratio
    img.thumbnail((max_size, max_size))

    # Serializar optimizada a bytes en memoria
    out = io.BytesIO()
    if target_format == 'jpeg':
        # JPEG progresivo
        img = img.convert('RGB')
        img.save(out, format='JPEG', quality=82, optimize=True, progressive=True)
        mime = 'image/jpeg'
    else:
        # WEBP (recomendado: más liviano, soporte general actual)
        # Si hay alpha y querés preservarla:
        if img.mode == 'RGBA':
            img.save(out, format='WEBP', quality=80, method=6, lossless=False)
        else:
            img.save(out, format='WEBP', quality=80, method=6)
        mime = 'image/webp'

    optimized_bytes = out.getvalue()
    width, height = img.size

    # Digest para ETag/caché y deduplicación opcional
    digest = hashlib.sha256(optimized_bytes).hexdigest()

    # Guardar en BD
    db_image = ProductImage(
        product_id=product_id,
        mime_type=mime,
        bytes=optimized_bytes,
        width=width,
        height=height,
        digest=digest,
        created_at=now_cba_naive(),
    )
    db.session.add(db_image)
    db.session.commit()

    # URL interna que sirve desde la BD
    img_url = url_for('public.serve_image', image_id=db_image.id)

# Si vino product_id, asociamos la imagen y, SOLO si no hay principal o si el admin lo pide,
# la dejamos como principal (no pisamos siempre).
    if product_id:
        product = Product.query.get(product_id)
        if product:
            set_as_main = (request.form.get('as_main') in ('1', 'true', 'yes')) or not product.image_url
            if set_as_main:
                product.image_url = img_url
            db.session.commit()

    return jsonify({'url': img_url, 'image_id': db_image.id}), 201


# --- NUEVO: asociar imágenes huérfanas a un producto ---
@admin_bp.route('/products/<int:product_id>/attach-images', methods=['POST'])
@jwt_required()
def attach_images(product_id):
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403

    data = request.get_json() or {}
    image_ids = data.get('image_ids') or []
    main_id = data.get('main_id')  # opcional: id de la imagen principal

    if not isinstance(image_ids, list):
        return jsonify({'error': 'image_ids debe ser lista de enteros'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Producto no encontrado'}), 404

    # Buscar y asociar
    imgs = ProductImage.query.filter(ProductImage.id.in_(image_ids)).all()
    for im in imgs:
        im.product_id = product_id
    db.session.commit()

    # Si mandaste main_id, setear imagen principal (sin pisar si ya hay una a menos que la pidas)
    if main_id:
        try:
            main_id = int(main_id)
            # armamos la misma URL que devolvés al subir (/public/img/<id>)
            product.image_url = f"/public/img/{main_id}"
            db.session.commit()
        except Exception:
            db.session.rollback()

    return jsonify({
        'message': f'{len(imgs)} imágenes asociadas al producto {product_id}.',
        'attached_ids': [im.id for im in imgs],
        'product_id': product_id
    }), 200


# --- NUEVO: eliminar imagen por ID ---
@admin_bp.route('/images/<int:image_id>', methods=['DELETE'])
@jwt_required()
def delete_image(image_id):
    if not admin_required():
        return jsonify({'error': 'Acceso denegado.'}), 403

    img = ProductImage.query.get(image_id)
    if not img:
        return jsonify({'error': 'Imagen no encontrada'}), 404

    # Guardamos el product_id antes de borrar para poder ajustar principal
    pid = img.product_id

    db.session.delete(img)
    db.session.commit()

    # Si estaba asociada a un producto y la principal del producto apuntaba a esta imagen,
    # reasignar principal a otra imagen del mismo producto (si existe), o dejar None.
    if pid:
        product = Product.query.get(pid)
        if product:
            # ¿La principal apuntaba a /public/img/<image_id>?
            current = (product.image_url or '').strip()
            is_same = current.endswith(f"/public/img/{image_id}") or current == f"/public/img/{image_id}"
            if is_same:
                # Buscar otra imagen del producto
                next_img = ProductImage.query.filter_by(product_id=pid).order_by(ProductImage.id.asc()).first()
                product.image_url = f"/public/img/{next_img.id}" if next_img else None
                db.session.commit()

    return jsonify({'message': f'Imagen {image_id} eliminada'}), 200


# =======================
#        PEDIDOS (ADMIN)
# =======================



@admin_bp.route("/orders", methods=["GET"])
@jwt_required(optional=True)
def admin_get_orders():
    """Obtener todos los pedidos (para el panel de administración)."""
    spa_response = _serve_spa_for_admin_navigation()
    if spa_response:
        return spa_response

    if not admin_required():
        return jsonify({"error": "Acceso denegado. Se requieren permisos de administrador."}), 403

    try:
        orders = (
            Order.query
            .filter(or_(Order.tracking_code.is_(None), Order.tracking_code != ADMIN_HIDDEN_ORDER_MARKER))
            .order_by(Order.created_at.desc())
            .all()
        )
        serialized = []

        for o in orders:
            serialized.append(_serialize_admin_order(o))

        return jsonify(serialized), 200

    except Exception as e:
        return jsonify({"error": f"Error al obtener pedidos: {str(e)}"}), 500


@admin_bp.route("/orders/<int:order_id>", methods=["DELETE"])
@jwt_required()
def admin_hide_order(order_id):
    """Oculta un pedido del panel admin sin borrarlo de la base de datos."""
    if not admin_required():
        return jsonify({"error": "Acceso denegado"}), 403

    try:
        order = Order.query.get(order_id)
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404

        order.tracking_code = ADMIN_HIDDEN_ORDER_MARKER
        order.updated_at = now_cba_naive()
        db.session.commit()

        return jsonify({
            "message": f"Pedido #{order.public_order_number or order.id} ocultado del panel admin",
            "order_id": order_id,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al ocultar pedido: {str(e)}"}), 500



@admin_bp.route("/orders/<int:order_id>/status", methods=["PUT"])
@jwt_required()
def admin_update_order_status(order_id):
    if not admin_required():
        return jsonify({"error": "Acceso denegado"}), 403

    try:
        data = request.get_json() or {}
        new_status = (data.get("status") or "").strip().lower()
        tracking_code = (data.get("tracking_code") or "").strip()

        valid_statuses = ["pending", "pagado", "enviado", "cancelado"]
        if new_status not in valid_statuses:
            return jsonify({"error": f"Estado inválido"}), 400

        order = Order.query.get(order_id)
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404

        order.status = new_status
        if tracking_code:
            order.tracking_code = tracking_code
        order.updated_at = now_cba_naive()
        db.session.commit()

        # ✅ Enviar mail si se marca como enviado
        if new_status == "enviado" and order.customer_email:
            from flask_mail import Message
            from app import mail

            # Construir el cuerpo del mensaje según haya código o no
            if tracking_code:
                tracking_line = f"El código de seguimiento es: {tracking_code}.\n\n"
            else:
                tracking_line = ""

            msg = Message(
                subject="Tu pedido está en camino 🚚",
                recipients=[order.customer_email],
                body=(
                    f"Hola {order.customer_first_name or ''},\n\n"
                    f"Tu pedido #{order.public_order_number or order.id} fue enviado.\n"
                    f"{tracking_line}"
                    "¡Gracias por tu compra!\nZarpados."
                ),
            )

            mail.send(msg)

        return jsonify({
           "message": f"Pedido #{order.public_order_number or order.id} actualizado a '{new_status}'",
            "order": order.serialize()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
# Alias temporal para compatibilidad con /admin/pedidos
from flask import redirect

# Alias temporal para compatibilidad con /admin/pedidos
@admin_bp.route("/pedidos", methods=["GET"])
@jwt_required(optional=True)
def alias_pedidos():
    spa_response = _serve_spa_for_admin_navigation()
    if spa_response:
        return spa_response

    if not admin_required():
        return jsonify({"error": "Acceso denegado"}), 403
    try:
        orders = (
            Order.query
            .filter(or_(Order.tracking_code.is_(None), Order.tracking_code != ADMIN_HIDDEN_ORDER_MARKER))
            .order_by(Order.created_at.desc())
            .all()
        )
        serialized = [
            _serialize_admin_order(o)
            for o in orders
        ]
        return jsonify(serialized), 200
    except Exception as e:
        return jsonify({"error": f"Error al obtener pedidos: {str(e)}"}), 500
