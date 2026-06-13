import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

const API = import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "") || "";

const normalizeImagePath = (u = "") => {
    if (!u) return "";
    if (u.startsWith("/admin/uploads/")) u = u.replace("/admin", "/public");
    if (u.startsWith("/uploads/")) u = `/public${u}`;
    return u;
};

const toAbsUrl = (u = "") => {
    u = normalizeImagePath(u);
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("/public/")) return `${API}${u}`;
    if (u.startsWith("/")) return u;
    return `${API}/${u}`;
};

const toastRoot = document.getElementById("toast-root") || (() => {
    const el = document.createElement("div");
    el.id = "toast-root";
    document.body.appendChild(el);
    return el;
})();

export default function NewToast({ toast, onClose }) {
    const [visible, setVisible] = useState(false);
    const [data, setData] = useState(toast);

    useEffect(() => {
        if (toast?.isVisible) {

            setData(toast);
            setVisible(true);

            const timer = setTimeout(() => {

                setVisible(false);
                onClose?.();
            }, 3000);

            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [toast]);

    if (!visible) return null;

    const isWholesale = window.location.pathname.startsWith("/mayorista");
    const pricePrefix = isWholesale ? "$" : "$";

    const toastImage = toAbsUrl(data?.product?.image || data?.product?.image_url || "");
    const hasAction = Boolean(data?.actionLabel);

    const openCart = () => {
        if (!hasAction) return;
        window.dispatchEvent(new CustomEvent("open-cart"));
        setVisible(false);
        onClose?.();
    };

    const handleKeyDown = (e) => {
        if (!hasAction || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        openCart();
    };

    const selectedMl = (() => {
        const raw =
            data?.product?.selected_size_ml ??
            data?.product?.volume_ml ??
            data?.product?.ml ??
            data?.product?.size_ml ??
            data?.product?.volume;

        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    })();

    const toastElement = (
        <div
            className="fixed top-[2cm] right-4 z-[999999] pointer-events-auto animate-slide-in-right transition-all duration-300 ease-out"
            style={{ fontFamily: "system-ui" }}
        >
            <div
                onClick={openCart}
                onKeyDown={handleKeyDown}
                role={hasAction ? "button" : undefined}
                tabIndex={hasAction ? 0 : undefined}
                className={`bg-[#111113] text-gray-100 px-3 py-2 sm:px-4 sm:py-3 rounded-xl shadow-2xl border border-amber-500/20 flex items-center space-x-3 max-w-[260px] sm:max-w-[320px] backdrop-blur-sm ${hasAction ? "cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-300/70" : ""}`}
                aria-label={hasAction ? `${data?.message || "Notificación"}. ${data.actionLabel}` : undefined}
            >

                {/* Imagen */}
                {toastImage && (
                    <img
                        src={toastImage}
                        alt={data.product.name || "Producto"}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-cover border border-amber-400/20"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                )}

                {/* Texto */}
                <div className="flex flex-col flex-1 leading-tight">
                    <span className="font-medium text-sm tracking-wide text-amber-200">
                        {data?.message}
                    </span>

                    {data?.product && (
                        <>
                            <span className="text-xs sm:text-sm text-gray-300">
                                {data.product.name}
                                {selectedMl && (
                                    <span className="text-amber-300"> · {selectedMl}ml</span>
                                )}
                            </span>

                            <span className="flex items-center gap-2 text-xs sm:text-sm">
                                <span className="font-semibold text-amber-300">
                                    {data.product.price !== null && data.product.price !== undefined
                                        ? `${pricePrefix}${data.product.price.toLocaleString("es-AR")}`
                                        : "Consultar"}
                                </span>
                                {hasAction && (
                                    <span className="whitespace-nowrap text-xs font-semibold text-white underline decoration-amber-300/60 underline-offset-4">
                                        {data.actionLabel} &rarr;
                                    </span>
                                )}
                            </span>
                        </>
                    )}
                </div>

                {/* Botón cerrar */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setVisible(false);
                        onClose?.();
                    }}
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-amber-400/20 text-gray-300 hover:text-white hover:bg-amber-400/10 transition-all duration-200"
                    aria-label="Cerrar notificación"
                >
                    <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                    >
                        <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );

    return ReactDOM.createPortal(toastElement, toastRoot);
}
