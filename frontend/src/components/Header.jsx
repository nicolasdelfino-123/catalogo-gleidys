import { useState, useContext, useEffect, useRef } from "react";
import { Context } from "../js/store/appContext.jsx";
import Cart from "../components/Cart.jsx";
import AccountDropdown from "../components/AccountDropdown.jsx";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { withWholesale } from "../utils/navigation.js";
import { formatCurrency } from "../utils/price.js";
import { Search, ShoppingCart } from "lucide-react";
import { PERFUME_CATEGORY_TREE } from "../utils/perfumeCategories.js";
import { storeConfig } from "../config/storeConfig.js";

const API = import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "") || "";
const headerLogo = `/${storeConfig.media.headerLogo}`;
const showHeaderContact = storeConfig.features?.showHeaderContact ?? true;
const headerThemeSource = storeConfig.features?.headerTheme;
const headerTheme = headerThemeSource === "white" ? "white" : "black";
const headerBackgroundColor =
  storeConfig.appearance?.header?.colors?.[headerTheme] || (headerTheme === "white" ? "#ffffff" : "#0B0608");
const isWhiteHeader = headerTheme === "white";
const headerSurfaceClass = isWhiteHeader
  ? "border-b border-gray-200"
  : "border-b border-yellow-600/20";
const headerLinkClass = isWhiteHeader
  ? "text-gray-950 hover:text-gray-600"
  : "text-gray-300 hover:text-amber-300";
const headerIconClass = isWhiteHeader
  ? "text-gray-950 hover:text-gray-600"
  : "text-gray-300 hover:text-amber-300";
const mobileMenuSurfaceClass = isWhiteHeader
  ? "bg-white border-t border-gray-200"
  : "bg-[#111113] border-t border-amber-500/20";
const mobileMutedClass = isWhiteHeader ? "text-gray-500" : "text-gray-400";
const mobileDividerClass = isWhiteHeader ? "border-gray-200" : "border-gray-700";
const mobileNestedBorderClass = isWhiteHeader ? "border-gray-200" : "border-amber-500/30";
const mobileSearchSurfaceClass = isWhiteHeader
  ? "border border-gray-300 bg-white"
  : "border border-white/35 bg-[#111113]";
const mobileSearchInputClass = isWhiteHeader
  ? "w-full !bg-transparent !text-gray-950 border-0 pr-16 text-[15px] placeholder:text-gray-500 focus:outline-none focus:ring-0 shadow-none"
  : "w-full !bg-transparent !text-white border-0 pr-16 text-[15px] placeholder:text-gray-500 focus:outline-none focus:ring-0 shadow-none";

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

const parseMoney = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/\./g, "").replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const getWholesaleSearchPrice = (product) => {
  const direct =
    parseMoney(product?.price_wholesale) ??
    parseMoney(product?.priceWholesale) ??
    parseMoney(product?.wholesale_price) ??
    parseMoney(product?.wholesalePrice);
  if (direct && direct > 0) return direct;

  const rawVolumeOptions = (() => {
    if (Array.isArray(product?.volume_options)) return product.volume_options;
    if (Array.isArray(product?.volumeOptions)) return product.volumeOptions;
    if (typeof product?.volume_options === "string") {
      try {
        const parsed = JSON.parse(product.volume_options);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (typeof product?.volumeOptions === "string") {
      try {
        const parsed = JSON.parse(product.volumeOptions);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (product?.volume_options && typeof product.volume_options === "object") {
      return Object.values(product.volume_options);
    }
    if (product?.volumeOptions && typeof product.volumeOptions === "object") {
      return Object.values(product.volumeOptions);
    }
    return [];
  })();

  for (const opt of rawVolumeOptions) {
    const optionWholesale =
      parseMoney(opt?.price_wholesale) ??
      parseMoney(opt?.wholesale_price) ??
      parseMoney(opt?.wholesalePrice);
    if (optionWholesale && optionWholesale > 0) return optionWholesale;
  }
  return null;
};

const getRetailSearchPrice = (product) => {
  const direct = parseMoney(product?.price) ?? parseMoney(product?.retail_price) ?? parseMoney(product?.retailPrice);
  if (direct && direct > 0) return direct;

  const rawVolumeOptions = (() => {
    if (Array.isArray(product?.volume_options)) return product.volume_options;
    if (Array.isArray(product?.volumeOptions)) return product.volumeOptions;
    if (typeof product?.volume_options === "string") {
      try {
        const parsed = JSON.parse(product.volume_options);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (typeof product?.volumeOptions === "string") {
      try {
        const parsed = JSON.parse(product.volumeOptions);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (product?.volume_options && typeof product.volume_options === "object") {
      return Object.values(product.volume_options);
    }
    if (product?.volumeOptions && typeof product.volumeOptions === "object") {
      return Object.values(product.volumeOptions);
    }
    return [];
  })();

  for (const opt of rawVolumeOptions) {
    const optionRetail = parseMoney(opt?.price) ?? parseMoney(opt?.retail_price) ?? parseMoney(opt?.retailPrice);
    if (optionRetail && optionRetail > 0) return optionRetail;
  }
  return null;
};



export default function Header() {
  const { store, actions } = useContext(Context);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchBoxRef = useRef(null);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchTerm, setMobileSearchTerm] = useState("");
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  const mobileMenuRef = useRef(null);

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const handleOpenCart = () => {
      setCartOpen(true);
      setIsMenuOpen(false);
    };

    window.addEventListener("open-cart", handleOpenCart);
    return () => window.removeEventListener("open-cart", handleOpenCart);
  }, []);


  // Cerrar y limpiar búsqueda cuando cambia la ruta
  useEffect(() => {
    setMobileSearchOpen(false);
    setMobileSearchTerm("");
    setSearchResults([]);
  }, [location.pathname]);

  // Cerrar si clickean fuera del cuadro de búsqueda / resultados
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileSearchOpen && searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setMobileSearchOpen(false);
        setMobileSearchTerm("");
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileSearchOpen]);

  const handleSearchChange = async (value) => {
    setMobileSearchTerm(value);

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    if (!store.products || store.products.length === 0) {
      await actions.fetchProducts();
    }

    setSearchResults(actions.searchProductsQuick(value));
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);


  const cartItemsCount = (store.cart || []).reduce((t, i) => t + (i.quantity || 0), 0);

  const productCategories = PERFUME_CATEGORY_TREE.map((category, index) => ({
    name: category.name,
    navName: category.navLabel || category.name,
    navOrder: Number.isFinite(category.navOrder) ? category.navOrder : index + 100,
    route: `/categoria/${category.slug}`,
    icon: category.emoji || "•",
    children: (category.children || []).map((child) => ({
      name: child.name,
      navName: child.navLabel || child.name,
      route: `/categoria/${child.slug}`,
      icon: child.emoji || "•",
    })),
  })).sort((a, b) => a.navOrder - b.navOrder);

  const goToContact = (e) => {
    e.preventDefault();

    const doScroll = () => {
      const el = document.getElementById("asesoria");
      if (!el) return;
      // Altura del header sticky (medimos por si cambia)
      const headerH = document.querySelector("header")?.offsetHeight || 80;
      const y = el.getBoundingClientRect().top + window.pageYOffset - headerH - 8; // un pelín más arriba
      window.scrollTo({ top: y, behavior: "smooth" });
    };



    const currentPath = window.location.pathname;
    const targetInicio = withWholesale("/inicio");

    if (currentPath !== "/inicio" && currentPath !== "/mayorista/inicio") {
      navigate(targetInicio, { state: { scrollTo: "contacto" } });
    } else {
      doScroll();
    }


    setIsMenuOpen(false); // cerrar menú móvil si estaba abierto
  };

  // Evita recargar el header entero en navegación
  useEffect(() => {
    // Esto asegura que React Router no fuerce un re-render del header al cambiar de ruta
    const header = document.querySelector("header img");
    if (header) {
      header.setAttribute("fetchpriority", "high");
      header.decoding = "sync";
    }
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);


  return (
    <>
      <header
        className={[
          `fixed top-0 left-0 right-0 lg:sticky lg:top-0 z-50 ${headerSurfaceClass} overflow-visible`,
          "transition-shadow duration-300",
          isScrolled ? "shadow-lg" : "shadow-none"
        ].join(" ")}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          transform: "translateZ(0)",
          backgroundColor: headerBackgroundColor,
        }}

      >

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 py-3">


            {/* Mobile hamburger menu - left */}
            {/* Mobile hamburger menu - left */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Abrir menú"
                className={`bg-transparent border-0 p-0 ${headerIconClass} flex items-center justify-center`}
                style={{ backgroundColor: 'transparent' }}
              >
                <svg className="w-5 h-5 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            {/* Logo centrado */}
            <div className="absolute left-1/2 lg:left-[calc(28%+10cm)] -translate-x-1/2 pointer-events-none">
              <Link to={withWholesale("/inicio")} aria-label="Ir al inicio" className="pointer-events-auto">
                <img
                  src={headerLogo}
                  alt={storeConfig.storeName.trim()}
                  className="mt-[10px] lg:mt-[10px] h-[125px] lg:h-[125px] object-contain transition-all duration-300"
                />
              </Link>
            </div>

            {/* Navigation - Desktop */}
            <nav className="hidden lg:flex h-full items-center gap-7 font-serif tracking-wider text-sm uppercase">
              <Link to={withWholesale("/inicio")} className={`${headerLinkClass} transition-all duration-300`}>Inicio</Link>

              {productCategories.map((category) => (
                <Link
                  key={category.route}
                  to={withWholesale(category.route)}
                  className={`${headerLinkClass} whitespace-nowrap transition-all duration-300`}
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                >
                  {category.navName}
                </Link>
              ))}

              {/*  <Link
              to="/mayorista"
              className="text-gray-300 hover:text-amber-300 transition-all duration-300"
            >
              Mayoristas
            </Link> */}
              {showHeaderContact && (
                <a
                  href={withWholesale("/inicio") + "#asesoria"}
                  onClick={goToContact}
                  className={`${headerLinkClass} transition-all duration-300`}
                >
                  Contacto
                </a>
              )}
            </nav>

            {/* Desktop Actions */}
            <div className={`hidden lg:flex items-center space-x-4 ${isWhiteHeader ? "text-gray-950" : "text-white"} ml-8`}>
              <AccountDropdown />
              {/* Lupa Desktop */}

              <button
                type="button"
                onClick={() => setMobileSearchOpen(v => !v)}   // <-- CAMBIO: antes tenías navigate("/busqueda")
                className="hover:text-purple-400 transition-colors bg-transparent border-0 p-0"
                aria-label="Buscar productos"
                title="Buscar"
              >
                <Search className={`w-5 h-5 stroke-[1.5] ${headerIconClass} transition-colors duration-300`} />
              </button>


              {/* Carrito Desktop */}
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative hover:text-purple-400 transition-colors bg-transparent border-0 p-0"
                aria-label="Abrir carrito"
                title="Carrito"
              >
                <ShoppingCart className={`w-5 h-5 stroke-[1.5] ${headerIconClass} transition-colors duration-300`} />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-amber-500 text-black font-semibold px-1.5 py-[2px] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile cart - right */}
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className={`relative transition-colors bg-transparent border-0 p-0 ${headerIconClass}`}
                aria-label="Abrir carrito"
                title="Carrito"
              >
                <ShoppingCart className={`w-5 h-5 stroke-[1.5] ${headerIconClass} transition-colors duration-300`} />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-amber-500 text-black font-semibold px-1.5 py-[2px] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="lg:hidden px-5 pb-4">
            <div className="relative" ref={searchBoxRef}>
              <div className={`relative ${mobileSearchSurfaceClass} -mx-9 px-4 py-2 rounded-md`}>
                <input
                  type="text"
                  value={mobileSearchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar"
                  autoFocus
                  className={mobileSearchInputClass}
                  style={{
                    backgroundImage: isWhiteHeader
                      ? "linear-gradient(#ffffff, #ffffff)"
                      : "linear-gradient(#111113, #111113)",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "100% 100%",
                    WebkitTextFillColor: isWhiteHeader ? "#111827" : "#fff",
                  }}
                />

                {mobileSearchTerm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSearchTerm("");
                      setSearchResults([]);
                    }}
                    aria-label="Limpiar búsqueda"
                    className={`absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-transparent border-0 p-0 ${headerIconClass}`}
                    style={{ backgroundColor: "transparent" }}
                  >
                    ✕
                  </button>
                ) : (
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center ${isWhiteHeader ? "text-gray-950" : "text-white"}`}
                  >
                    <Search className="h-6 w-6 stroke-[1.5]" />
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="absolute left-1/2 top-full z-50 mt-2 max-h-80 w-[calc(100vw-32px)] -translate-x-1/2 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
                  {searchResults.map((p) => {
                    const wholesalePrice = getWholesaleSearchPrice(p);
                    const retailPrice = getRetailSearchPrice(p);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          const prefix = location.pathname.startsWith("/mayorista") ? "/mayorista" : "";
                          navigate(`${prefix}/product/${p.id}`);
                          setSearchResults([]);
                        }}
                        className="flex items-center gap-3 border-b border-gray-200 p-3 last:border-b-0"
                      >
                        <img
                          src={toAbsUrl(p.image_url) || "/sin_imagen.jpg"}
                          alt={p.name}
                          className="h-12 w-12 object-contain rounded"
                          onError={(e) => {
                            e.currentTarget.src = "/sin_imagen.jpg";
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-800">
                            {p.name}
                          </div>
                          <div className="text-sm font-bold text-green-600">
                            {location.pathname.startsWith("/mayorista")
                              ? wholesalePrice && wholesalePrice > 0
                                ? formatCurrency(wholesalePrice)
                                : "Consultar"
                              : retailPrice && retailPrice > 0
                                ? formatCurrency(retailPrice)
                                : "Consultar"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Search Box desktop */}
          {mobileSearchOpen && (
            <div className="hidden lg:block bg-gray-1000 p-3 z-50">
              <div className="flex justify-end px-4 sm:px-6 lg:px-8">
                <div className="static w-full max-w-md" ref={searchBoxRef}>
                  <div className="flex">
                    <input
                      type="text"
                      value={mobileSearchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Buscar productos..."
                      className="w-full max-w-md p-2 pr-9 rounded-md text-black focus:outline-none"
                      autoFocus
                    />

                    {/* Botón X (limpiar/cerrar) */}
                    {mobileSearchOpen && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileSearchTerm("");
                          setSearchResults([]);
                          setMobileSearchOpen(false);
                        }}
                        aria-label="Cerrar búsqueda"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 text-sm"
                        title="Cerrar"
                      >
                        ✕
                      </button>
                    )}
                  </div>


                  {/* 👇 Caja de resultados: Pegar aquí, dentro del max-w-7xl */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full w-full mt-1 max-w-md bg-white rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">

                      {searchResults.map((p) => {
                        const wholesalePrice = getWholesaleSearchPrice(p);
                        const retailPrice = getRetailSearchPrice(p);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              const prefix = location.pathname.startsWith("/mayorista") ? "/mayorista" : "";
                              navigate(`${prefix}/product/${p.id}`);
                              setMobileSearchOpen(false);
                            }}

                            className="flex items-center p-3 hover:bg-gray-300 cursor-pointer border-b border-gray-200 last:border-b-0"
                          >
                            <img
                              src={toAbsUrl(p.image_url) || "/sin_imagen.jpg"}
                              alt={p.name}
                              className="w-12 h-12 object-contain rounded mr-3"
                              onError={(e) => { e.currentTarget.src = "/sin_imagen.jpg"; }}
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-800">{p.name}</div>
                              <div className="text-green-600 font-bold text-sm">
                                {location.pathname.startsWith("/mayorista")
                                  ? (
                                    wholesalePrice && wholesalePrice > 0
                                      ? formatCurrency(wholesalePrice)
                                      : "Consultar"
                                  )
                                  : (retailPrice && retailPrice > 0
                                    ? formatCurrency(retailPrice)
                                    : "Consultar")
                                }
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* 👆 Fin caja de resultados */}
                </div>
              </div>
            </div>
          )}


          {/* Mobile Menu */}
          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="lg:hidden absolute left-0 right-0 top-full z-50">
              <div
                ref={mobileMenuRef}
                className={`${mobileMenuSurfaceClass} max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain shadow-xl px-4 pt-1 pb-5 space-y-3 font-serif tracking-wide`}
              >
                {/* Botón X dedicado para cerrar */}
                <div className="flex justify-end -mt-1 -mr-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}
                    aria-label="Cerrar menú"
                    className={`bg-transparent border-0 p-3 ${headerIconClass} flex items-center justify-center`}
                    style={{ backgroundColor: 'transparent' }}
                  >
                    <svg className="w-5 h-5 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <Link
                  to={withWholesale("/inicio")}
                  className={`block ${headerLinkClass} transition-all duration-300 text-lg`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Inicio
                </Link>

                {/* Productos en mobile */}
                <div className="pt-2">
                  <span className={`block ${mobileMutedClass} text-sm uppercase tracking-wider mb-2`}>
                    Productos
                  </span>

                  <div className={`border-l ${mobileNestedBorderClass} pl-4 space-y-2`}>

                    <Link
                      to={withWholesale("/products")}
                      className={`block ${headerLinkClass} transition-all duration-300`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Ver todos los productos
                    </Link>

                    {productCategories.map((category) => {
                      const hasChildren = category.children.length > 0;
                      const expanded = mobileCategoryOpen === category.route;

                      return (
                        <div key={category.route} className={`${hasChildren ? `border-b ${mobileNestedBorderClass} pb-2 last:border-b-0` : ""}`}>
                          {hasChildren ? (
                            <button
                              type="button"
                              className={`flex w-full items-center justify-between gap-3 bg-transparent p-0 text-left ${headerLinkClass} transition-colors`}
                              onClick={() => setMobileCategoryOpen((current) => current === category.route ? null : category.route)}
                            >
                              <span>{category.icon} {category.navName}</span>
                              <span className={`block text-lg leading-none transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
                            </button>
                          ) : (
                            <Link
                              to={withWholesale(category.route)}
                              className={`block ${headerLinkClass} transition-colors`}
                              onClick={() => setIsMenuOpen(false)}
                            >
                              {category.icon} {category.navName}
                            </Link>
                          )}

                          {hasChildren && expanded && (
                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 pl-3">
                              {category.children.map((child) => (
                                <Link
                                  key={child.route}
                                  to={withWholesale(child.route)}
                                  className={`truncate text-[15px] ${mobileMutedClass} hover:text-amber-300 transition-colors`}
                                  onClick={() => setIsMenuOpen(false)}
                                >
                                  {child.navName}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  </div>
                </div>

                {showHeaderContact && (
                  <a
                    href={withWholesale("/inicio") + "#asesoria"}
                    onClick={goToContact}

                    className={`block pt-4 mt-3 border-t ${mobileDividerClass} ${headerLinkClass} transition-colors text-lg`}
                  >
                    Contacto
                  </a>
                )}

                {/* Mobile: Ingresar solo si NO hay usuario */}
                {
                  store.user && (
                    <div className={`border-t ${mobileDividerClass} pt-2`}>

                      <div className={`px-3 py-2 text-sm ${mobileMutedClass}`}>
                        Hola Administrador
                      </div>

                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigate("/admin/login");
                        }}
                        className={`block w-full text-left px-3 py-2 ${headerLinkClass} transition-all duration-300`}
                      >
                        Panel Admin
                      </button>

                      <button
                        onClick={() => {
                          actions.logoutUser();
                          setIsMenuOpen(false);
                        }}
                        className={`block w-full text-left px-3 py-2 ${headerLinkClass} transition-all duration-300`}
                      >
                        Cerrar sesión
                      </button>

                    </div>
                  )
                }
              </div>
            </div>
          )}
        </div>
        <Cart isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      </header>

      <div className="block lg:hidden h-[128px]" aria-hidden="true" />
    </>
  );
}
