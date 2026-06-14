export const storeConfig = {
    storeName: " Store Perfumes",

    features: {
        showHeaderContact: false,
        showBrandCarousel: true,
        coupon: false,
        priceAdjustment: false,
        // Activa/desactiva la categoría virtual "Más Vendidos" en header, footer, filtros, admin y modal de productos.
        bestSellers: false,
        headerTheme: "black", // "black" | "white"
        footerTheme: "black", // "black" | "white"
    },

    appearance: {
        header: {
            colors: {
                white: "#ffffff",
                black: "#0B0608",
            },
        },
        footer: {
            colors: {
                white: "#ffffff",
                black: "#040404",
            },
        },
    },

    branding: {
        heroTitle: "Fragancias Árabes Exclusivas",
        heroSubtitle: "Aromas intensos · Calidad premium · Precios accesibles",
        /*       footerText: "Perfumes árabes originales en Argentina.", */
    },

    currency: {
        // Texto visible antes de los precios en cards, detalle, carrito, admin, toast y presupuestos.
        // Ejemplos: "$", "COP", "USD", "CLP", "S/"
        symbol: "COP",
    },

    hero: {
        // Defaults responsive: si dejás estos valores como están, la imagen no se recorta.
        // Para ajustar manualmente podés usar px, %, vh, vw, calc(...), etc.
        desktop: {
            sectionPaddingTop: "0px",
            sectionPaddingBottom: "0px",
            sectionMarginTop: "0px",
            sectionMarginBottom: "0px",
            sectionMinHeight: "auto",

            imageWidth: "100%",
            imageMaxWidth: "100%",
            imageHeight: "auto",
            imageMinHeight: "auto",
            imageMaxHeight: "none",
            imageFit: "contain", // "contain" no recorta | "cover" llena y puede recortar
            imagePosition: "center center",
            imageOffsetX: "0px",
            imageOffsetY: "0px",
        },

        mobile: {
            // En mobile el header es fixed; este padding evita que el hero quede debajo.
            sectionPaddingTop: "0px",
            sectionPaddingBottom: "0px",
            sectionMarginTop: "0px",
            sectionMarginBottom: "0px",
            sectionMinHeight: "auto",

            imageWidth: "100%",
            imageMaxWidth: "100%",
            imageHeight: "auto",
            imageMinHeight: "auto",
            imageMaxHeight: "none",
            imageFit: "contain",
            imagePosition: "center center",
            imageOffsetX: "0px",
            imageOffsetY: "0px",
        },

        textBlock: {
            enabled: false,
            background: "#000000",
            textColor: "#ffffff",
            subtitleColor: "#e5e7eb",

            desktop: {
                height: "auto",
                paddingTop: "24px",
                paddingBottom: "24px",
                paddingX: "24px",
                marginTop: "0px",
                marginBottom: "0px",
            },

            mobile: {
                height: "auto",
                paddingTop: "24px",
                paddingBottom: "24px",
                paddingX: "20px",
                marginTop: "0px",
                marginBottom: "0px",
            },
        },
    },

    catalog: {
        // Cambia el texto chico de las cards del listado: "category" muestra la categoría y "brand" muestra la marca del producto.
        productCardMeta: "brand", // "category" | "brand"

        // Categorías visibles del catálogo. Pueden tener hijos con "children".
        // Cada id es un valor real que se guarda/envía a la DB como category_id.
        // El label es el nombre que se muestra en header, footer, filtros, cards y admin.
        // El orden de esta lista define el orden visual en los dropdowns y menús.
        // slug es opcional; si no lo ponés, usa el slug técnico definido en perfumeCategories o lo genera desde el label.
        categories: [
            {
                id: 1,
                label: "Perfumes Árabes",
                navLabel: "Árabes",
                navOrder: 1,
                slug: "perfumes-arabes",
                emoji: "✨",
                children: [
                    { id: 5, label: "Masculinos", slug: "masculinos", emoji: "🖤" },
                    { id: 6, label: "Femeninos", slug: "femeninos", emoji: "🌸" },
                    { id: 7, label: "Unisex", slug: "unisex", emoji: "✨" },
                ],
            },
            {
                id: 2,
                label: "Perfumes de Diseñador",
                navLabel: "Diseñador",
                navOrder: 3,
                slug: "perfumes-de-disenador",
                emoji: "◆",
            },
            {
                id: 3,
                label: "Perfumes de Nicho",
                navLabel: "Nicho",
                navOrder: 2,
                slug: "perfumes-de-nicho",
                emoji: "★",
            },
            {
                id: 4,
                label: "Victoria’s Secret",
                navLabel: "Victoria’s Secret",
                navOrder: 4,
                slug: "victorias-secret",
                emoji: "♡",
            },
        ],
    },

    footer: {
        copyrightName: "Catálogo Web",
        developerName: "Catálogo Web",
        developerWhatsapp: "5493534793366"
    },

    contact: {
        whatsapp: "5493534793366",
        whatsappMessage: "Hola, quiero consultar por un perfume del catálogo",
        whatsappDisplay: "+56 9 6407 7278",
        // Prefijos para el modal de presupuesto. Con un solo elemento se muestra fijo; con varios aparece un selector.
        phonePrefixes: [
            /* { label: "+56", value: "56", placeholder: "964077278" }, */
            { label: "+54", value: "54", placeholder: "3534793366" },
            /*       { label: "+57", value: "57", placeholder: "3001234567" },
                  { label: "+58", value: "58", placeholder: "4121234567" }, */
        ],

        instagram: "https://www.instagram.com/danna_decants_puq/",
        instagramDisplay: "@danna_decants_puq",

        email: "nicolasdelfino585@gmail.com",
        /*  emailDisplay: "nicolasdelfino585@gmail.com", */
    },

    business: {
        address: "Stand Mall, Espacio Urbano Pionero",
        city: "Segundo piso, (casi al lado de Tarragona)",
        hours: "Lunes a Sábado, 10:30–20:30 - Domingo 11:00–20:00",
    },

    media: {
        // Hero desktop: se carga desde frontend/public. Escribi solo el nombre del archivo o una ruta publica, por ejemplo "f3_si.png".
        heroImageDesktop: "porta.jpeg",
        // Hero mobile: se carga desde frontend/public. Escribi solo el nombre del archivo o una ruta publica, por ejemplo "f3_si.png".
        heroImageMobile: "porta_movil.jpeg",
        // GIF del GlobalSpinner: se carga desde frontend/public. Si queres cambiarlo, pone el GIF en public y actualiza este nombre.
        globalSpinnerGif: "gif_ele.gif",
        headerLogo: "header_sisi.png",
        footerLogo: "pp.png",
    },

    map: {
        embed: "https://www.google.com/maps?q=-53.1315202,-70.9090699&z=17&output=embed",
    }
};
