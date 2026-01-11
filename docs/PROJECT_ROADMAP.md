# 🚀 Antigravity Omni-Quota - Master Roadmap & Project Tracker

Este documento es la fuente de verdad sobre el estado actual del proyecto, los hitos alcanzados y la visión a futuro. Sirve tanto para el equipo actual como para nuevos desarrolladores que se unan al proyecto.

## 📌 Estado Actual del Proyecto
- **Versión Actual**: `v1.0.6` (Estable)
- **Plataformas Soportadas**: Windows (Nativo), macOS/Linux (Base lógica lista en `v1.1.0-dev`).
- **Objetivo Principal**: Ser la herramienta de monitoreo de cuotas definitiva para el ecosistema Antigravity (Google fork of VS Code).

---

## 🛠 Historial de Logros (Checks ✅)

### Core & Estabilidad
- [x] **Zero-Config Discovery**: Detección automática del puerto y token CSRF sin intervención del usuario.
- [x] **Bundling Profesional**: Empaquetado con `esbuild` para eliminar errores de dependencias (`axios`).
- [x] **Polling Optimizado**: Frecuencia de escaneo aumentada (15s) y actualización de timers cada 10s.

### UI/UX (Premium Feel)
- [x] **Multi-Account Hub**: Gestión de múltiples cuentas de Antigravity en la barra lateral.
- [x] **Rich Tooltips**: Dashboard multi-línea (hasta 8 modelos) al pasar el cursor por la barra de estado.
- [x] **Health Colors**: Código de colores dinámico (Verde/Amarillo/Naranja/Rojo) e iconos semánticos.
- [x] **Ready State Fix**: Representación visual correcta (100% y check) cuando un modelo se restablece.

---

## 📅 Roadmap a Corto / Mediano / Largo Plazo

### 🟢 Corto Plazo: v1.1.0 - "The Universal Bridge" (En Progreso)
*Meta: Compatibilidad total y seguridad de datos.*
- [x] **Soporte Universal (macOS/Linux)**: Finalizar la implementación de `ps` y `lsof`.
- [x] **Security+ (SecretStorage)**: Migrar los tokens CSRF y de sesión al llavero seguro de VS Code.
- [x] **Simulacros de Vuelo**: Sistema interno de Mocking para testear sistemas Unix desde Windows.
- [x] **Diagnósticos Proactivos**: Detección de herramientas faltantes (lsof) en macOS/Linux con guía de reparación.
- [ ] **Detección WSL**: Soporte explícito para Windows Subsystem for Linux.

### 🟡 Mediano Plazo: v1.2.0 - "Guardian & Analytics"
*Meta: Dar valor agregado que no ofrece la herramienta oficial.*
- [ ] **Historial Local**: Almacenamiento persistente del consumo diario para ver estadísticas.
- [ ] **Gráficas de Uso**: Panel (Webview) con visualización de tokens gastados por sesión.
- [ ] **Predictor de Agotamiento**: Algoritmo que estime cuándo se agotará la cuota basándose en el ritmo actual del usuario.
- [ ] **Alertas de Umbral**: Notificaciones emergentes cuando un modelo baje del 10% de forma crítica.

### 🔴 Largo Plazo: v2.0.0 - "The Ecosystem Lead"
*Meta: Integración y profesionalización.*
- [ ] **Modo "Ahorro de Tokens"**: Sugerencias automáticas para cambiar entre Pro y Flash si la cuota es baja.
- [ ] **Notificaciones Externas**: Integración con notificaciones nativas del SO o Webhooks (Slack/Discord) para avisos fuera del IDE.
- [ ] **Soporte Corporativo**: Gestión avanzada para usuarios con múltiples organizaciones o cuentas empresariales de Google Cloud.

---

## 👩‍💻 Notas para Desarrolladores

### Dificultades Detectadas
- **Variabilidad de Terminales**: Windows PowerShell v.s. Unix Bash requiere un manejo cuidadoso de escapes de caracteres y parsing de strings.
- **Bootstrapping de tiempos**: Al recuperar cuentas del "Cold Storage" (`globalState`), los tiempos relativos pueden ser inconsistentes si no se recalcula el timestamp inmediatamente.

### Recomendaciones de Testeo
- Usar el archivo `src/testUnixParsing.ts` para validar cambios en el motor de detección sin necesidad de cambiar de sistema operativo.
- VS Code `Extension Development Host` (F5) para pruebas visuales en caliente.

---
*Última actualización: 10 de enero de 2026*
