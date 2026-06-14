import { storeConfig } from "../config/storeConfig";

export const DEFAULT_CATEGORY_ID = 1;
export const BEST_SELLERS_CATEGORY_ID = 999999;
export const BEST_SELLERS_CATEGORY_NAME = "Más Vendidos";
export const BEST_SELLERS_CATEGORY_SLUG = "mas-vendidos";

// Contrato técnico de categorías: estos IDs son los que viajan como category_id a la DB.
// Los labels, el orden y la jerarquía visible se configuran desde storeConfig.catalog.categories.
const PERFUME_CATEGORY_ID_DEFINITIONS = [
    { id: 1, fallbackName: "Masculinos", slug: "masculinos" },
    { id: 2, fallbackName: "Femeninos", slug: "femeninos" },
];

const slugifyCategoryLabel = (value = "") =>
    String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const normalizeCategoryLabel = (value = "") =>
    String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

const getCategoryEmoji = (category = {}, name = "") => {
    if (category.emoji) return category.emoji;

    const normalized = normalizeCategoryLabel(name);
    if (normalized.includes("femen")) return "🌸";
    if (normalized.includes("mascul")) return "🖤";
    if (normalized.includes("unisex")) return "✨";
    if (normalized.includes("ray") || normalized.includes("gafa")) return "🕶️";
    if (normalized.includes("ferrari") || normalized.includes("scuderia")) return "🏎️";
    if (normalized.includes("perfume")) return "✨";
    return "•";
};

const baseDefinitionById = Object.fromEntries(
    PERFUME_CATEGORY_ID_DEFINITIONS.map((category) => [category.id, category])
);

const configuredCategories = Array.isArray(storeConfig.catalog?.categories)
    ? storeConfig.catalog.categories
    : [];

const baseCatalogCategories = configuredCategories.length
    ? configuredCategories
    : PERFUME_CATEGORY_ID_DEFINITIONS.map((category) => ({
        id: category.id,
        label: category.fallbackName,
        slug: category.slug,
    }));

const bestSellersCategory = {
    id: BEST_SELLERS_CATEGORY_ID,
    label: BEST_SELLERS_CATEGORY_NAME,
    slug: BEST_SELLERS_CATEGORY_SLUG,
    emoji: "★",
};

const catalogCategories = storeConfig.features?.bestSellers === true
    ? [
        ...baseCatalogCategories.filter((category) => Number(category?.id) !== BEST_SELLERS_CATEGORY_ID),
        bestSellersCategory,
    ]
    : baseCatalogCategories.filter((category) => Number(category?.id) !== BEST_SELLERS_CATEGORY_ID);

const buildCategoryTree = (categories = [], parentId = null, level = 0) =>
    categories
        .map((category) => {
            const id = Number(category?.id);
            if (!Number.isFinite(id)) return null;

            const base = baseDefinitionById[id];
            const name = String(category?.label || category?.name || base?.fallbackName || `Categoría ${id}`).trim();
            const slug = String(category?.slug || base?.slug || slugifyCategoryLabel(name) || `categoria-${id}`).trim();
            const children = buildCategoryTree(category?.children || [], id, level + 1);

            return {
                id,
                name,
                navLabel: String(category?.navLabel || "").trim() || name,
                navOrder: Number.isFinite(Number(category?.navOrder)) ? Number(category.navOrder) : null,
                slug,
                emoji: getCategoryEmoji(category, name),
                parentId,
                level,
                children,
                fallbackName: base?.fallbackName || name,
            };
        })
        .filter(Boolean);

const fallbackTree = PERFUME_CATEGORY_ID_DEFINITIONS.map((category) => ({
    id: category.id,
    name: category.fallbackName,
    navLabel: category.fallbackName,
    navOrder: null,
    slug: category.slug,
    emoji: getCategoryEmoji(category, category.fallbackName),
    parentId: null,
    level: 0,
    children: [],
    fallbackName: category.fallbackName,
}));

export const PERFUME_CATEGORY_TREE = catalogCategories.length
    ? buildCategoryTree(catalogCategories)
    : fallbackTree;

const flattenCategories = (categories = []) =>
    categories.flatMap((category) => [
        category,
        ...flattenCategories(category.children || []),
    ]);

const getCategoryAndDescendantIds = (category) => [
    category.id,
    ...(category.children || []).flatMap(getCategoryAndDescendantIds),
];

export const PERFUME_CATEGORY_DEFINITIONS = flattenCategories(PERFUME_CATEGORY_TREE);

export const PERFUME_CATEGORY_NAMES = PERFUME_CATEGORY_DEFINITIONS.map((category) => category.name);

export const CATEGORY_ID_TO_NAME = Object.fromEntries(
    PERFUME_CATEGORY_DEFINITIONS.map((category) => [category.id, category.name])
);

export const CATEGORY_NAME_TO_ID = Object.fromEntries(
    PERFUME_CATEGORY_DEFINITIONS.map((category) => [category.name, category.id])
);

export const SLUG_TO_NAME = Object.fromEntries(
    PERFUME_CATEGORY_DEFINITIONS.map((category) => [category.slug, category.name])
);

export const SLUG_TO_ID = Object.fromEntries(
    PERFUME_CATEGORY_DEFINITIONS.map((category) => [category.slug, category.id])
);

export const SLUG_TO_IDS = Object.fromEntries(
    PERFUME_CATEGORY_DEFINITIONS.map((category) => [category.slug, getCategoryAndDescendantIds(category)])
);

export const NAME_TO_SLUG = Object.fromEntries(
    PERFUME_CATEGORY_DEFINITIONS.map((category) => [category.name, category.slug])
);

const LEGACY_NAME_TO_SLUG = {
    ...Object.fromEntries(
        PERFUME_CATEGORY_DEFINITIONS.map((category) => [category.fallbackName, category.slug])
    ),
    ...Object.fromEntries(
        PERFUME_CATEGORY_DEFINITIONS.map((category) => [category.name, category.slug])
    ),
};

const NORMALIZED_NAME_TO_ID = {
    ...Object.fromEntries(
        PERFUME_CATEGORY_DEFINITIONS.map((category) => [normalizeCategoryLabel(category.fallbackName), category.id])
    ),
    ...Object.fromEntries(
        PERFUME_CATEGORY_DEFINITIONS.map((category) => [normalizeCategoryLabel(category.name), category.id])
    ),
};

export const mapCategoryIdFromName = (value = "") => {
    const normalized = normalizeCategoryLabel(value);
    return NORMALIZED_NAME_TO_ID[normalized] || DEFAULT_CATEGORY_ID;
};

export const getNormalizedCategoryId = (product) => {
    const id = Number(product?.category_id);
    if (CATEGORY_ID_TO_NAME[id]) return id;

    const byName = mapCategoryIdFromName(product?.category_name);
    return byName || DEFAULT_CATEGORY_ID;
};

export const getProductCategoryIds = (product) => {
    const ids = [];
    const pushId = (rawId) => {
        const id = Number(rawId);
        if (Number.isFinite(id) && id > 0 && CATEGORY_ID_TO_NAME[id] && !ids.includes(id)) {
            ids.push(id);
        }
    };

    pushId(product?.category_id);
    if (Array.isArray(product?.category_ids)) {
        product.category_ids.forEach(pushId);
    }
    if (Array.isArray(product?.extra_category_ids)) {
        product.extra_category_ids.forEach(pushId);
    }

    if (!ids.length) ids.push(getNormalizedCategoryId(product));
    return ids;
};

export const getDisplayCategoryName = (product) => {
    const normalizedId = getNormalizedCategoryId(product);
    return CATEGORY_ID_TO_NAME[normalizedId] || CATEGORY_ID_TO_NAME[DEFAULT_CATEGORY_ID];
};

export const getCategorySlugFromName = (value = "") =>
    LEGACY_NAME_TO_SLUG[String(value || "").trim()] || NAME_TO_SLUG[String(value || "").trim()];
