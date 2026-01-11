# 🚀 Antigravity Omni-Quota - Master Roadmap & Project Tracker

Este documento es la fuente de verdad sobre el estado actual del proyecto, los hitos alcanzados y la visión a futuro. Sirve tanto para el equipo actual como para nuevos desarrolladores que se unan al proyecto.

## 📌 Estado Actual del Proyecto
- **Versión Actual**: `v1.1.0` (Universal & Secure)
- **Plataformas Soportadas**: Windows (Nativo), macOS (Nativo), Linux/WSL (Nativo).
- **Objetivo Principal**: Ser la herramienta de monitoreo de cuotas definitiva para el ecosistema Antigravity (Google fork of VS Code), ofreciendo transparencia y seguridad que la herramienta oficial no proporciona.

---

## 🛠 Historial de Logros (Checks ✅)

### Core & Estabilidad
- [x] **Zero-Config Discovery**: Detección automática del puerto y token CSRF sin intervención del usuario.
- [x] **Universal Bridge**: Motor de detección híbrido (PowerShell + Unix `ps`/`lsof`).
- [x] **Security Engine**: Cifrado de tokens sensibles mediante el `SecretStorage` de VS Code.
- [x] **Bundling Profesional**: Empaquetado con `esbuild` para eliminar errores de dependencias.
- [x] **Polling Optimizado**: Frecuencia de escaneo aumentada (15s) y actualización de timers cada 10s.

### UI/UX (Premium Feel)
- [x] **Multi-Account Hub**: Gestión de múltiples cuentas de Antigravity en la barra lateral.
- [x] **Rich Tooltips**: Dashboard multi-línea (hasta 8 modelos) en la Status Bar.
- [x] **Health Colors**: Código de colores dinámico (Verde/Amarillo/Naranja/Rojo).
- [x] **Ready State Fix**: Corrección visual del estado de restablecimiento (100% + check).
- [x] **Proactive Diagnostics**: Aviso al usuario sobre herramientas faltantes en sistemas Unix.

---

## 📅 Roadmap a Corto / Mediano / Largo Plazo

### 🟢 Fase 1: v1.1.0 - "The Universal Bridge" (COMPLETADA ✅)
*Meta: Compatibilidad total y seguridad de datos.*
- [x] **Soporte macOS/Linux**: Implementación de comandos nativos de Unix.
- [x] **SecretStorage Integration**: Tokens bajo llave en el keychain del sistema.
- [x] **Simulacros de Vuelo**: Sistema de mocking para testeo multiplataforma desde Windows.
- [x] **Compatibilidad WSL**: Soporte verificado para Windows Subsystem for Linux.

### 🟡 Fase 2: v1.2.0 - "Guardian & Analytics" (EN PROGRESO 🛠)
*Meta: Dar valor agregado mediante el análisis de datos.*
- [x] **History Engine**: Registro inteligente de snapshots de uso (cambio de % o >1 hora).
- [ ] **Dashboard Webview**: Panel visual con gráficas de consumo histórico por modelo/cuenta.
- [ ] **Predictor de Agotamiento**: Algoritmo que estime el tiempo restante antes de agotar la cuota basándose en el ritmo de prompts del usuario.
- [ ] **Alertas de Umbral**: Notificaciones de sistema (toast) al llegar a niveles críticos (ej. < 10%).

### 🔴 Fase 3: v2.0.0 - "The Ecosystem Lead"
*Meta: Integración proactiva y automatización.*
- [ ] **Modo "Ahorro de Tokens"**: Sugerencias proactivas de cambio de modelo (Gemini Pro -> Flash) si la cuota es baja.
- [ ] **Notificaciones Externas**: Webhooks para Slack/Discord informando el estado de cuota del equipo.
- [ ] **Gestión de Organizaciones**: Soporte mejorado para cuentas de Google Cloud Enterprise.

---

## 👩‍💻 Notas para Desarrolladores

### Arquitectura de Datos Sensitive
- Nunca guardar tokens CSRF en `globalState`. Usar siempre `accountManager.setAccountSecret(id, 'csrf', value)`.
- El ID de cuenta se compone de `installationId` + `email` para garantizar unicidad multiplataforma.

### History Manager
- Los snapshots se guardan en `globalState` bajo la clave `antigravity_usage_history`.
- Existe un límite de 500 puntos para evitar degradación de performance.
- La lógica de grabado es reactiva: solo captura datos si hay cambios reales en el porcentaje.

### Recomendaciones de Testeo
- **Unix Test**: Correr `Test Unix Parser (Mock)` desde el menú de debug (F5) para validar la regex de Mac/Linux.
- **Limpieza**: El comando `antigravity-quota.clearAccounts` también limpia el historial local.

---
*Última actualización: 10 de enero de 2026*
