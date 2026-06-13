import { PERFUME_CATEGORY_NAMES } from "../../utils/perfumeCategories.js";
import { getApiUrl } from "../../utils/apiUrl.js";

const backendUrl = getApiUrl();

const getState = ({ getStore, getActions, setStore }) => {
	return {
		store: {
			personas: ["Pedro", "Maria"],
			demoMsg: "",
			// Store para el catálogo
			products: [],
			cart: [],
			user: null,
			loading: false,
			categories: PERFUME_CATEGORY_NAMES,
			orders: [],
			userAddress: { address: "", phone: "" },
			updateStatusMsg: "",
			billingAddress: null,   // ← NUEVO: JSON de facturación
			shippingAddress: null,  // ← NUEVO: JSON de envío
			dni: "",
			productSearch: "",
			isWholesale: false,


			// Toast notifications
			toast: {
				isVisible: false,
				message: "",
				product: null
			},

		},
		actions: {

			setWholesaleMode: (value) => {
				setStore({ isWholesale: value });
				localStorage.setItem("wholesaleMode", value ? "1" : "0");
			},

			hydrateWholesaleMode: () => {
				const saved = localStorage.getItem("wholesaleMode");
				if (saved === "1") {
					setStore({ isWholesale: true });
				}
			},


			getAuthHeaders: () => {
				const token = localStorage.getItem("token");
				return {
					"Content-Type": "application/json",
					...(token ? { "Authorization": `Bearer ${token}` } : {})
				};
			},

			fetchUserAddresses: async () => {
				const store = getStore();
				const token = localStorage.getItem("token");
				if (!token) return null;

				try {
					const url = `${backendUrl}/user/address`;
					const res = await fetch(url, {
						headers: { "Authorization": `Bearer ${token}` }
					});

					if (!res.ok) {
						throw new Error(`[${res.status}] ${res.statusText || "No se pudo obtener direcciones"}`);
					}

					const data = await res.json(); // { billing_address, shipping_address, dni }
					setStore({
						...store,
						billingAddress: data.billing_address || null,
						shippingAddress: data.shipping_address || null,
						dni: data.dni || ""
					});
					return data;
				} catch (e) {
					console.error("fetchUserAddresses:", e);
					return null;
				}
			},

			updateUserAddressTyped: async (type, payload) => {
				const store = getStore();
				const token = localStorage.getItem("token");
				if (!token) return false;

				try {
					const url = `${backendUrl}/user/address`;
					const res = await fetch(url, {
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${token}`
						},
						body: JSON.stringify({ type, payload })
					});

					if (!res.ok) {
						const err = await res.json().catch(() => ({}));
						console.error("updateUserAddressTyped:", res.status, err);
						return false;
					}

					await getActions().fetchUserAddresses();
					setStore({ ...store, updateStatusMsg: `Dirección de ${type} actualizada` });
					return true;
				} catch (e) {
					console.error("updateUserAddressTyped:", e);
					return false;
				}
			},

			// Azúcar: guardar envío usando la función tipada
			fetchUserBillingAddress: async () => {
				const data = await getActions().fetchUserAddresses();
				return data?.billing_address || null;
			},

			fetchUserShippingAddress: async () => {
				const data = await getActions().fetchUserAddresses();
				return data?.shipping_address || null;
			},

			saveShippingAddress: async (payload) => {
				return getActions().updateUserAddressTyped("shipping", payload);
			},



			exampleFunction: () => {
				console.log(backendUrl)
				return
			},

			searchProducts: (query) => {
				const store = getStore();
				setStore({ ...store, productSearch: query });
			},

			searchProductsQuick: (query) => {
				const store = getStore();
				const q = query.toLowerCase();
				if (!q) return [];
				return (store.products || []).filter(
					p =>
						p.name?.toLowerCase().includes(q) ||
						p.brand?.toLowerCase().includes(q)
				);
			},


			demoFunction: async () => {
				const urlAboutPublic = backendUrl + '/public/demo';
				const store = getStore();

				try {

					const response = await fetch(urlAboutPublic, { method: 'GET' });

					if (!response.ok) {
						console.log(response.statusText)
						throw new Error('Network response error');
					}

					const data = await response.json();
					setStore({ ...store, demoMsg: data.msg })

					return data.msg

				} catch (error) {
					console.error('Error fetching data:', error);
					return false
				}
			},

			register: async (email, password, name) => {
				try {
					const response = await fetch(`${backendUrl}/user/signup`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json"
							},
							body: JSON.stringify({
								email,
								password,
								name
							})
						});

					if (!response.ok) {
						const errorData = await response.json();
						return { success: false, error: errorData.error || "Registro fallido" };
					}

					const data = await response.json();
					return { success: true, data: data };

				} catch (error) {
					return { success: false, error: "Ocurrió un error inesperado." };
				}
			},



			// Login para administradores
			adminLogin: async (email, password) => {
				try {
					const response = await fetch(`${backendUrl}/user/login`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ email, password })
					});

					if (!response.ok) {
						const errorData = await response.json();
						return { success: false, error: errorData.error || "Login fallido" };
					}

					const data = await response.json();

					if (data.access_token) {
						// Verificar si es admin
						try {
							const userRes = await fetch(`${backendUrl}/user/me`, {
								headers: { "Authorization": `Bearer ${data.access_token}` }
							});
							if (userRes.ok) {
								const userData = await userRes.json();
								if (userData.is_admin) {
									localStorage.setItem("token", data.access_token);
									localStorage.setItem("admin_token", data.access_token);
									const store = getStore();
									setStore({ ...store, user: userData });
									return { success: true, data: userData, isAdmin: true };
								} else {
									return { success: false, error: "No tienes permisos de administrador" };
								}
							}
						} catch (userError) {
							console.log("Error obteniendo datos de usuario:", userError);
						}
					}

					return { success: false, error: "Error en autenticación" };
				} catch (error) {
					return { success: false, error: "Error inesperado" };
				}
			},


			// Obtener categorías desde la API
			fetchCategoriesFromAPI: async () => {
				const store = getStore();
				setStore({ ...store, loading: true });

				try {
					const response = await fetch(`${backendUrl}/public/categories`);
					if (!response.ok) {
						throw new Error('Error al obtener categorías');
					}
					const categories = await response.json();
					const categoryNames = categories.map(cat => cat.name);
					setStore({ ...store, categories: categoryNames, loading: false });
					return { success: true, data: categoryNames };
				} catch (error) {
					console.error("Error fetching categories:", error);
					setStore({ ...store, loading: false });
					return { success: false, error: error.message };
				}
			},

			// Crear categoría desde admin
			createCategory: async (categoryData) => {
				try {
					const token = localStorage.getItem("token");
					const response = await fetch(`${backendUrl}/admin/categories`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${token}`
						},
						body: JSON.stringify(categoryData)
					});

					if (!response.ok) {
						const errorData = await response.json();
						throw new Error(errorData.error || 'Error al crear categoría');
					}

					const category = await response.json();
					return { success: true, data: category };
				} catch (error) {
					console.error("Error creating category:", error);
					return { success: false, error: error.message };
				}
			},






			/* ACA EMPIEZO A */

			hydrateSession: async () => {
				const store = getStore();
				const token = localStorage.getItem("token");
				console.log("💧 [hydrateSession] INICIO. Token:", token ? "SÍ" : "NO");

				if (!token) {
					console.log("💧 [hydrateSession] No hay token, no se hidrata sesión");
					return;
				}

				try {
					const res = await fetch(`${backendUrl}/user/me`, {
						headers: { "Authorization": `Bearer ${token}` }
					});

					if (!res.ok) throw new Error("No se pudo hidratar sesión");

					const user = await res.json();
					console.log("💧 [hydrateSession] Respuesta user:", JSON.stringify(user));

					// ⚠️ Log especial: verificar si backend devuelve carrito
					if (user.cart) {
						console.warn("🚨 [hydrateSession] El backend devolvió un CART:", user.cart);
					}

					setStore({ ...store, user });
					console.log("💧 [hydrateSession] Store después de setear user:", getStore());

					try {
						await getActions().fetchUserAddresses();
					} catch (e) {
						console.error("💧 [hydrateSession] Error fetchUserAddresses:", e);
					}
				} catch (e) {
					console.error("❌ [hydrateSession] ERROR:", e);
					localStorage.removeItem("token");
					setStore({ ...store, user: null });
				}
			},

			setPickup: (value) => {
				const store = getStore();
				setStore({ ...store, pickup: value });
				localStorage.setItem("pickup", JSON.stringify(value));
			},

			login: async (email, password) => {
				console.log("🔐 [login] INICIO con", email);

				try {
					const response = await fetch(`${backendUrl}/user/login`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ email, password })
					});

					if (!response.ok) {
						const errorData = await response.json();
						console.error("❌ [login] Fallo:", errorData);
						return { success: false, error: errorData.error || "Login fallido" };
					}

					const data = await response.json();
					console.log("🔐 [login] Respuesta login:", JSON.stringify(data));

					if (data.access_token) {
						localStorage.setItem("token", data.access_token);
						localStorage.removeItem('needs_password_reset'); // 👈 NUEVO: limpiar flag en login normal

						try {
							const userRes = await fetch(`${backendUrl}/user/me`, {
								headers: { "Authorization": `Bearer ${data.access_token}` }
							});

							if (userRes.ok) {
								const userData = await userRes.json();
								console.log("🔐 [login] Respuesta userData:", JSON.stringify(userData));

								if (userData.cart) {
									console.warn("🚨 [login] El backend devolvió un CART:", userData.cart);
								}

								const store = getStore();
								setStore({ ...store, user: userData });
								console.log("🔐 [login] Store actualizado:", getStore());

								try { await getActions().fetchUserAddresses(); } catch { }

								return { success: true, data: userData };
							}
						} catch (userError) {
							console.error("❌ [login] Error obteniendo datos de usuario:", userError);
						}
					}

					// fallback
					const store = getStore();
					setStore({ ...store, user: { role: data.role } });
					return { success: true, data: data };

				} catch (error) {
					console.error("❌ [login] Error inesperado:", error);
					return { success: false, error: "ocurrió un error inesperado" };
				}
			},

			fetchUserAddress: async () => {
				const token = localStorage.getItem("token");
				if (!token) return null;
				try {
					const res = await fetch(`${backendUrl}/user/address`, {
						headers: { "Authorization": `Bearer ${token}` }
					});
					if (!res.ok) throw new Error("No se pudo obtener dirección");
					const data = await res.json(); // {address, phone}
					const store = getStore();
					setStore({ ...store, userAddress: data });
					return data;
				} catch (e) {
					console.error(e);
					return null;
				}
			},

			updateUserAddress: async (address, phone) => {
				const token = localStorage.getItem("token");
				if (!token) return;
				try {
					const res = await fetch(`${backendUrl}/user/address`, {
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${token}`
						},
						body: JSON.stringify({ address, phone })
					});
					if (!res.ok) throw new Error("No se pudo actualizar dirección");
					const data = await res.json();
					const store = getStore();
					setStore({ ...store, userAddress: data, updateStatusMsg: "Dirección actualizada" });
					return true;
				} catch (e) {
					console.error(e);
					return false;
				}
			},

			// 🔥 MEJORAR: Logs más detallados para debugging
			// En flux.js, action updateAccountDetails (línea ~295 aprox)
			updateAccountDetails: async (userData) => {
				const token = localStorage.getItem("token");
				console.log("🔧 Actualizando cuenta:", { token: token ? "✅" : "❌", userData });

				if (!token) {
					const store = getStore();
					setStore({ ...store, updateStatusMsg: "Error: No hay sesión activa" });
					return false;
				}

				try {
					const res = await fetch(`${backendUrl}/user/me`, {
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${token}`
						},
						body: JSON.stringify(userData)
					});

					const store = getStore();

					if (!res.ok) {
						const err = await res.json();
						console.error("❌ Error del backend:", err);
						setStore({ ...store, updateStatusMsg: err.error || "No se pudo actualizar los datos" });
						return false;
					}

					const updatedUser = await res.json();
					console.log("✅ Usuario actualizado:", updatedUser);

					setStore({
						...store,
						user: updatedUser,
						updateStatusMsg: "Datos actualizados correctamente"
					});
					return true; // 👈 Retornar true explícito
				} catch (e) {
					console.error("❌ Error en updateAccountDetails:", e);
					const store = getStore();
					setStore({ ...store, updateStatusMsg: "Error inesperado al actualizar" });
					return false;
				}
			},
			sendPasswordSetupEmail: async (email) => {
				try {
					const response = await fetch(`${backendUrl}/user/register-email`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ email })
					});

					if (!response.ok) {
						const errorData = await response.json();
						return { success: false, error: errorData.error || "Error al enviar email" };
					}

					const data = await response.json();
					return { success: true, data: data };
				} catch (error) {
					return { success: false, error: "Error inesperado al enviar email" };
				}
			},

			setupPassword: async (token, password, name) => {
				try {
					const response = await fetch(`${backendUrl}/user/setup-password`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ token, password, name })
					});

					if (!response.ok) {
						const errorData = await response.json();
						return { success: false, error: errorData.error || "Error al establecer contraseña" };
					}

					const data = await response.json();
					return { success: true, data: data };
				} catch (error) {
					return { success: false, error: "Error inesperado" };
				}
			},

			// === ACCIONES PARA EL CATÁLOGO ===

			// Categorías
			fetchCategories: async () => {
				const store = getStore();
				setStore({ ...store, loading: true });

				try {
					const response = await fetch(`${backendUrl}/public/categories`);
					if (!response.ok) {
						throw new Error('Error al obtener categorías');
					}
					const categories = await response.json();
					setStore({ ...store, categories, loading: false });
					return { success: true, data: categories };
				} catch (error) {
					console.error("Error fetching categories:", error);
					setStore({ ...store, loading: false });
					return { success: false, error: error.message };
				}
			},

			// Productos
			fetchProducts: async () => {
				const store = getStore();
				setStore({ ...store, loading: true });

				try {
					const response = await fetch(`${backendUrl}/public/products`);
					if (!response.ok) {
						throw new Error('Error al obtener productos');
					}
					const products = await response.json();
					setStore({ ...store, products, loading: false });
					return { success: true, data: products };
				} catch (error) {
					console.error("Error fetching products:", error);
					setStore({ ...store, loading: false });
					return { success: false, error: error.message };
				}
			},

			// === ACCIONES DE CARRITO MEJORADAS ===
			// === SISTEMA DE TOAST (NewToast.jsx) ===
			showToast: (data, duration = 3000) => {
				const store = getStore();
				const newToast = {
					isVisible: true,
					message: data?.message || "",
					product: data?.product || null,
					actionLabel: data?.actionLabel || "",
				};

				console.log("🔥 [FLUX] showToast ->", newToast);
				setStore({ ...store, toast: newToast });

				// ⏳ Cierre después del tiempo configurado (con seguridad)
				clearTimeout(window.__toastTimer);
				window.__toastTimer = setTimeout(() => {
					getActions().hideToast();
				}, duration);
			},

			hideToast: () => {
				const store = getStore();
				const clearedToast = { isVisible: false, message: "", product: null, actionLabel: "" };
				console.log("🧯 [FLUX] hideToast ->", clearedToast);
				setStore({ ...store, toast: clearedToast });
			},

			// ✅ addToCart (compatible con NewToast)
			addToCart: (product, quantity = 1) => {
				const store = getStore();
				const actions = getActions();
				const currentCart = store.cart || [];
				const flavorKey = product.selectedFlavor || '';
				const sizeKey = product.selected_size_ml ?? product.volume_ml ?? null;

				let maxStock = product.stock || 0;
				if (product.selectedFlavor && Array.isArray(product.flavor_catalog)) {
					const f = product.flavor_catalog.find(fl => fl.name === product.selectedFlavor);
					if (f) maxStock = f.stock;
				}

				const idx = currentCart.findIndex(
					(item) =>
						item.id === product.id &&
						(item.selectedFlavor || '') === flavorKey &&
						(item.selected_size_ml ?? item.volume_ml ?? null) === sizeKey
				);

				let updatedCart;
				if (idx >= 0) {
					const currentQty = currentCart[idx].quantity;
					const newQty = Math.min(currentQty + quantity, maxStock);
					updatedCart = [...currentCart];
					updatedCart[idx] = { ...updatedCart[idx], quantity: newQty };
					console.log("🔁 [addToCart] Actualizó cantidad:", currentQty, "→", newQty);
				} else {
					updatedCart = [
						...currentCart,
						{
							...product,
							quantity: Math.min(quantity, maxStock),
							selectedFlavor: product.selectedFlavor || null,
							selected_size_ml: product.selected_size_ml ?? product.volume_ml ?? null
						}
					];
					console.log("🆕 [addToCart] Agregó producto nuevo:", product.name);
				}

				localStorage.setItem('cart', JSON.stringify(updatedCart));
				setStore({ ...store, cart: updatedCart }); // ✅ correcto


				console.log("💾 [addToCart] Carrito guardado. Total items:", updatedCart.length);

				// 👇 Dispara el nuevo toast (NewToast.jsx)
				const isWholesale = window.location.pathname.startsWith("/mayorista");

				const wholesalePrice = Number(product.price_wholesale);
				const retailPrice = Number(product.price);

				const displayPrice = isWholesale
					? (wholesalePrice > 0 ? wholesalePrice : null)
					: retailPrice;

				actions.showToast({
					message: "Producto agregado al carrito 🛒",
					actionLabel: "Ver carrito",
					product: {
						name: product.name,
						price: displayPrice,
						image: product.image_urls?.[0] || product.image_url || "/sin_imagen.jpg",
						volume_ml: product.selected_size_ml ?? product.volume_ml ?? null
					}
				});

			},


			removeFromCart: (productId, selectedFlavor = '', selectedSizeMl = null) => {
				const store = getStore();
				const cart = store.cart.filter(
					(item) =>
						!(
							item.id === productId &&
							(item.selectedFlavor || '') === (selectedFlavor || '') &&
							(item.selected_size_ml ?? item.volume_ml ?? null) === (selectedSizeMl ?? null)
						)
				);

				localStorage.setItem('cart', JSON.stringify(cart));
				setStore({ ...store, cart });   // ✅ usando store actual
			},

			resetCartAfterPayment: () => {
				console.log("🛒 [FLUX] resetCartAfterPayment ejecutado");

				// Limpia el store
				setStore({ cart: [] });

				// Limpia el localStorage
				localStorage.setItem("cart", JSON.stringify([]));

				// Opcional: vuelve a hidratar para asegurar consistencia
				getActions().hydrateCart?.();
			},




			updateCartQuantity: (productId, quantity, selectedFlavor = '', selectedSizeMl = null) => {
				const store = getStore();
				const cart = store.cart.map((item) =>
					item.id === productId &&
						(item.selectedFlavor || '') === (selectedFlavor || '') &&
						(item.selected_size_ml ?? item.volume_ml ?? null) === (selectedSizeMl ?? null)
						? { ...item, quantity }
						: item
				);

				localStorage.setItem('cart', JSON.stringify(cart));
				setStore({ ...store, cart });   // ✅ usando store actual
			},


			hydrateCart: () => {
				console.log("💧 [FLUX] hydrateCart LLAMADO");
				const local = localStorage.getItem("cart");

				if (local) {
					try {
						const parsed = JSON.parse(local);
						console.log("💧 [FLUX] Carrito parseado:", parsed.length, "items");
						const store = getStore();
						setStore({ ...store, cart: parsed });   // 👈 preserva el store
					} catch (err) {
						console.error("❌ [FLUX] Error parseando cart:", err);
						const store = getStore();
						setStore({ ...store, cart: [] });
					}
				} else {
					console.log("⚠️ [FLUX] No había carrito en localStorage → limpiando store");
					const store = getStore();
					setStore({ cart: parsed });

				}
			},
			clearCart: () => {
				console.log("🧹 [clearCart] INICIO");

				// 1) Vaciar en localStorage
				localStorage.setItem("cart", JSON.stringify([]));

				// 2) Vaciar en store directamente SIN usar spread
				setStore({ cart: [] });

				// 3) Confirmar log
				console.log("🧹 [clearCart] Final →", getStore().cart, localStorage.getItem("cart"));
			},





			// Usuario (funciones adicionales)
			logoutUser: () => {
				localStorage.removeItem("token");
				const store = getStore();
				setStore({ ...store, user: null });
			},

			// Órdenes
			createOrder: async (orderData) => {
				const store = getStore();
				setStore({ ...store, loading: true });

				try {
					const token = localStorage.getItem("token");
					const response = await fetch(`${backendUrl}/user/orders`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${token}`
						},
						body: JSON.stringify(orderData),
					});

					if (!response.ok) {
						const errorData = await response.json();
						throw new Error(errorData.error || 'Error al crear la orden');
					}

					const order = await response.json();
					const orders = [...store.orders, order];

					// 🔥 Limpia carrito después de compra exitosa
					setStore({
						...store,
						orders,
						loading: false,
						cart: []
					});

					return { success: true, data: order };
				} catch (error) {
					console.error("Error creating order:", error);
					setStore({ ...store, loading: false });
					return { success: false, error: error.message };
				}
			},

			fetchOrders: async () => {
				const store = getStore();
				setStore({ ...store, loading: true });

				try {
					const token = localStorage.getItem("token");
					const response = await fetch(`${backendUrl}/user/orders`, {
						headers: {
							"Authorization": `Bearer ${token}`
						}
					});

					if (!response.ok) {
						throw new Error('Error al obtener órdenes');
					}

					const orders = await response.json();
					setStore({ ...store, orders, loading: false });
					return { success: true, data: orders };
				} catch (error) {
					console.error("Error fetching orders:", error);
					setStore({ ...store, loading: false });
					return { success: false, error: error.message };
				}
			},

			addOrUpdateOrder: (order) => {
				const store = getStore();
				const idx = store.orders?.findIndex(o => String(o.id) === String(order.id)) ?? -1;
				let orders = Array.isArray(store.orders) ? [...store.orders] : [];
				if (idx >= 0) {
					orders[idx] = { ...orders[idx], ...order }; // actualiza o reemplaza
				} else {
					orders = [order, ...orders]; // agrega al principio
				}
				setStore({ ...store, orders });
			},


			// Forgot password
			forgotPassword: async (email) => {
				try {
					const response = await fetch(`${backendUrl}/user/forgot-password`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ email })
					});

					const data = await response.json();

					if (!response.ok) {
						return { success: false, error: data.error || "Error al enviar email de recuperación" };
					}

					return { success: true, message: data.message };
				} catch (error) {
					return { success: false, error: "Error inesperado al procesar solicitud" };
				}
			},

			// Reset password
			resetPassword: async (token, password) => {
				try {
					const response = await fetch(`${backendUrl}/user/reset-password`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ token, password })
					});

					const data = await response.json();

					if (!response.ok) {
						return { success: false, error: data.error || "Error al restablecer contraseña" };
					}

					return { success: true, message: data.message };
				} catch (error) {
					return { success: false, error: "Error inesperado al restablecer contraseña" };
				}
			},

			// Limpiar mensaje de estado
			clearUpdateStatusMsg: () => {
				const store = getStore();
				setStore({ ...store, updateStatusMsg: "" });
			},

		}
	};
};

export default getState;
