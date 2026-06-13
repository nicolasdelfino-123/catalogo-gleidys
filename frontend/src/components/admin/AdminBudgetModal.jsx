import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "../../utils/price.js";
import { storeConfig } from "../../config/storeConfig.js";

const PRICE_MODE_RETAIL = "retail";
const PRICE_MODE_WHOLESALE = "wholesale";
const CUSTOM_QTY_VALUE = "custom";

const getBasePrice = (item, priceMode) => {
    if (priceMode === PRICE_MODE_WHOLESALE) {
        return Number.isFinite(Number(item?.wholesalePrice)) && Number(item.wholesalePrice) > 0
            ? Number(item.wholesalePrice)
            : 0;
    }

    return Number.isFinite(Number(item?.retailPrice)) && Number(item.retailPrice) > 0
        ? Number(item.retailPrice)
        : 0;
};

const normalizeDigits = (value = "") => String(value || "").replace(/[^\d]/g, "");
const sanitizePriceDraft = (value = "") =>
    String(value || "").replace(/[^\d,.\s]/g, "").replace(/\s+/g, "");

const normalizePhonePrefixOption = (option) => {
    if (typeof option === "string" || typeof option === "number") {
        const value = normalizeDigits(option);
        return value ? { label: `+${value}`, value, placeholder: "" } : null;
    }

    if (!option || typeof option !== "object") return null;

    const value = normalizeDigits(option.value || option.prefix || option.code || option.phonePrefix);
    if (!value) return null;

    return {
        label: option.label || `+${value}`,
        value,
        placeholder: option.placeholder || "",
    };
};

const getPhonePrefixOptions = () => {
    const configured = storeConfig.contact?.phonePrefixes || ["56"];
    const options = (Array.isArray(configured) ? configured : Object.values(configured))
        .map(normalizePhonePrefixOption)
        .filter(Boolean);

    return options.length > 0 ? options : [{ label: "+56", value: "56", placeholder: "" }];
};

const parsePriceDraft = (value = "") => {
    const raw = sanitizePriceDraft(value);
    if (!raw) return 0;

    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    const hasComma = lastComma >= 0;
    const hasDot = lastDot >= 0;

    let normalized = raw.replace(/[.,]/g, "");

    if (hasComma || hasDot) {
        const separatorIndex = Math.max(lastComma, lastDot);
        const decimalPart = raw.slice(separatorIndex + 1).replace(/[.,]/g, "");
        const integerPart = raw.slice(0, separatorIndex).replace(/[.,]/g, "") || "0";
        const hasMixedSeparators = hasComma && hasDot;
        const treatAsDecimal =
            decimalPart.length > 0 &&
            (hasMixedSeparators || decimalPart.length <= 2);

        normalized = treatAsDecimal ? `${integerPart}.${decimalPart}` : `${integerPart}${decimalPart}`;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatEditablePrice = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "";
    if (Number.isInteger(num)) return String(num);
    return String(num).replace(".", ",");
};

const buildBudgetMessage = ({
    customerName = "",
    items = [],
    prices = {},
    priceMode = PRICE_MODE_RETAIL,
}) => {
    const safeName = String(customerName || "").trim();
    const title = priceMode === PRICE_MODE_WHOLESALE ? "presupuesto mayorista" : "presupuesto";
    const greeting = safeName ? `Hola ${safeName},` : "Hola,";

    const lines = items.map((item) => {
        const price = Number(prices[item.id] ?? 0);
        const mlSuffix = item.mlLabel ? ` ${item.mlLabel}` : "";
        const currency = priceMode === PRICE_MODE_WHOLESALE ? "$" : "$";
        const totalLine = price > 0 ? ` - ${currency} ${formatPrice(price)}` : " - Consultar";
        return `- ${item.quantity}x ${item.name}${mlSuffix}${totalLine}`;
    });

    const total = items.reduce((acc, item) => acc + (Number(prices[item.id] ?? 0) * Number(item.quantity || 0)), 0);
    const currency = priceMode === PRICE_MODE_WHOLESALE ? "$" : "$";

    return [
        greeting,
        "",
        `Aca va el ${title} solicitado:`,
        "",
        ...lines,
        "",
        `Total: ${currency} ${formatPrice(total)}`,
        "",
        "Cualquier ajuste que necesites, te lo preparo.",
    ].join("\n");
};

export default function AdminBudgetModal({
    open = false,
    items = [],
    onClose = () => { },
    onRemoveItem = () => { },
}) {
    const phonePrefixOptions = useMemo(() => getPhonePrefixOptions(), []);
    const [priceMode, setPriceMode] = useState(PRICE_MODE_RETAIL);
    const [prices, setPrices] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [editingDraft, setEditingDraft] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [phonePrefix, setPhonePrefix] = useState(phonePrefixOptions[0]?.value || "56");
    const [phone, setPhone] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const [manualItems, setManualItems] = useState([]);
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: "",
        quantity: 1,
        quantityMode: "1",
        quantityDraft: "",
        isEditingCustomQuantity: false,
        ml: "",
        priceDraft: "",
    });
    const previewRef = useRef(null);
    const previousPriceModeRef = useRef(PRICE_MODE_RETAIL);
    const emptyNewProduct = {
        name: "",
        quantity: 1,
        quantityMode: "1",
        quantityDraft: "",
        isEditingCustomQuantity: false,
        ml: "",
        priceDraft: "",
    };

    useEffect(() => {
        if (!open) return;

        setPriceMode(PRICE_MODE_RETAIL);
        setCustomerName("");
        setPhonePrefix(phonePrefixOptions[0]?.value || "56");
        setPhone("");
        setShowPreview(false);
        setEditingId(null);
        setEditingDraft("");
        setManualItems([]);
        setShowAddProduct(false);
        setNewProduct(emptyNewProduct);
    }, [open, phonePrefixOptions]);

    useEffect(() => {
        if (!open) return;

        const priceModeChanged = previousPriceModeRef.current !== priceMode;
        setPrices((prev) => {
            const nextPrices = {};
            for (const item of items) {
                nextPrices[item.id] =
                    !priceModeChanged && prev[item.id] !== undefined
                        ? Number(prev[item.id] ?? 0)
                        : getBasePrice(item, priceMode);
            }
            for (const item of manualItems) {
                nextPrices[item.id] =
                    !priceModeChanged && prev[item.id] !== undefined
                        ? Number(prev[item.id] ?? 0)
                        : getBasePrice(item, priceMode);
            }
            return nextPrices;
        });
        previousPriceModeRef.current = priceMode;
    }, [items, manualItems, open, priceMode]);

    const budgetItems = useMemo(() => [...items, ...manualItems], [items, manualItems]);

    const total = useMemo(
        () => budgetItems.reduce((acc, item) => acc + (Number(prices[item.id] ?? 0) * Number(item.quantity || 0)), 0),
        [budgetItems, prices]
    );

    const messagePreview = useMemo(
        () => buildBudgetMessage({ customerName, items: budgetItems, prices, priceMode }),
        [customerName, budgetItems, prices, priceMode]
    );

    useEffect(() => {
        if (!showPreview) return;

        requestAnimationFrame(() => {
            previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }, [showPreview, messagePreview]);

    if (!open) return null;

    const selectedPhonePrefix = phonePrefixOptions.find((option) => option.value === phonePrefix) || phonePrefixOptions[0];
    const canSend = budgetItems.length > 0 && customerName.trim() && selectedPhonePrefix?.value && normalizeDigits(phone).length >= 8;

    const applyCustomQuantity = () => {
        const qty = Math.max(1, Number(newProduct.quantityDraft) || 1);
        setNewProduct((prev) => ({
            ...prev,
            quantity: qty,
            quantityMode: qty <= 10 ? String(qty) : CUSTOM_QTY_VALUE,
            quantityDraft: String(qty),
            isEditingCustomQuantity: false,
        }));
    };

    const addManualProduct = () => {
        const name = String(newProduct.name || "").trim();
        if (!name) return;

        const quantity = Math.max(1, Number(newProduct.quantity) || 1);
        const mlValue = String(newProduct.ml || "").trim();
        const unitPrice = parsePriceDraft(newProduct.priceDraft);
        const id = `manual-${Date.now()}`;
        const normalizedMlLabel = mlValue
            ? (/\bml\b/i.test(mlValue) ? mlValue : `${mlValue} ML`)
            : "Sin ML";

        setManualItems((prev) => [
            ...prev,
            {
                id,
                name,
                quantity,
                ml: mlValue,
                mlLabel: normalizedMlLabel,
                retailPrice: unitPrice,
                wholesalePrice: unitPrice,
                isManual: true,
            },
        ]);
        setPrices((prev) => ({ ...prev, [id]: unitPrice }));
        setNewProduct(emptyNewProduct);
        setShowAddProduct(false);
    };

    const removeBudgetItem = (itemId) => {
        if (String(itemId).startsWith("manual-")) {
            setManualItems((prev) => prev.filter((item) => item.id !== itemId));
            setPrices((prev) => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });
            return;
        }
        onRemoveItem(itemId);
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="p-5 border-b flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-stone-900">Confirmar presupuesto</h2>
                        <p className="text-sm text-stone-500 mt-1">
                            Revisá productos, cantidades y ajustá precios solo para este mensaje.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-2 border rounded-lg text-stone-700 hover:bg-stone-50"
                    >
                        Cerrar
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div className="grid gap-2 md:flex md:flex-wrap">
                        <button
                            type="button"
                            onClick={() => setPriceMode(PRICE_MODE_RETAIL)}
                            className={`w-full px-4 py-2 rounded-lg border md:w-auto ${priceMode === PRICE_MODE_RETAIL
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                }`}
                        >
                            Presupuesto minorista
                        </button>
                        <button
                            type="button"
                            onClick={() => setPriceMode(PRICE_MODE_WHOLESALE)}
                            className={`w-full px-4 py-2 rounded-lg border md:w-auto ${priceMode === PRICE_MODE_WHOLESALE
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
                                }`}
                        >
                            Presupuesto mayorista
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddProduct((prev) => !prev)}
                            className="w-full px-4 py-2 rounded-lg border bg-white text-stone-700 border-stone-300 hover:bg-stone-50 md:w-auto"
                        >
                            Agregar producto
                        </button>
                    </div>

                    {showAddProduct && (
                        <div className="border rounded-xl bg-stone-50 p-4">
                            <div className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_120px]">
                                    <input
                                        type="text"
                                        value={newProduct.name}
                                        onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                                        className="w-full border rounded-lg px-3 py-2 bg-white"
                                        placeholder="Nombre de producto"
                                    />
                                    <div className="space-y-2">
                                        <select
                                            value={newProduct.quantityMode}
                                            onChange={(e) => {
                                                const mode = e.target.value;
                                                if (mode === CUSTOM_QTY_VALUE) {
                                                    setNewProduct((prev) => ({
                                                        ...prev,
                                                        quantityMode: mode,
                                                        quantityDraft: String(prev.quantity || 1),
                                                        isEditingCustomQuantity: true,
                                                    }));
                                                    return;
                                                }
                                                const quantity = Math.max(1, Number(mode) || 1);
                                                setNewProduct((prev) => ({
                                                    ...prev,
                                                    quantityMode: mode,
                                                    quantity,
                                                    quantityDraft: "",
                                                    isEditingCustomQuantity: false,
                                                }));
                                            }}
                                            className="w-full border rounded-lg px-3 py-2 bg-white"
                                        >
                                            {Array.from({ length: 10 }, (_, idx) => (
                                                <option key={idx + 1} value={String(idx + 1)}>
                                                    {idx + 1}
                                                </option>
                                            ))}
                                            {newProduct.quantityMode === CUSTOM_QTY_VALUE && !newProduct.isEditingCustomQuantity && (
                                                <option value={CUSTOM_QTY_VALUE}>{newProduct.quantity}</option>
                                            )}
                                            <option value={CUSTOM_QTY_VALUE}>Otra cantidad</option>
                                        </select>
                                        {newProduct.quantityMode === CUSTOM_QTY_VALUE && newProduct.isEditingCustomQuantity && (
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    inputMode="numeric"
                                                    value={newProduct.quantityDraft}
                                                    onChange={(e) => setNewProduct((prev) => ({ ...prev, quantityDraft: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            applyCustomQuantity();
                                                        }
                                                    }}
                                                    className="w-full border rounded-lg px-3 py-2 bg-white"
                                                    placeholder="Cantidad"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={applyCustomQuantity}
                                                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-100"
                                                >
                                                    OK
                                                </button>
                                            </div>
                                        )}
                                        {newProduct.quantityMode === CUSTOM_QTY_VALUE && !newProduct.isEditingCustomQuantity && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setNewProduct((prev) => ({
                                                        ...prev,
                                                        quantityDraft: String(prev.quantity || 1),
                                                        isEditingCustomQuantity: true,
                                                    }))
                                                }
                                                className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-100"
                                            >
                                                Editar
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={newProduct.ml}
                                        onChange={(e) => setNewProduct((prev) => ({ ...prev, ml: e.target.value }))}
                                        className="w-full border rounded-lg px-3 py-2 bg-white"
                                        placeholder="ML"
                                    />
                                </div>

                                <div className="grid gap-3 md:grid-cols-[150px_auto_auto] md:justify-start">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={newProduct.priceDraft}
                                        onChange={(e) => setNewProduct((prev) => ({ ...prev, priceDraft: sanitizePriceDraft(e.target.value) }))}
                                        className="w-full border rounded-lg px-3 py-2 bg-white"
                                        placeholder="Precio unitario"
                                    />
                                    <button
                                        type="button"
                                        onClick={addManualProduct}
                                        className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                                    >
                                        Confirmar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewProduct(emptyNewProduct);
                                            setShowAddProduct(false);
                                        }}
                                        className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="border rounded-xl overflow-hidden">
                        <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_150px] bg-stone-50 border-b text-xs font-semibold uppercase tracking-wide text-stone-500">
                            <div className="px-4 py-3">Producto</div>
                            <div className="px-4 py-3 text-right">Precio</div>
                        </div>

                        {budgetItems.map((item) => {
                            const priceValue = Number(prices[item.id] ?? 0);
                            const isEditing = editingId === item.id;
                            const currency = priceMode === PRICE_MODE_WHOLESALE ? "$" : "$";

                            return (
                                <div
                                    key={item.id}
                                    className="grid grid-cols-1 border-b last:border-b-0 md:grid-cols-[minmax(0,1fr)_150px] md:items-center"
                                >
                                    <div className="px-4 pt-3 pb-2 md:py-3">
                                        <div className="font-medium text-stone-900">
                                            {item.quantity}x {item.name}
                                        </div>
                                        <div className="text-sm text-stone-500">
                                            {item.mlLabel || "Sin ML"}
                                        </div>
                                    </div>

                                    <div className="px-4 pb-3 pt-0 md:py-3 text-left md:text-right">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 md:justify-end">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoFocus
                                                    value={editingDraft}
                                                    onChange={(e) => setEditingDraft(sanitizePriceDraft(e.target.value))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            setPrices((prev) => ({
                                                                ...prev,
                                                                [item.id]: parsePriceDraft(editingDraft),
                                                            }));
                                                            setEditingId(null);
                                                            setEditingDraft("");
                                                        }
                                                        if (e.key === "Escape") {
                                                            setEditingId(null);
                                                            setEditingDraft("");
                                                        }
                                                    }}
                                                    className="w-24 border rounded px-2 py-1 text-right"
                                                />
                                                <button
                                                    type="button"
                                                    className="px-2 py-1 border rounded hover:bg-green-50"
                                                    onClick={() => {
                                                        setPrices((prev) => ({
                                                            ...prev,
                                                            [item.id]: parsePriceDraft(editingDraft),
                                                        }));
                                                        setEditingId(null);
                                                        setEditingDraft("");
                                                    }}
                                                >
                                                    ✅
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 md:justify-end">
                                                <span className="tabular-nums md:inline-flex md:items-center md:gap-1 md:whitespace-nowrap">
                                                    {currency} {formatPrice(priceValue)}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="px-2 py-1 border rounded hover:bg-stone-50"
                                                    onClick={() => {
                                                        setEditingId(item.id);
                                                        setEditingDraft(formatEditablePrice(Math.max(0, priceValue)));
                                                    }}
                                                    title="Editar precio para este presupuesto"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    type="button"
                                                    className="px-2 py-1 border rounded hover:bg-red-50"
                                                    onClick={() => removeBudgetItem(item.id)}
                                                    title="Quitar del presupuesto"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="block text-sm font-medium text-stone-700 mb-1">Nombre del cliente</span>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2"
                                placeholder="Ej: Juli"
                            />
                        </label>

                        <label className="block">
                            <span className="block text-sm font-medium text-stone-700 mb-1">WhatsApp del cliente</span>
                            <div className="flex items-center border rounded-lg overflow-hidden">
                                {phonePrefixOptions.length > 1 ? (
                                    <select
                                        value={phonePrefix}
                                        onChange={(e) => setPhonePrefix(e.target.value)}
                                        className="max-w-[150px] border-r bg-stone-50 px-3 py-2 text-stone-700 outline-none"
                                        aria-label="Prefijo telefónico"
                                    >
                                        {phonePrefixOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className="px-3 py-2 bg-stone-50 text-stone-600 border-r">
                                        {selectedPhonePrefix.label}
                                    </span>
                                )}
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={phone}
                                    onChange={(e) => setPhone(normalizeDigits(e.target.value))}
                                    className="w-full px-3 py-2 outline-none"
                                    placeholder={selectedPhonePrefix.placeholder || "Número sin prefijo"}
                                />
                            </div>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border rounded-xl bg-stone-50 px-4 py-3">
                        <div>
                            <div className="text-sm text-stone-500">Total estimado</div>
                            <div className="text-lg font-semibold text-stone-900 md:inline-flex md:items-center md:gap-1 md:whitespace-nowrap">
                                {priceMode === PRICE_MODE_WHOLESALE ? "$" : "$"} {formatPrice(total)}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setShowPreview((prev) => !prev)}
                                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-white"
                            >
                                {showPreview ? "Ocultar preview de msj" : "Ver preview de msj"}
                            </button>

                            <button
                                type="button"
                                disabled={!canSend}
                                onClick={() => {
                                    const fullPhone = `${selectedPhonePrefix.value}${normalizeDigits(phone)}`;
                                    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(messagePreview)}`;
                                    window.open(url, "_blank", "noopener,noreferrer");
                                }}
                                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300"
                            >
                                Enviar presupuesto
                            </button>
                        </div>
                    </div>

                    {showPreview && (
                        <div ref={previewRef} className="border rounded-xl bg-white">
                            <div className="px-4 py-3 border-b text-sm font-medium text-stone-700">
                                Preview del mensaje
                            </div>
                            <pre className="px-4 py-4 text-sm whitespace-pre-wrap font-sans text-stone-700">
                                {messagePreview}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
