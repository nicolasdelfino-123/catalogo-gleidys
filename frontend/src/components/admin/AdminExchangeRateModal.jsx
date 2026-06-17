import { useEffect, useState } from "react";

const DEFAULT_SETTINGS = {
    enabled: true,
    custom_text: "Precios referenciales en USD",
    rates: {
        usd: { label: "Dólar", flag: "🇺🇸", value: "" },
        ars: { label: "Bolívar", flag: "🇻🇪", value: "" },
        brl: { label: "Peso colombiano", flag: "🇨🇴", value: "" },
    },
};

const RATE_ORDER = ["ars", "brl"];
const RATE_PLACEHOLDERS = {
    ars: "🇻🇪 Bs: 596",
    brl: "🇨🇴 COP: 4.000",
};

const normalizeRateValueForInput = (code, value = "") => {
    return String(value ?? "");
};

const normalizeSettings = (value = {}) => ({
    enabled: value.enabled ?? DEFAULT_SETTINGS.enabled,
    custom_text: value.custom_text ?? DEFAULT_SETTINGS.custom_text,
    rates: Object.keys(DEFAULT_SETTINGS.rates).reduce((acc, code) => {
        const incomingRate = value.rates?.[code] || {};
        acc[code] = {
            ...DEFAULT_SETTINGS.rates[code],
            ...incomingRate,
            value: normalizeRateValueForInput(code, incomingRate.value ?? ""),
        };
        return acc;
    }, {}),
});

export default function AdminExchangeRateModal({
    open = false,
    api = "",
    token = "",
    onClose = () => { },
}) {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [showSavedModal, setShowSavedModal] = useState(false);

    useEffect(() => {
        if (!open) return;

        setLoading(true);
        setError("");
        setShowSavedModal(false);

        fetch(`${api}/admin/home-marquee-settings`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.error || "No se pudo cargar la cotización");
                setSettings(normalizeSettings(data));
            })
            .catch((err) => {
                setError(err.message);
                setSettings(DEFAULT_SETTINGS);
            })
            .finally(() => setLoading(false));
    }, [api, open, token]);

    if (!open) return null;

    const updateRate = (code, value) => {
        setSettings((prev) => ({
            ...prev,
            rates: {
                ...prev.rates,
                [code]: {
                    ...prev.rates[code],
                    value,
                },
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setShowSavedModal(false);

        try {
            const res = await fetch(`${api}/admin/home-marquee-settings`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(settings),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "No se pudo guardar la cotización");
            setSettings(normalizeSettings(data));
            setShowSavedModal(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-4">
            <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl sm:max-h-[90vh]">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
                    <div>
                        <h2 className="text-xl font-semibold text-stone-900">Cotización del inicio</h2>
                        <p className="mt-1 text-sm text-stone-500">
                            Cargá cuántos bolívares y pesos colombianos equivalen a 1 dólar.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border px-3 py-2 text-stone-700 hover:bg-stone-50"
                    >
                        Cerrar
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                    {loading ? (
                        <div className="rounded-lg border bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
                            Cargando cotización...
                        </div>
                    ) : (
                        <>
                            <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                                <span>
                                    <span className="block text-sm font-medium text-stone-800">Mostrar franja en Inicio</span>
                                    <span className="block text-xs text-stone-500">Si está apagado, no aparece la franja animada.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={settings.enabled}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                                    className="h-5 w-5 accent-stone-900"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-stone-700">Texto adicional</span>
                                <input
                                    type="text"
                                    maxLength={180}
                                    value={settings.custom_text}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, custom_text: e.target.value }))}
                                    className="w-full rounded-lg border px-3 py-2"
                                    placeholder="Ej: Precios referenciales en USD"
                                />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {RATE_ORDER.map((code) => {
                                    const rate = settings.rates[code];
                                    return (
                                        <label key={code} className="block rounded-lg border px-3 py-3">
                                            <span className="mb-1 flex items-center gap-2 text-sm font-medium text-stone-700">
                                                <span className="text-xl leading-none">{rate.flag}</span>
                                                1 USD en {rate.label}
                                            </span>
                                            <input
                                                type="text"
                                                value={rate.value}
                                                onChange={(e) => updateRate(code, e.target.value)}
                                                className="w-full rounded border px-3 py-2"
                                                placeholder={RATE_PLACEHOLDERS[code]}
                                            />
                                        </label>
                                    );
                                })}
                            </div>

                            {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                        </>
                    )}
                </div>

                <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-4 sm:px-5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border px-4 py-2 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-black disabled:opacity-50"
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>
            {showSavedModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-white p-5 text-center shadow-2xl">
                        <h3 className="text-lg font-semibold text-stone-900">Cotización guardada</h3>
                        <p className="mt-2 text-sm text-stone-500">
                            Los cambios ya se verán reflejados en el inicio.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setShowSavedModal(false);
                                onClose();
                            }}
                            className="mt-5 w-full rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-black"
                        >
                            Aceptar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
