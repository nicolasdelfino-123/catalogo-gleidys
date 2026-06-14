import { useState, useMemo } from "react";
import { Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { withWholesale } from "../../../utils/wholesaleMode"; // ✅ ruta correcta desde /components/product
import { PERFUME_CATEGORY_TREE as CATEGORIES } from "../../../utils/perfumeCategories.js";
import { formatCurrency } from "../../../utils/price.js";

export default function SidebarFiltersNuevo({
    currentCategorySlug,
    onSelectCategory,

    // Precio
    priceMin = 0,
    priceMax = 50000,
    price, // {min, max}
    onChangePrice,

    className = "",

    // Fabricantes
    brandOptions = [], // [{ key, label, count }]
    selectedBrands = [],
    onToggleBrand = () => { },
    onClearBrands = () => { },

    // Mililitros
    mlOptions = [], // [{ value, label, count }]
    selectedMls = [],
    onToggleMl = () => { },
    onClearMls = () => { },
}) {
    const [open, setOpen] = useState(false);
    const [draftPrice, setDraftPrice] = useState(null); // {min,max} mientras el usuario ajusta
    const [expandedCategory, setExpandedCategory] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();


    const p = useMemo(() => {
        const src = draftPrice ?? price ?? { min: priceMin, max: priceMax };

        return {
            min: Math.max(priceMin, Math.min(src.min ?? priceMin, priceMax)),
            max: Math.min(priceMax, Math.max(src.max ?? priceMax, priceMin)),
        };
    }, [priceMin, priceMax, price, draftPrice]);

    const setMin = (val) => {
        const base = {
            min: Math.max(priceMin, Math.min(price?.min ?? priceMin, priceMax)),
            max: Math.min(priceMax, Math.max(price?.max ?? priceMax, priceMin)),
        };
        const cur = draftPrice ?? base;

        const v = Math.max(priceMin, Math.min(Number(val), cur.max));
        setDraftPrice({ min: v, max: cur.max });
    };

    const setMax = (val) => {
        const base = {
            min: Math.max(priceMin, Math.min(price?.min ?? priceMin, priceMax)),
            max: Math.min(priceMax, Math.max(price?.max ?? priceMax, priceMin)),
        };
        const cur = draftPrice ?? base;

        const v = Math.min(priceMax, Math.max(Number(val), cur.min));
        setDraftPrice({ min: cur.min, max: v });
    };

    const hasActiveFilters = useMemo(() => {
        const currentMin = Number.isFinite(price?.min) ? price.min : priceMin;
        const currentMax = Number.isFinite(price?.max) ? price.max : priceMax;

        // ✅ Activo SOLO si el usuario aplicó un price (price != null)
        const isPriceActive =
            price != null && (currentMin !== priceMin || currentMax !== priceMax);

        return (
            isPriceActive ||
            (Array.isArray(selectedBrands) && selectedBrands.length > 0) ||
            (Array.isArray(selectedMls) && selectedMls.length > 0)
        );
    }, [price, priceMin, priceMax, selectedBrands, selectedMls]);

    const getActiveFilterTags = () => {
        const tags = [];


        // Precio (✅ solo si el usuario aplicó filtro: price != null)
        if (price != null) {
            const currentMin = Number.isFinite(price?.min) ? price.min : priceMin;
            const currentMax = Number.isFinite(price?.max) ? price.max : priceMax;

            const minActive = currentMin !== priceMin;
            const maxActive = currentMax !== priceMax;

            if (minActive || maxActive) {
                const priceLabel =
                    minActive && maxActive
                        ? `${formatCurrency(currentMin)} - ${formatCurrency(currentMax)}`
                        : minActive
                            ? `Desde ${formatCurrency(currentMin)}`
                            : `Hasta ${formatCurrency(currentMax)}`;

                tags.push({
                    type: "price",
                    key: "price",
                    label: priceLabel,
                    onRemove: () => onChangePrice?.(null), // ✅ limpia el filtro, no lo setea
                });
            }
        }


        // Brands
        for (const b of selectedBrands || []) {
            tags.push({
                type: "brand",
                key: b,
                label: b?.toString()?.toUpperCase?.() || String(b),
                onRemove: () => onToggleBrand?.(b),
            });
        }

        // Mililitros
        for (const ml of selectedMls || []) {
            tags.push({
                type: "ml",
                key: ml,
                label: `${ml}ml`,
                onRemove: () => onToggleMl?.(ml),
            });
        }

        return tags;
    };

    const clearAllFilters = () => {
        onClearBrands?.();
        onClearMls?.();
        onChangePrice?.(null); // 🔥 IMPORTANTE
    };

    // ⚠️ sin h-full (rompe sticky); nada de overflow aquí
    const body = (
        <div className="w-72 max-w-[88vw] bg-white border-r p-4 space-y-6 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto md:pr-2">
            <div className="md:hidden flex justify-between items-center mb-2">
                <h3 className="text-lg font-serif font-semibold tracking-wide text-[#232325]">Filtros</h3>
                <button onClick={() => setOpen(false)} className="px-3 py-1 border border-stone-300 rounded font-serif text-sm text-stone-700 hover:border-black hover:text-black transition-colors">
                    Cerrar
                </button>
            </div>

            {/* Etiquetas de filtros activos */}
            {hasActiveFilters && (
                <div className="border-b pb-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-serif text-base tracking-wide text-[#232325]">
                            Filtros activos
                        </h4>
                        <button
                            onClick={clearAllFilters}
                            className="text-xs font-serif text-stone-600 hover:text-[#d4af37] transition-colors underline"
                        >
                            Limpiar todos
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {getActiveFilterTags().map((tag) => (
                            <div
                                key={`${tag.type}-${tag.key}`}
                                className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm border"
                            >
                                <span className="max-w-[120px] truncate">{tag.label}</span>
                                <button
                                    onClick={tag.onRemove}
                                    className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                                    title="Remover filtro"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Categorías */}
            <div>
                <h4 className="font-serif text-base mb-3 tracking-wide text-[#232325]">
                    CATEGORÍAS
                </h4>
                <ul className="space-y-2">
                    {CATEGORIES.map((c) => {
                        const hasChildren = (c.children || []).length > 0;
                        const childActive = c.children?.some((child) => child.slug === currentCategorySlug);
                        const active = c.slug === currentCategorySlug;
                        const expanded = expandedCategory === c.slug || childActive;

                        return (
                            <li key={c.slug}>
                                <button
                                    onClick={() => {
                                        if (hasChildren) {
                                            setExpandedCategory((current) => current === c.slug ? null : c.slug);
                                            return;
                                        }
                                        if (onSelectCategory) {
                                            onSelectCategory(c.slug);
                                        } else {
                                            const isWholesale = location.pathname.startsWith("/mayorista");
                                            const base = isWholesale ? "/mayorista" : "";
                                            navigate(`${base}/categoria/${c.slug}`);
                                        }
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between py-2 border-b border-stone-200 font-serif transition-all duration-300 focus:outline-none ${active || childActive
                                        ? "text-[#232325] font-semibold border-[#232325]"
                                        : "text-stone-700 hover:text-[#d4af37] hover:border-[#d4af37]"
                                        }`}
                                >
                                    <span className="whitespace-nowrap">{c.name}</span>
                                    {hasChildren && (
                                        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
                                    )}
                                </button>
                                {expanded && c.children?.map((child) => {
                                    const childActive = child.slug === currentCategorySlug;

                                    return (
                                        <button
                                            key={child.slug}
                                            onClick={() => {
                                                if (onSelectCategory) {
                                                    onSelectCategory(child.slug);
                                                } else {
                                                    const isWholesale = location.pathname.startsWith("/mayorista");
                                                    const base = isWholesale ? "/mayorista" : "";
                                                    navigate(`${base}/categoria/${child.slug}`);
                                                }
                                                setOpen(false);
                                            }}
                                            className={`w-full whitespace-nowrap text-left py-2 pl-4 border-b border-stone-100 font-serif text-sm transition-all duration-300 focus:outline-none ${childActive
                                                ? "text-[#232325] font-semibold border-[#232325]"
                                                : "text-stone-600 hover:text-[#d4af37] hover:border-[#d4af37]"
                                                }`}
                                        >
                                            {child.name}
                                        </button>
                                    );
                                })}

                            </li>
                        );
                    })}

                </ul>
            </div>

            {/* Precio */}
            <div>
                <h4 className="font-serif text-base mb-3 tracking-wide text-[#232325]">
                    Filtrar por precio
                </h4>

                <div className="flex items-center justify-between text-sm mb-2">
                    <span>{formatCurrency(p.min)}</span>
                    <span>{formatCurrency(p.max)}</span>
                </div>
                <div className="flex gap-2 mt-3">
                    <button
                        type="button"
                        onClick={() => {
                            // ✅ aplicar solo cuando el usuario confirma
                            onChangePrice?.(draftPrice ?? { min: priceMin, max: priceMax });
                            setDraftPrice(null);
                        }}
                        className="flex-1 py-2 rounded-lg bg-[#232325] text-white text-sm font-serif hover:bg-black transition-colors"
                    >
                        Aplicar
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            // ✅ limpiar
                            setDraftPrice(null);
                            onChangePrice?.(null);
                        }}
                        className="flex-1 py-2 rounded-lg border border-stone-300 text-sm font-serif text-stone-700 hover:border-black hover:text-black transition-colors"
                    >
                        Limpiar
                    </button>
                </div>

                <div className="relative h-6 mt-4">
                    <input
                        type="range"
                        min={priceMin}
                        max={priceMax}
                        step={100}
                        value={p.min}
                        onChange={(e) => setMin(e.target.value)}
                        className="sidebar-price-range absolute w-full appearance-none h-1 bg-gray-200 rounded pointer-events-none"
                        style={{ zIndex: 5, accentColor: "#111111", backgroundColor: "#030e1fff" }}
                    />
                    <input
                        type="range"
                        min={priceMin}
                        max={priceMax}
                        step={100}
                        value={p.max}
                        onChange={(e) => setMax(e.target.value)}
                        className="sidebar-price-range absolute w-full appearance-none h-1 bg-gray-200 rounded"
                        style={{ zIndex: 4, accentColor: "#111111", backgroundColor: "#041329ff" }}
                    />
                </div>
            </div>

            {/* Marcas */}
            {brandOptions.length > 0 && (
                <div>
                    <h4 className="font-serif text-base mb-3 tracking-wide text-[#232325]">
                        Marcas
                    </h4>

                    <div className="flex items-center justify-between mb-2">
                        {selectedBrands.length > 0 ? (
                            <button
                                type="button"
                                onClick={onClearBrands}
                                className="text-xs text-purple-600 hover:underline"
                                title="Limpiar selección"
                            >
                                Limpiar selección
                            </button>
                        ) : (
                            <span className="text-xs font-serif text-stone-500">
                                Seleccioná uno o más
                            </span>
                        )}
                    </div>

                    <div className="space-y-2 max-h-56 overflow-auto pr-1 border rounded p-2">
                        {brandOptions.map(({ key, label, count }) => {
                            const checked = selectedBrands.includes(key);
                            return (
                                <label key={key} className="flex items-center gap-2 text-sm font-serif text-stone-700 cursor-pointer hover:text-[#d4af37] transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => onToggleBrand(key)}
                                        className="rounded border-gray-300"
                                    />
                                    <span className="flex-1">
                                        {label} <span className="text-gray-500">({count})</span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Mililitros */}
            {mlOptions.length > 0 && (
                <div>
                    <h4 className="font-serif text-base mb-3 tracking-wide text-[#232325]">
                        Mililitros
                    </h4>

                    <div className="flex items-center justify-between mb-2">
                        {selectedMls.length > 0 ? (
                            <button
                                type="button"
                                onClick={onClearMls}
                                className="text-xs font-serif text-stone-600 hover:text-[#d4af37] hover:underline transition-colors"
                                title="Limpiar selección"
                            >
                                Limpiar selección
                            </button>
                        ) : (
                            <span className="text-xs text-gray-500">Seleccioná uno o más</span>
                        )}
                    </div>

                    <div className="space-y-2 max-h-56 overflow-auto pr-1 border rounded p-2">
                        {mlOptions.map(({ value, label, count }) => {
                            const numeric = Number(value);
                            const checked = selectedMls.includes(numeric);
                            return (
                                <label key={numeric} className="flex items-center gap-2 text-sm font-serif text-stone-700 cursor-pointer hover:text-[#d4af37] transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => onToggleMl(numeric)}
                                        className="rounded border-gray-300"
                                    />
                                    <span className="flex-1">
                                        {label} <span className="text-gray-500">({count})</span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <>
            <aside className={className}>
                {/* Botón hamburguesa (mobile) */}
                <div className="fixed left-0 right-0 top-[calc(128px+env(safe-area-inset-top,0px))] z-40 border-y border-stone-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur md:hidden">
                    <button
                        onClick={() => setOpen(true)}
                        className="mx-auto inline-flex w-full max-w-7xl items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm font-serif font-medium tracking-wide text-stone-900 shadow-sm transition-colors hover:border-stone-500 hover:bg-stone-50"
                    >
                        <Menu size={18} />
                        Ver categorías
                        {hasActiveFilters && (
                            <span className="bg-[#232325] text-white text-xs px-1.5 py-0.5 rounded-full">
                                {getActiveFilterTags().length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Desktop */}
                <div className="hidden md:block">{body}</div>

                {/* Drawer Mobile */}
                {open && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
                        <div className="absolute left-0 top-0 h-full overflow-auto">{body}</div>
                    </div>
                )}
            </aside>
        </>
    );
}
