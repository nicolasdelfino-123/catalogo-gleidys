import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { withWholesale } from '../utils/navigation.js'
import { PERFUME_CATEGORY_TREE as FOOTER_CATEGORIES } from '../utils/perfumeCategories.js'

import { storeConfig } from "../config/storeConfig";

const logofooter = `/${storeConfig.media.footerLogo}`;
const mobileLogoFooter = "/psi.png";

const phone = storeConfig.contact.whatsapp;
const message = encodeURIComponent(storeConfig.contact.whatsappMessage);
const link = `https://wa.me/${phone}?text=${message}`;
const footerTheme = storeConfig.features?.footerTheme === "white" ? "white" : "black";
const footerBackgroundColor =
    storeConfig.appearance?.footer?.colors?.[footerTheme] || (footerTheme === "white" ? "#ffffff" : "#0b0b0d");
const isWhiteFooter = footerTheme === "white";
const footerTextClass = isWhiteFooter ? "text-gray-800" : "text-gray-300";
const footerMutedClass = isWhiteFooter ? "text-gray-600" : "text-gray-400";
const footerHeadingClass = isWhiteFooter ? "text-gray-950" : "text-gray-200";
const footerLinkClass = isWhiteFooter
    ? "relative hover:text-gray-950 transition-all duration-300 after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-gray-950 after:transition-all after:duration-300 hover:after:w-full"
    : "relative hover:text-amber-300 transition-all duration-300 after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-amber-400 after:transition-all after:duration-300 hover:after:w-full";
const footerBorderClass = isWhiteFooter ? "border-gray-200" : "border-yellow-600/20";
const footerDeveloperLinkClass = isWhiteFooter ? "hover:text-gray-950" : "hover:text-white";

const Footer = () => {
    const navigate = useNavigate();
    return (
        <div>
            <footer className={`${footerTextClass} py-12 font-serif`} style={{ backgroundColor: footerBackgroundColor }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center md:text-left">
                        <div className="flex flex-col items-center">
                            <img
                                src={mobileLogoFooter}
                                alt="Shatha"
                                className="block md:hidden h-[100px] w-[250px] mt-4 mb-8 opacity-95 object-contain"
                            />
                            <img
                                src={logofooter}
                                alt="Shatha"
                                className="hidden md:block md:h-[260px] md:w-[260px] md:mt-[-45px] md:mb-[10px] opacity-95 object-contain"
                            />

                            <p className={`${footerMutedClass} text-sm max-w-xs -mt-5 text-center`}>
                                {storeConfig.branding.footerText}
                            </p>
                        </div>


                        {/* 🟢 Productos */}
                        <div>
                            <h4 className={`font-semibold mb-4 uppercase tracking-wider text-sm ${footerHeadingClass}`}>Productos</h4>
                            <ul className={`space-y-2 ${footerMutedClass}`}>
                                {FOOTER_CATEGORIES.map((c) => (
                                    <li key={c.slug}>
                                        <Link
                                            to={withWholesale(`/categoria/${c.slug}`)}
                                            state={{ fromFooter: true }}     // 👈 Marca que viene desde el footer
                                            className={footerLinkClass}
                                        >
                                            {c.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* <div>
                            <h4 className="font-semibold mb-4 uppercase tracking-wider text-sm text-gray-200">Información</h4>
                            <ul className="space-y-2 text-gray-400">
                                <li>
                                    <Link
                                        to={withWholesale("/aviso-legal")}

                                        className="relative hover:text-amber-300 transition-all duration-300 after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-amber-400 after:transition-all after:duration-300 hover:after:w-full"
                                    >
                                        Aviso Legal
                                    </Link>
                                </li>
                                <li>
                                    <Link to={withWholesale("/envios")}
                                        className="relative hover:text-amber-300 transition-all duration-300 after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-amber-400 after:transition-all after:duration-300 hover:after:w-full">
                                        Envíos
                                    </Link>
                                </li>
                                <li>
                                    <Link to={withWholesale("/devoluciones")}
                                        className="relative hover:text-amber-300 transition-all duration-300 after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-amber-400 after:transition-all after:duration-300 hover:after:w-full">
                                        Devoluciones
                                    </Link>
                                </li>

                            </ul>
                        </div>
 */}
                        <div>
                            <h4 className={`font-semibold mb-4 uppercase tracking-wider text-sm ${footerHeadingClass}`}>Contacto</h4>
                            <ul className={`space-y-2 ${footerTextClass}`}>
                                <li>
                                    <a
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={footerLinkClass}
                                    >
                                        WhatsApp: {storeConfig.contact.whatsappDisplay}
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href={`mailto:${storeConfig.contact.email}`}
                                        className={footerLinkClass}
                                    >
                                        {storeConfig.contact.emailDisplay}
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href={storeConfig.contact.instagram}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={footerLinkClass}
                                    >
                                        Instagram: {storeConfig.contact.instagramDisplay}
                                    </a>
                                </li>
                            </ul>
                        </div>

                    </div>

                    <div className={`border-t ${footerBorderClass} mt-8 pt-8 text-center ${footerMutedClass} text-xs`}>
                        <p>
                            Copyright © <span
                                onDoubleClick={() => {
                                    navigate("/admin/login");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="cursor-default select-none"
                            >
                                2026
                            </span> | {storeConfig.footer.copyrightName} | Sitio web desarrollado por{" "}
                            <a
                                href="https://wa.me/5493534793366?text=Hola%2C%20vi%20tu%20web%20y%20quiero%20consultarte%20por%20un%20catálogo%20para%20mi%20negocio"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${footerDeveloperLinkClass} transition-colors font-medium`}
                            >
                                {storeConfig.footer.developerName}
                            </a>.
                        </p>
                    </div>

                </div>
            </footer>
        </div>
    )
}

export default Footer
