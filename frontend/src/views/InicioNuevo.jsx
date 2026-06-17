import React, { useContext, useEffect, useLayoutEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Context } from "../js/store/appContext.jsx";
import ProductCardPerfumes from "../components/ui/cards/ProductCardPerfumes.jsx";
import HomeContact from "../components/home/HomeContact.jsx";
import Asesoria from "../components/Asesoria.jsx";
import { storeConfig } from "../config/storeConfig";
import { getProductCategoryIds, mapCategoryIdFromName } from "../utils/perfumeCategories.js";
import { getApiUrl } from "../utils/apiUrl.js";

import afnan from '../assets/afnan.webp'
import al from '../assets/al.webp'
import alhara from '../assets/alhara.png'
import armaf from '../assets/armaf.webp'
import bharara from '../assets/bharara.webp'
import french from '../assets/french.webp'

import lattafa from '../assets/lattafa.png'
import maison from '../assets/maison.jpg'
import rasasi from '../assets/rasasi.png'
import ray from '../assets/raysi.jpg'

const carouselPublicBrands = [
    { src: "/carru_carolina.webp", alt: "Carolina Herrera" },
    { src: "/carru_chanel.png", alt: "Chanel" },
    { src: "/creed.jpg", alt: "Creed" },
    { src: "/carru_dior.png", alt: "Dior" },
    { src: "/amani.svg", alt: "Giorgio Armani" },
    { src: "/kurdi.png", alt: "Khurdi" },
    { src: "/amo.jpg", alt: "Amo" },
    { src: "/montale_si.png", alt: "Montale" },
    { src: "/carru_paco.svg", alt: "Paco Rabanne" },
    { src: "/carru_parfum.png", alt: "Parfums de Marly" },
    { src: "/carru_tomford.png", alt: "Tom Ford" },
    { src: "/carru_versace.png", alt: "Versace" },
    { src: "/carru_vic.png", alt: "Victoria's Secret" },
    { src: "/carru_xerjof.webp", alt: "Xerjoff" },
    { src: "/ysl_si.png", alt: "Yves Saint Laurent" },
];

const API = getApiUrl();

const DEFAULT_MARQUEE_SETTINGS = {
    enabled: true,
    custom_text: "Precios referenciales en USD",
    rates: {
        usd: { label: "Dólar", flag: "💵", value: "" },
        ars: { label: "Bolívar", flag: "🇻🇪", value: "" },
        brl: { label: "Peso colombiano", flag: "🇨🇴", value: "" },
    },
};

const RATE_ORDER = ["ars", "brl"];

const formatRateValue = (code, value = "") => {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) return "";
    return code === "ars" ? `Bs ${cleanValue}` : `COP ${cleanValue}`;
};

const cssValue = (value, fallback) =>
    value === undefined || value === null || value === "" ? fallback : value;

const buildHeroFrameStyle = (settings = {}, defaults = {}) => ({
    minHeight: cssValue(settings.sectionMinHeight, defaults.sectionMinHeight),
    paddingTop: cssValue(settings.sectionPaddingTop, defaults.sectionPaddingTop),
    paddingBottom: cssValue(settings.sectionPaddingBottom, defaults.sectionPaddingBottom),
    marginTop: cssValue(settings.sectionMarginTop, defaults.sectionMarginTop),
    marginBottom: cssValue(settings.sectionMarginBottom, defaults.sectionMarginBottom),
});

const buildHeroImageStyle = (settings = {}, defaults = {}) => ({
    width: cssValue(settings.imageWidth, defaults.imageWidth),
    maxWidth: cssValue(settings.imageMaxWidth, defaults.imageMaxWidth),
    height: cssValue(settings.imageHeight, defaults.imageHeight),
    minHeight: cssValue(settings.imageMinHeight, defaults.imageMinHeight),
    maxHeight: cssValue(settings.imageMaxHeight, defaults.imageMaxHeight),
    objectFit: cssValue(settings.imageFit, defaults.imageFit),
    objectPosition: cssValue(settings.imagePosition, defaults.imagePosition),
    transform: `translate(${cssValue(settings.imageOffsetX, defaults.imageOffsetX)}, ${cssValue(settings.imageOffsetY, defaults.imageOffsetY)})`,
});

const buildHeroTextBlockStyle = (settings = {}, base = {}) => ({
    height: cssValue(settings.height, "auto"),
    paddingTop: cssValue(settings.paddingTop, "24px"),
    paddingBottom: cssValue(settings.paddingBottom, "24px"),
    paddingLeft: cssValue(settings.paddingX, "20px"),
    paddingRight: cssValue(settings.paddingX, "20px"),
    marginTop: cssValue(settings.marginTop, "0px"),
    marginBottom: cssValue(settings.marginBottom, "0px"),
    background: cssValue(base.background, "#000000"),
});

export default function InicioNuevo() {
    const { store, actions } = useContext(Context);
    const location = useLocation();
    const navigate = useNavigate();
    const [homeFeaturedIds, setHomeFeaturedIds] = useState(null);
    const [marqueeSettings, setMarqueeSettings] = useState(DEFAULT_MARQUEE_SETTINGS);
    const heroImageDesktop = `/${storeConfig.media.heroImageDesktop || storeConfig.media.heroImage || ""}`;
    const heroImageMobile = `/${storeConfig.media.heroImageMobile || storeConfig.media.heroImageDesktop || storeConfig.media.heroImage || ""}`;
    const heroConfig = storeConfig.hero || {};
    const desktopHero = heroConfig.desktop || {};
    const mobileHero = heroConfig.mobile || {};
    const textBlockConfig = heroConfig.textBlock || {};
    const showHeroTextBlock = textBlockConfig.enabled === true;

    useEffect(() => {
        if (actions?.fetchProducts) {
            actions.fetchProducts();
        }
        fetch(`${API}/public/home-featured-products`)
            .then((res) => (res.ok ? res.json() : { product_ids: [] }))
            .then((data) => {
                setHomeFeaturedIds((data?.product_ids || []).map(Number));
            })
            .catch(() => {
                setHomeFeaturedIds([]);
            });

        fetch(`${API}/public/home-marquee-settings`)
            .then((res) => (res.ok ? res.json() : DEFAULT_MARQUEE_SETTINGS))
            .then((data) => {
                setMarqueeSettings({
                    ...DEFAULT_MARQUEE_SETTINGS,
                    ...data,
                    rates: {
                        ...DEFAULT_MARQUEE_SETTINGS.rates,
                        ...(data?.rates || {}),
                    },
                });
            })
            .catch(() => setMarqueeSettings(DEFAULT_MARQUEE_SETTINGS));
    }, []);

    const ADDRESS = storeConfig.business.address;
    const HOURS = storeConfig.business.hours;
    const IG_URL = storeConfig.contact.instagram;
    const ADDRESS_CITY = storeConfig.business.city;


    const WA_URL = `https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(
        storeConfig.contact.whatsappMessage
    )}`;

    const MAP_EMBED = storeConfig.map.embed;
    const allProducts = store.products || [];
    const womenCategoryId = mapCategoryIdFromName("Femeninos");
    const menCategoryId = mapCategoryIdFromName("Masculinos");
    const getProductPrice = (product) => {
        const price = Number(product?.price);
        return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
    };
    const isWomenFragrance = (product) => getProductCategoryIds(product).includes(womenCategoryId);
    const isMenFragrance = (product) => getProductCategoryIds(product).includes(menCategoryId);

    const womenFeatured = allProducts
        .filter(isWomenFragrance)
        .sort((a, b) => getProductPrice(a) - getProductPrice(b))
        .slice(0, 6);
    const menFeatured = allProducts
        .filter(isMenFragrance)
        .sort((a, b) => getProductPrice(a) - getProductPrice(b))
        .slice(0, 6);
    const selectedFeaturedIds = new Set([...womenFeatured, ...menFeatured].map((p) => p.id));
    const fallbackFeaturedProducts = [
        ...womenFeatured,
        ...menFeatured,
        ...allProducts.filter((p) => !selectedFeaturedIds.has(p.id)).slice(0, Math.max(0, 12 - (womenFeatured.length + menFeatured.length))),
    ].slice(0, 12);
    const productById = new Map(allProducts.map((product) => [Number(product.id), product]));
    const selectedHomeProducts = (homeFeaturedIds || [])
        .map((productId) => productById.get(Number(productId)))
        .filter(Boolean);
    const featuredProducts = homeFeaturedIds === null
        ? []
        : homeFeaturedIds.length > 0
            ? selectedHomeProducts
            : fallbackFeaturedProducts;
    const marqueeItems = [
        marqueeSettings.custom_text?.trim(),
        ...RATE_ORDER.map((code) => {
            const rate = marqueeSettings.rates?.[code];
            if (!rate?.value?.trim()) return null;
            return `${rate.flag} 1 USD = ${formatRateValue(code, rate.value)}`;
        }),
    ].filter(Boolean);

    const visibleMarqueeItems = marqueeItems.length > 0
        ? marqueeItems
        : ["Precios referenciales en USD"];


    useLayoutEffect(() => {
        const lastId = sessionStorage.getItem("lastProductId");
        if (!lastId) return;

        const el = document.querySelector(`[data-product-id="${lastId}"]`);
        if (!el) return;

        el.scrollIntoView({ block: "center" });

        // opcional: limpiar para que no te re-scrollee en futuras entradas
        sessionStorage.removeItem("lastProductId");
    }, []);



    useEffect(() => {
        if (location.state?.scrollTo === "contacto") {
            const el = document.getElementById("asesoria");
            if (!el) return;
            const headerH = document.querySelector("header")?.offsetHeight || 80;
            const y = el.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
    }, [location.state]);
    return (
        <div className="min-h-screen bg-gray-50">


            {/* HERO PREMIUM CON IMAGEN CONFIGURABLE DESDE storeConfig */}
            <section className="relative overflow-hidden bg-[#0B0608] text-center">
                <div className="lg:hidden" style={buildHeroFrameStyle(mobileHero, {
                    sectionMinHeight: "auto",
                    sectionPaddingTop: "80px",
                    sectionPaddingBottom: "0px",
                    sectionMarginTop: "0px",
                    sectionMarginBottom: "0px",
                })}>
                    <img
                        src={heroImageMobile}
                        alt="banner"
                        className="mx-auto block brightness-110 saturate-110"
                        style={buildHeroImageStyle(mobileHero, {
                            imageWidth: "100%",
                            imageMaxWidth: "100%",
                            imageHeight: "auto",
                            imageMinHeight: "auto",
                            imageMaxHeight: "none",
                            imageFit: "contain",
                            imagePosition: "center center",
                            imageOffsetX: "0px",
                            imageOffsetY: "0px",
                        })}
                    />

                    {showHeroTextBlock && (
                        <div
                            className="flex flex-col items-center justify-center"
                            style={buildHeroTextBlockStyle(textBlockConfig.mobile, textBlockConfig)}
                        >
                            <h1
                                className="mb-3 font-serif text-[22px] font-semibold leading-tight tracking-wide sm:text-[24px]"
                                style={{ color: cssValue(textBlockConfig.textColor, "#ffffff") }}
                            >
                                {storeConfig.branding.heroTitle}
                            </h1>

                            <p
                                className="mx-auto max-w-[420px] font-serif text-[14px] leading-relaxed tracking-wide sm:text-[15px]"
                                style={{ color: cssValue(textBlockConfig.subtitleColor, "#e5e7eb") }}
                            >
                                {storeConfig.branding.heroSubtitle}
                            </p>
                        </div>
                    )}
                </div>

                <div className="hidden lg:block" style={buildHeroFrameStyle(desktopHero, {
                    sectionMinHeight: "auto",
                    sectionPaddingTop: "0px",
                    sectionPaddingBottom: "0px",
                    sectionMarginTop: "0px",
                    sectionMarginBottom: "0px",
                })}>
                    <img
                        src={heroImageDesktop}
                        alt="banner"
                        className="mx-auto block brightness-110 saturate-110"
                        style={buildHeroImageStyle(desktopHero, {
                            imageWidth: "100%",
                            imageMaxWidth: "100%",
                            imageHeight: "auto",
                            imageMinHeight: "auto",
                            imageMaxHeight: "none",
                            imageFit: "contain",
                            imagePosition: "center center",
                            imageOffsetX: "0px",
                            imageOffsetY: "0px",
                        })}
                    />

                    {showHeroTextBlock && (
                        <div
                            className="flex flex-col items-center justify-center"
                            style={buildHeroTextBlockStyle(textBlockConfig.desktop, textBlockConfig)}
                        >
                            <h1
                                className="mb-4 font-serif text-3xl font-semibold tracking-wide"
                                style={{ color: cssValue(textBlockConfig.textColor, "#ffffff") }}
                            >
                                {storeConfig.branding.heroTitle}
                            </h1>

                            <p
                                className="font-serif text-xl tracking-wide"
                                style={{ color: cssValue(textBlockConfig.subtitleColor, "#e5e7eb") }}
                            >
                                {storeConfig.branding.heroSubtitle}
                            </p>
                        </div>
                    )}
                </div>
            </section>
            {marqueeSettings.enabled !== false && (
                <div className="relative z-10 overflow-hidden whitespace-nowrap bg-gradient-to-r from-black via-[#0B0608] to-black py-3">
                    <div className="marquee-track will-change-transform">
                        {Array.from({ length: 4 }).map((_, groupIndex) => (
                            <div
                                key={`marquee-group-${groupIndex}`}
                                className="marquee-group"
                                aria-hidden={groupIndex > 0 ? "true" : undefined}
                            >
                                {visibleMarqueeItems.map((item, itemIndex) => (
                                    <span
                                        key={`marquee-${groupIndex}-${itemIndex}`}
                                        className="marquee-item text-lg font-semibold text-white md:text-2xl"
                                    >
                                        <span>{item}</span>
                                        <span className="marquee-separator text-amber-300">•</span>
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
                .marquee-track {
                    display: inline-flex;
                    min-width: max-content;
                    animation: marquee 18s linear infinite;
                }
                .marquee-group {
                    display: inline-flex;
                    align-items: center;
                }
                .marquee-item {
                    display: inline-flex;
                    align-items: center;
                    flex-shrink: 0;
                }
                .marquee-separator {
                    display: inline-flex;
                    width: 96px;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                @keyframes marquee {
                    from { transform: translateX(0); }
                    to   { transform: translateX(-25%); }
                }
            `}</style>

            {/* PRODUCTOS */}
            <section className="max-w-7xl mx-auto px-2 sm:px-4 py-12">
                <div className="text-center mb-10">
                    <h2 className="text-2xl md:text-3xl font-serif font-semibold tracking-wide">
                        Productos Destacados
                    </h2>

                    <div className="w-16 h-[2px] bg-amber-500 mx-auto mt-4"></div>
                </div>

                {store.loading ? (
                    <p className="text-center">Cargando...</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                        {featuredProducts.map((product) => (
                            <div
                                key={product.id}
                                data-product-id={product.id}
                                className="transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl rounded-xl"
                            >
                                <ProductCardPerfumes product={product} returnTo={location.pathname} isGrid={false} />
                            </div>
                        ))}
                    </div>
                )}
            </section>
            <div className="flex justify-center mt-0 mb-12 lg:mb-1 lg:px-12 lg:py-12">
                <div
                    onClick={() => navigate(location.pathname.startsWith("/mayorista") ? "/mayorista/products" : "/products")}
                    className="
cursor-pointer
px-8 py-3
font-serif
tracking-wide
text-sm
uppercase
rounded-lg
text-white
bg-[#0B0608] border border-[#C9A227] text-[#C9A227] hover:bg-[#C9A227] hover:text-black
bg-[length:200%_100%]
bg-left
hover:bg-right
transition-all duration-500
shadow-lg shadow-amber-500/20
"
                >
                    Explorar todas las categorías
                </div>
            </div>
            {/*  <section id="asesoria">
                <Asesoria />
            </section> */}
            {/* Sección Contactanos comentada por pedido: queda disponible, pero no se renderiza en el inicio. */}
            {false && (
                <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" id='asesoria'>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
                        {/* Columna izquierda: texto */}
                        <div className="md:col-span-1 text-center md:text-left">
                            <span className="block text-sm tracking-[0.18em] font-semibold uppercase text-gray-500">
                                ¡Contactanos!
                            </span>

                            <h2 className="mt-4 text-4xl sm:text-5xl font-extrabold text-gray-900">
                                {ADDRESS}
                            </h2>
                            <p className="mt-2 text-lg text-gray-500">
                                {ADDRESS_CITY}
                            </p>


                            <p className="mt-2 text-gray-600">{HOURS}</p>

                            <div className="mt-6 flex justify-center md:justify-center gap-4">

                                {/* Instagram */}
                                <a
                                    href={IG_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-lime-400 text-lime-600 hover:bg-lime-50 transition"
                                    aria-label="Instagram"
                                    title="Instagram"
                                >
                                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                                        <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm10 2c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3h10zm-5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm5.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
                                    </svg>
                                </a>

                                {/* WhatsApp */}
                                <a
                                    href={WA_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-lime-400 text-lime-600 hover:bg-lime-50 transition"
                                    aria-label="WhatsApp"
                                    title="WhatsApp"
                                >
                                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                                        <path d="M20.52 3.48A11.9 11.9 0 0012.06 0C5.5 0 .2 5.3.2 11.86c0 2.09.55 4.12 1.6 5.92L0 24l6.4-1.73a11.8 11.8 0 005.66 1.45h.01c6.56 0 11.86-5.3 11.86-11.86 0-3.17-1.23-6.14-3.38-8.28zM12.07 21.6h-.01a9.75 9.75 0 01-4.98-1.36l-.36-.21-3.8 1.02 1.04-3.7-.23-.38a9.8 9.8 0 01-1.49-5.11c0-5.41 4.4-9.8 9.82-9.8 2.62 0 5.08 1.02 6.93 2.87a9.74 9.74 0 012.86 6.93c0 5.41-4.4 9.74-9.78 9.74zm5.64-7.29c-.31-.16-1.86-.92-2.14-1.02-.29-.11-.5-.16-.71.16-.2.31-.81 1.02-.99 1.23-.19.2-.37.23-.68.08-.31-.16-1.31-.48-2.5-1.52-.92-.81-1.54-1.81-1.73-2.12-.18-.31-.02-.48.14-.64.14-.14.31-.37.46-.56.16-.19.2-.31.31-.52.1-.2.05-.39-.02-.55-.07-.16-.71-1.7-.98-2.34-.26-.63-.53-.54-.71-.55-.18-.01-.39-.01-.6-.01-.2 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.63 0 1.55 1.13 3.05 1.29 3.26.16.2 2.22 3.55 5.38 4.98.75.33 1.33.52 1.79.66.75.24 1.43.21 1.98.13.6-.09 1.86-.76 2.13-1.49.26-.73.26-1.35.18-1.49-.08-.14-.28-.22-.59-.38z" />
                                    </svg>
                                </a>
                            </div>
                        </div>

                        {/* Divider central (sólo desktop) */}
                        <div className="hidden md:block h-full w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent mx-auto" />

                        {/* Columna derecha: mapa (oscuro por CSS) */}
                        {/* Columna derecha: mapa (oscuro por CSS) */}
                        <div className="md:col-span-1">
                            <div className="rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-200 bg-black">
                                <div className="aspect-video md:aspect-[4/3] map-dark">
                                    <iframe
                                        src={MAP_EMBED}
                                        title="Ubicación en Google Maps"
                                        className="w-full h-full border-0"
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        allowFullScreen
                                    />
                                </div>
                            </div>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-block text-sm text-purple-600 hover:text-purple-800"
                            >
                                Abrir en Google Maps →
                            </a>
                        </div>
                    </div>

                    {/* Filtro para “estilo oscuro” del iframe (sin API key) */}
                    <style>{`
    .map-dark iframe {
      /* Ajustá estos valores si querés más/menos contraste */
      filter: invert(90%) hue-rotate(180deg) saturate(0.7) brightness(0.85) contrast(1.05);
      /* Para mejorar la suavidad en algunos navegadores */
      transform: translateZ(0);
    }
  `}</style>
                </section>
            )}
            {storeConfig.features?.showBrandCarousel !== false && (
                <section className="relative bg-white py-8 fade-in-section border-y border-gray-200">
                    <div className="relative z-10 overflow-hidden whitespace-nowrap mx-0 md:mx-[104px]">
                        <div className="brands-track will-change-transform">

                            <div className="brands-group">
                                <div className="brand-container">
                                    <img src={afnan} alt="Afnan" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={al} alt="al" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={alhara} alt="alhara" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={armaf} alt="Armaf" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={bharara} alt="Bharara" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={french} alt="French" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={lattafa} alt="Lattafa" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={maison} alt="Maison" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={rasasi} alt="Rasasi" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={ray} alt="Ray" className="brand-img" />
                                </div>
                                {carouselPublicBrands.map((brand) => (
                                    <div className="brand-container" key={brand.src}>
                                        <img src={brand.src} alt={brand.alt} className="brand-img" />
                                    </div>
                                ))}
                            </div>


                            <div className="brands-group" aria-hidden="true">
                                <div className="brand-container">
                                    <img src={afnan} alt="Afnan" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={al} alt="al" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={alhara} alt="alhara" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={armaf} alt="Armaf" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={bharara} alt="Bharara" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={french} alt="French" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={lattafa} alt="Lattafa" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={maison} alt="Maison" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={rasasi} alt="Rasasi" className="brand-img" />
                                </div>
                                <div className="brand-container">
                                    <img src={ray} alt="Ray" className="brand-img" />
                                </div>
                                {carouselPublicBrands.map((brand) => (
                                    <div className="brand-container" key={`duplicate-${brand.src}`}>
                                        <img src={brand.src} alt={brand.alt} className="brand-img" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <style>{`
        .brands-track {
            display: inline-flex;
            animation: brandsScroll 32s linear infinite;
        }

        .brands-group {
            display: flex;
            align-items: center;
        }

        .brand-container {
            width: 180px;
            height: 4rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .brand-img {
            max-height: 4rem;
            max-width: 140px;
            width: auto;
            height: auto;
            object-fit: contain;
            display: block;
            margin: 0;
            padding: 0;
        }

        @keyframes brandsScroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
        }

       /*  .brands-track:hover {
	            animation-play-state: paused;
	        } */
	    `}</style>
                </section>
            )}


        </div>
    );
}
