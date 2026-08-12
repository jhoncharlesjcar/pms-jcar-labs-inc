# 📋 PLAN DE PROYECTO SCRUM: PMS JCAR LABS V5 "EL DESTRUCTOR DE CLOUDBEDS"

**Product Owner:** JCAR LABS  
**Equipo de Desarrollo:** 1 Tech Lead, 2 Backend, 2 Frontend, 1 QA, 1 UX/UI Designer  
**Ciclo:** Sprints de 2 semanas (12 sprints = 6 meses para versión 1.0 completa)  
**Entorno:** Desarrollo en ramas `feature/*`, integración en `develop`, despliegue en `staging` y `production`.

---

## 🎯 VISIÓN DEL PRODUCTO
> "El sistema de gestión hotelera más intuitivo, potente y adaptado al mercado peruano, que combina lo mejor de Cloudbeds con funcionalidades únicas (escaneo de DNI, pagos duales, facturación SUNAT nativa y operación sin internet) para que cualquier hotelero, sin importar su nivel tecnológico, pueda operar su negocio con la misma eficiencia de una cadena global."

---

## 🗺️ HOJA DE RUTA DE SPRINTS (BACKLOG DE LANZAMIENTO)

### 🏗️ SPRINT 0: PREPARACIÓN Y AJUSTE DE LA BASE (1 semana)
| Historia | Descripción |
| :--- | :--- |
| **HU-00.1** | Revisar y optimizar la infraestructura actual (Supabase, Vercel, Edge Functions). |
| **HU-00.2** | Actualizar dependencias (React, Tailwind, shadcn/ui). |
| **HU-00.3** | Crear el backlog completo. |
| **HU-00.4** | Configurar entornos de staging y producción. |

### 🚀 SPRINT 1: "EL CEREBRO PERUANO" (PMS Core + Hardware) - ✅ COMPLETADO
| Historia | Descripción |
| :--- | :--- |
| **HU-01** | Dashboard del Día |
| **HU-02** | Calendario Interactivo |
| **HU-03** | Registro de Huéspedes Rápido (OCR DNI) |
| **HU-04** | Autocompletado Inteligente (Fuzzy Search) |
| **HU-05** | Offline-First |

### 💰 SPRINT 2: "EL SWITCH DE ORO" (Pagos Duales + SUNAT) - ✅ COMPLETADO
| Historia | Descripción |
| :--- | :--- |
| **HU-06** | Configuración de Pagos (Switch Dual) |
| **HU-07** | Modo Manual (QR estático) |
| **HU-08** | Modo Automático (API Keys) |
| **HU-09** | QR dinámico por transacción |
| **HU-10** | Webhooks de confirmación automática |
| **HU-11** | Facturación SUNAT (Boleta/Factura) |
| **HU-12** | Cierre de Caja con validación CDR |

### 📡 SPRINT 3: "LA CONQUISTA DE LA DISTRIBUCIÓN" (Channel Manager - Fase 1) - ⏳ PRÓXIMO
| Historia | Descripción |
| :--- | :--- |
| **HU-13** | Conexión con Booking.com (XML o API) |
| **HU-14** | Conexión con Despegar (API) |
| **HU-15** | Control de inventario centralizado |
| **HU-16** | Reglas de yield básicas (Dynamic Pricing) |

### 💻 SPRINT 4: "LA TIENDA PROPIA" (Booking Engine)
| Historia | Descripción |
| :--- | :--- |
| **HU-17** | Widget de reservas embebible |
| **HU-18** | Motor de reservas responsive |
| **HU-19** | Upselling de complementos |
| **HU-20** | Sincronización de tarifas en tiempo real |
| **HU-21** | Sin comisiones para el hotelero |

### 📊 SPRINT 5: "EL CEREBRO FINANCIERO" (Revenue Intelligence + BI - Fase 1)
| Historia | Descripción |
| :--- | :--- |
| **HU-22** | Forecasting básico de ocupación (SARIMA) |
| **HU-23** | Recomendaciones de precio dinámico |
| **HU-24** | Dashboards de rendimiento (KPI) |
| **HU-25** | Exportación de reportes |
| **HU-26** | Informes multi-propiedad |

### 📧 SPRINT 6: "EL MARKETING QUE CONVIERTE" (Guest Marketing CRM)
| Historia | Descripción |
| :--- | :--- |
| **HU-27** | Segmentación de huéspedes |
| **HU-28** | Campañas de email automatizadas |
| **HU-29** | Plantillas de email personalizables |
| **HU-30** | Integración con WhatsApp |
| **HU-31** | Deduplicación de contactos |

### 💬 SPRINT 7: "LA EXPERIENCIA DEL HUÉSPED" (Guest Experience)
| Historia | Descripción |
| :--- | :--- |
| **HU-32** | Check-in digital para huéspedes |
| **HU-33** | Portal del huésped |
| **HU-34** | Mensajería unificada |
| **HU-35** | Traducción automática de mensajes |

### 🔌 SPRINT 8: "EL ECOSISTEMA" (API Pública + Marketplace - Fase 1)
| Historia | Descripción |
| :--- | :--- |
| **HU-36** | API Pública (OpenAPI 3.0) |
| **HU-37** | Autenticación OAuth2 para integradores |
| **HU-38** | Marketplace básico |
| **HU-39** | Webhooks de eventos |

### 🧹 SPRINT 9: "EL TOQUE FINAL" (Housekeeping Avanzado, Spaces, Mejoras UX)
| Historia | Descripción |
| :--- | :--- |
| **HU-40** | Housekeeping Avanzado |
| **HU-41** | Spaces (Espacios adicionales) |
| **HU-42** | Gestión de productos y servicios |
| **HU-43** | Mejoras de UX para cero capacitación |

### 🧪 SPRINT 10: "PILOTO Y AJUSTES" (Pruebas en Hoteles Reales)
| Historia | Descripción |
| :--- | :--- |
| **HU-44** | Instalación en 3 hoteles piloto |
| **HU-45** | Monitoreo de rendimiento y logs |
| **HU-46** | Corrección de bugs críticos |
| **HU-47** | Ajustes de UX basados en feedback |

### 🚀 SPRINT 11: "LANZAMIENTO OFICIAL"
| Historia | Descripción |
| :--- | :--- |
| **HU-48** | Despliegue en producción |
| **HU-49** | Documentación de usuario |
| **HU-50** | Estrategia de marketing y ventas |
| **HU-51** | Soporte post-lanzamiento |
