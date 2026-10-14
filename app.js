/**
 * U.E. FE Y ALEGRÍA "NUEVA AMÉRICA" - SISTEMA DE PREINSCRIPCIÓN PRIMARIA
 * Arquitectura Institucional de Producción:
 * - Segregación Estricta de Permisos (Representante vs Docente)
 * - Navegación Móvil Continua con Menú Hamburguesa Nativo
 * - Asistente Guiado por Tres Bloques Lógicos con Barra de Progreso Superior
 * - Autoguardado en Segundo Plano (localStorage)
 * - Máscaras de Validación para Teléfonos (0414, 0424, 0412, 0416, 0426) y Cédulas (V, E, CE)
 * - Búsqueda en Tiempo Real y Exportación a Excel/CSV con BOM UTF-8
 * - Solución Definitiva de Impresión en 1 Hoja Carta (DOM-to-PDF y CSS Paged Media)
 * 
 * Periodo Escolar: 2026 - 2027 | Nivel: Educación Primaria (1° a 6° Grado)
 * Municipio San Francisco, Estado Zulia
 */

const AppState = {
    bloqueActual: 1,
    pasoActual: 1, // Retrocompatibilidad
    rol: null,     // 'representante' | 'docente'
    docenteAutenticado: false,
    registros: JSON.parse(localStorage.getItem('fya_preinscripciones_db') || 'null'),
    contadorCorrelativo: 5,
    tema: localStorage.getItem('fya_theme') || 'light',
    archivosCargados: {},
    filtroGradoActivo: '',
    autoSaveTimer: null,
    flujoImpresionPendiente: false,
    cloudStorageType: 'online',
    isSyncing: false
};

document.addEventListener('DOMContentLoaded', async () => {
    determinarRolInicial();
    initTheme();
    initMobileSidebar();
    initSistemaRoles();

    // 1. Cargar y sincronizar datos directamente desde la Nube (Railway)
    await cargarRegistrosDesdeNube(true);

    actualizarResumenGrado();
    actualizarBadges();
    initMascarasValidacion();
    initWizardBloques();
    initAutoguardado();
    initUploadRecaudos();
    initBusquedaTiempoReal();
    initExportarExcel();
    initEventListeners();
    actualizarEstadoBotonImprimir();
    actualizarTimestampEmision();
    window.addEventListener('beforeprint', actualizarTimestampEmision);

    // 2. Iniciar sincronización periódica en segundo plano para trabajo en equipo
    iniciarSincronizacionAutomatica();
});

/* ==============================================================================
   SINCRONIZACIÓN Y GESTIÓN EN LA NUBE (RAILWAY / CLOUD DATABASE)
   ============================================================================== */
function actualizarIndicadorNube(estado, texto) {
    const badge = document.getElementById('cloudStatusBadge');
    const icon = document.getElementById('cloudStatusIcon');
    const text = document.getElementById('cloudStatusText');
    if (!badge || !text) return;

    badge.className = 'cloud-status-pill ' + estado;
    if (estado === 'online') {
        if (icon) icon.className = 'fa-solid fa-cloud';
        text.textContent = texto || 'Nube Conectada';
        badge.title = 'Conectado y sincronizado con la nube de Railway';
    } else if (estado === 'syncing') {
        if (icon) icon.className = 'fa-solid fa-arrows-rotate fa-spin';
        text.textContent = texto || 'Sincronizando...';
        badge.title = 'Sincronizando datos con la nube de Railway...';
    } else if (estado === 'offline') {
        if (icon) icon.className = 'fa-solid fa-cloud-slash';
        text.textContent = texto || 'Modo Local';
        badge.title = 'Sin conexión con la nube. Guardando de forma local.';
    }
}

window.cargarRegistrosDesdeNube = async function(silencioso = false) {
    if (AppState.isSyncing) return false;
    AppState.isSyncing = true;
    try {
        if (!silencioso) {
            const syncIcon = document.getElementById('iconSyncNube');
            if (syncIcon) syncIcon.classList.add('fa-spin');
        }
        actualizarIndicadorNube('syncing');

        const res = await fetch('/api/preinscripciones');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            AppState.registros = json.data;
            // Persistir copia local en caché del navegador
            localStorage.setItem('fya_preinscripciones_db', JSON.stringify(AppState.registros));
            AppState.cloudStorageType = json.storage || 'online';

            recalcularCorrelativo();
            actualizarBadges();
            actualizarKpisDocente();
            filtrarYRenderizarPanelDocente();
            filtrarYRenderizarHistorial();

            actualizarIndicadorNube('online', json.storageLabel || 'Nube Conectada');
            if (!silencioso) {
                mostrarToast('Sincronización Exitosa', `Se han cargado ${json.data.length} expedientes desde la nube.`, 'success');
            }
            return true;
        }
        throw new Error('Respuesta no válida');
    } catch (err) {
        console.warn('[Cloud Sync Warning]', err.message);
        actualizarIndicadorNube('offline', 'Modo Local');
        if (!AppState.registros) {
            AppState.registros = JSON.parse(localStorage.getItem('fya_preinscripciones_db') || 'null');
            if (!AppState.registros) cargarRegistroSemillaSiVacio();
        }
        recalcularCorrelativo();
        actualizarBadges();
        actualizarKpisDocente();
        filtrarYRenderizarPanelDocente();
        if (!silencioso) {
            mostrarToast('Conexión Local', 'No se pudo contactar con la nube; usando datos en caché local.', 'warning');
        }
        return false;
    } finally {
        AppState.isSyncing = false;
        const syncIcon = document.getElementById('iconSyncNube');
        if (syncIcon) syncIcon.classList.remove('fa-spin');
    }
};

function recalcularCorrelativo() {
    let maxNum = 0;
    (AppState.registros || []).forEach(r => {
        if (r && r.codigo) {
            const m = r.codigo.match(/PRE-\d{4}-(\d+)/);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n > maxNum) maxNum = n;
            }
        }
    });
    AppState.contadorCorrelativo = maxNum + 1;
    const codInp = document.getElementById('inputCodigoPre');
    if (codInp) {
        codInp.value = `PRE-2026-${String(AppState.contadorCorrelativo).padStart(4, '0')}`;
    }
}

function iniciarSincronizacionAutomatica() {
    // Sincronizar automáticamente al enfocar la pestaña
    window.addEventListener('focus', () => {
        cargarRegistrosDesdeNube(true);
    });

    // Sondeo periódico cada 15 segundos en segundo plano si la pestaña está activa
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            cargarRegistrosDesdeNube(true);
        }
    }, 15000);
}

/* ==============================================================================
   1. DETERMINACIÓN DE ROL Y SEGREGACIÓN RIGUROSA DE PERMISOS
   ============================================================================== */
function determinarRolInicial() {
    const urlParams = new URLSearchParams(window.location.search);
    const rolParam = urlParams.get('rol');

    if (rolParam === 'docente') {
        const auth = localStorage.getItem('fya_docente_auth') === 'true';
        if (auth) {
            AppState.rol = 'docente';
            AppState.docenteAutenticado = true;
        } else {
            // Si intenta entrar como docente sin clave, redirigir a docente-login.html
            window.location.href = 'docente-login.html';
            return;
        }
    } else if (rolParam === 'representante') {
        AppState.rol = 'representante';
        AppState.docenteAutenticado = false;
        localStorage.setItem('fya_rol', 'representante');
        localStorage.setItem('fya_docente_auth', 'false');
    } else {
        // Por defecto: Modo Representante sin registros previos ni contraseñas
        const savedRol = localStorage.getItem('fya_rol');
        const savedAuth = localStorage.getItem('fya_docente_auth') === 'true';
        if (savedRol === 'docente' && savedAuth) {
            AppState.rol = 'docente';
            AppState.docenteAutenticado = true;
        } else {
            AppState.rol = 'representante';
            AppState.docenteAutenticado = false;
            localStorage.setItem('fya_rol', 'representante');
            localStorage.setItem('fya_docente_auth', 'false');
        }
    }
}

function initSistemaRoles() {
    aplicarModoPerfil(AppState.rol);
}

function aplicarModoPerfil(rol) {
    const body = document.body;
    const badgeText = document.getElementById('roleBadgeText');
    const badgeIcon = document.getElementById('roleBadgeIcon');
    const panelDocente = document.getElementById('panelDocenteContainer');
    const preContainerForm = document.getElementById('preContainerForm');
    const bannerDocenteForm = document.getElementById('bannerModoDocenteEnForm');
    const adminAuditoriaSection = document.getElementById('adminAuditoriaSection');
    const docenteSidebarSection = document.getElementById('docenteSidebarSection');
    const btnVerHistorial = document.getElementById('btnVerHistorial');
    const btnVerPanelDocente = document.getElementById('btnVerPanelDocente');

    // Retiro definitivo de botones 'Cambiar Perfil' y 'Ver SQL'
    document.querySelectorAll('#btnCambiarRolModal, #btnVerSqlModal').forEach(el => el.remove());

    if (rol === 'docente' && AppState.docenteAutenticado) {
        body.classList.remove('mode-representante');
        body.classList.add('mode-docente');

        if (badgeText) badgeText.textContent = 'Perfil: Docente / Admin';
        if (badgeIcon) badgeIcon.className = 'fa-solid fa-chalkboard-user';
        const sBadgeText = document.getElementById('sidebarRoleBadgeText');
        const sBadgeIcon = document.getElementById('sidebarRoleBadgeIcon');
        const sRolePill = document.getElementById('sidebarRoleBadgePill');
        const nRolePill = document.getElementById('roleBadgeIndicator');
        if (sBadgeText) sBadgeText.textContent = 'Perfil: Docente / Admin';
        if (sBadgeIcon) sBadgeIcon.className = 'fa-solid fa-chalkboard-user';
        if (sRolePill) { sRolePill.classList.remove('repre-active'); sRolePill.classList.add('docente-active'); }
        if (nRolePill) { nRolePill.classList.remove('repre-active'); nRolePill.classList.add('docente-active'); }

        // Mostrar herramientas de Docente
        if (docenteSidebarSection) docenteSidebarSection.style.display = 'flex';
        if (btnVerHistorial) btnVerHistorial.style.display = 'inline-flex';
        if (btnVerPanelDocente) btnVerPanelDocente.style.display = 'inline-flex';
        if (adminAuditoriaSection) adminAuditoriaSection.style.display = 'grid';

        mostrarPanelDocente();
    } else {
        // MODO REPRESENTANTE: Segregación Estricta
        body.classList.remove('mode-docente');
        body.classList.add('mode-representante');

        if (badgeText) badgeText.textContent = 'Perfil: Representante';
        if (badgeIcon) badgeIcon.className = 'fa-solid fa-user-check';
        const sBadgeTextR = document.getElementById('sidebarRoleBadgeText');
        const sBadgeIconR = document.getElementById('sidebarRoleBadgeIcon');
        const sRolePillR = document.getElementById('sidebarRoleBadgePill');
        const nRolePillR = document.getElementById('roleBadgeIndicator');
        if (sBadgeTextR) sBadgeTextR.textContent = 'Perfil: Representante';
        if (sBadgeIconR) sBadgeIconR.className = 'fa-solid fa-user-check';
        if (sRolePillR) { sRolePillR.classList.remove('docente-active'); sRolePillR.classList.add('repre-active'); }
        if (nRolePillR) { nRolePillR.classList.remove('docente-active'); nRolePillR.classList.add('repre-active'); }

        // OCULTAR TOTALMENTE DEL DOM CON 'display: none !important;' herramientas de docente y contador
        if (docenteSidebarSection) {
            docenteSidebarSection.style.setProperty('display', 'none', 'important');
        }
        const linkVerPlanillas = document.getElementById('sidebarLinkVerPlanillas');
        if (linkVerPlanillas) linkVerPlanillas.style.setProperty('display', 'none', 'important');
        const badgeContador = document.getElementById('totalRegistrosBadge');
        if (badgeContador) badgeContador.style.setProperty('display', 'none', 'important');
        if (btnVerHistorial) btnVerHistorial.style.setProperty('display', 'none', 'important');
        if (btnVerPanelDocente) btnVerPanelDocente.style.setProperty('display', 'none', 'important');

        // Ocultar por completo del DOM con 'display: none !important;' la sección de auditoría docente para el representante
        if (adminAuditoriaSection) {
            adminAuditoriaSection.style.setProperty('display', 'none', 'important');
            adminAuditoriaSection.querySelectorAll('select, textarea, input').forEach(el => {
                el.disabled = true;
                el.required = false;
            });
        }
        document.querySelectorAll('.admin-only-section').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
        if (bannerDocenteForm) bannerDocenteForm.style.setProperty('display', 'none', 'important');

        // Eliminar de la barra superior (navbar) los botones repetidos de navegación ("Inicio", "Panel Docente", "Ver Planillas", "Salir")
        const topNav = document.getElementById('preinscripcionNavbar');
        if (topNav) {
            topNav.querySelectorAll('a, button').forEach(el => {
                const txt = (el.textContent || '').trim().toLowerCase();
                if (txt.includes('inicio') || txt.includes('panel docente') || txt.includes('ver planillas') || txt.includes('salir')) {
                    el.remove();
                }
            });
        }

        // Asegurar que el representante vea el formulario directamente
        if (panelDocente) {
            panelDocente.classList.remove('active');
            panelDocente.style.display = 'none';
        }
        if (preContainerForm) preContainerForm.style.display = 'block';
    }

    actualizarBadges();
}

function mostrarPanelDocente() {
    if (!AppState.docenteAutenticado) {
        window.location.href = 'docente-login.html';
        return;
    }
    const panelDocente = document.getElementById('panelDocenteContainer');
    const preContainerForm = document.getElementById('preContainerForm');
    if (panelDocente) {
        panelDocente.style.display = 'block';
        panelDocente.classList.add('active');
    }
    if (preContainerForm) preContainerForm.style.display = 'none';

    renderizarPanelDocente();
    cerrarMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mostrarFormularioEnModoDocente() {
    const panelDocente = document.getElementById('panelDocenteContainer');
    const preContainerForm = document.getElementById('preContainerForm');
    const bannerDocenteForm = document.getElementById('bannerModoDocenteEnForm');
    const adminAuditoriaSection = document.getElementById('adminAuditoriaSection');

    if (panelDocente) {
        panelDocente.style.display = 'none';
        panelDocente.classList.remove('active');
    }
    if (preContainerForm) preContainerForm.style.display = 'block';
    if (bannerDocenteForm) bannerDocenteForm.style.display = 'flex';
    if (adminAuditoriaSection) adminAuditoriaSection.style.display = 'grid';

    irAlPaso(1);
    cerrarMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cerrarSesionDocente() {
    localStorage.setItem('fya_rol', 'representante');
    localStorage.setItem('fya_docente_auth', 'false');
    window.location.href = 'index.html';
}

function salirRepresentante() {
    localStorage.removeItem('fya_preinscripcion_draft');
    window.location.href = 'index.html';
}

/* ==============================================================================
   2. NAVEGACIÓN MÓVIL CONTINUA (MENÚ HAMBURGUESA NATIVO)
   ============================================================================== */
function initMobileSidebar() {
    const btnHamburguesa = document.getElementById('btnMobileHamburger');
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const btnClose = document.getElementById('btnSidebarClose');
    const btnSalir = document.getElementById('sidebarBtnSalir');

    if (btnHamburguesa && sidebar) {
        btnHamburguesa.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-open');
            if (backdrop) backdrop.classList.toggle('active');
        });
    }

    if (btnClose && sidebar) {
        btnClose.addEventListener('click', cerrarMobileSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', cerrarMobileSidebar);
    }

    // Botón Salir en Sidebar
    if (btnSalir) {
        btnSalir.addEventListener('click', () => {
            if (AppState.rol === 'docente') {
                cerrarSesionDocente();
            } else {
                salirRepresentante();
            }
        });
    }

    // Cerrar sidebar al hacer clic en enlaces en mobile
    document.querySelectorAll('.sidebar-menu-item').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 992) {
                cerrarMobileSidebar();
            }
        });
    });
}

function cerrarMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.remove('active');
}

window.mostrarFormularioDesdeSidebar = function() {
    const panelDocente = document.getElementById('panelDocenteContainer');
    const preContainerForm = document.getElementById('preContainerForm');
    if (panelDocente) {
        panelDocente.style.display = 'none';
        panelDocente.classList.remove('active');
    }
    if (preContainerForm) preContainerForm.style.display = 'block';

    document.querySelectorAll('.sidebar-menu-item').forEach(i => i.classList.remove('active'));
    const linkLlenar = document.getElementById('sidebarLinkLlenarPlanilla');
    if (linkLlenar) linkLlenar.classList.add('active');

    cerrarMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.mostrarPanelDocenteDesdeSidebar = function() {
    mostrarPanelDocente();
    document.querySelectorAll('.sidebar-menu-item').forEach(i => i.classList.remove('active'));
    const linkPanel = document.getElementById('sidebarLinkPanelDocente');
    if (linkPanel) linkPanel.classList.add('active');
};

window.abrirHistorialDocenteDesdeSidebar = function() {
    abrirHistorialDocente();
    cerrarMobileSidebar();
};

/* ==============================================================================
   3. TEMA CLARO / OSCURO (ALTO CONTRASTE)
   ============================================================================== */
function initTheme() {
    aplicarTema(AppState.tema || 'light');

    const btns = [document.getElementById('btnToggleTheme'), document.getElementById('btnToggleThemeSidebar')];
    btns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                const esOscuro = document.body.classList.contains('dark-mode');
                const nuevoTema = esOscuro ? 'light' : 'dark';
                AppState.tema = nuevoTema;
                localStorage.setItem('fya_theme', nuevoTema);
                aplicarTema(nuevoTema);
                mostrarToast(
                    nuevoTema === 'dark' ? 'Modo Oscuro' : 'Modo Claro',
                    `Interfaz ajustada a modo ${nuevoTema === 'dark' ? 'oscuro con alto contraste' : 'claro'}.`
                );
            });
        }
    });
}

function aplicarTema(tema) {
    const btnToggle = document.getElementById('btnToggleTheme');
    const sidebarIcon = document.getElementById('sidebarThemeIcon');
    const sidebarText = document.getElementById('sidebarThemeText');

    if (tema === 'dark') {
        document.body.classList.add('dark-mode');
        if (btnToggle) btnToggle.innerHTML = '<i class="fa-solid fa-sun" style="color: #facc15;"></i>';
        if (sidebarIcon) sidebarIcon.className = 'fa-solid fa-sun';
        if (sidebarText) sidebarText.textContent = 'Modo Claro';
    } else {
        document.body.classList.remove('dark-mode');
        if (btnToggle) btnToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        if (sidebarIcon) sidebarIcon.className = 'fa-solid fa-moon';
        if (sidebarText) sidebarText.textContent = 'Modo Oscuro';
    }
}

/* ==============================================================================
   4. MÁSCARAS DE VALIDACIÓN: TELÉFONOS VENEZOLANOS Y CÉDULAS
   ============================================================================== */
function initMascarasValidacion() {
    const telRepre = document.getElementById('repreTelefono');
    const cedAlumno = document.getElementById('alumnoNumDoc');
    const cedRepre = document.getElementById('repreNumDoc');

    // Máscara Nacional para Teléfonos Móviles (0414, 0424, 0412, 0416, 0426)
    if (telRepre) {
        telRepre.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, ''); // Solo dígitos
            if (val.length > 11) val = val.substring(0, 11);

            // Formatear automáticamente 04XX-XXXXXXX
            if (val.length > 4) {
                e.target.value = val.substring(0, 4) + '-' + val.substring(4);
            } else {
                e.target.value = val;
            }

            validarTelefonoVenezolano(telRepre);
            actualizarEstadoBotonImprimir();
        });

        telRepre.addEventListener('blur', () => {
            validarTelefonoVenezolano(telRepre);
            actualizarEstadoBotonImprimir();
        });
    }

    // Máscara Cédula Escolar o Documento del Alumno
    if (cedAlumno) {
        cedAlumno.addEventListener('input', (e) => {
            const tipo = document.getElementById('alumnoTipoDoc')?.value || 'CE';
            if (tipo === 'V' || tipo === 'E' || tipo === 'CE') {
                e.target.value = e.target.value.replace(/\D/g, '');
                if (tipo !== 'CE' && e.target.value.length > 9) {
                    e.target.value = e.target.value.substring(0, 9);
                } else if (tipo === 'CE' && e.target.value.length > 12) {
                    e.target.value = e.target.value.substring(0, 12);
                }
            }
            actualizarEstadoBotonImprimir();
        });
    }

    // Máscara Cédula del Representante (V, E)
    if (cedRepre) {
        cedRepre.addEventListener('input', (e) => {
            const tipo = document.getElementById('repreTipoDoc')?.value || 'V';
            if (tipo === 'V' || tipo === 'E') {
                e.target.value = e.target.value.replace(/\D/g, '');
                if (e.target.value.length > 9) {
                    e.target.value = e.target.value.substring(0, 9);
                }
            }
            actualizarEstadoBotonImprimir();
        });
    }

    // Escuchar todos los inputs requeridos para condicionar el botón de imprimir
    document.querySelectorAll('#preinscripcionForm input, #preinscripcionForm select, #preinscripcionForm textarea').forEach(input => {
        input.addEventListener('input', () => {
            actualizarEstadoBotonImprimir();
        });
        input.addEventListener('change', () => {
            actualizarEstadoBotonImprimir();
        });
    });
}

function validarTelefonoVenezolano(input) {
    const val = input.value.trim();
    const prefijosValidos = ['0414', '0424', '0412', '0416', '0426', '0261'];
    const esFormatoCorrecto = /^0[0-9]{3}-[0-9]{7}$/.test(val);
    const prefijo = val.substring(0, 4);

    if (val === '') {
        input.classList.remove('input-invalid');
        return false;
    }

    if (!esFormatoCorrecto || !prefijosValidos.includes(prefijo)) {
        input.classList.add('input-invalid');
        return false;
    } else {
        input.classList.remove('input-invalid');
        return true;
    }
}

function validarCamposObligatoriosPlanilla() {
    // Alumno
    const alNom = document.getElementById('alumnoNombres')?.value.trim();
    const alApe = document.getElementById('alumnoApellidos')?.value.trim();
    const alDoc = document.getElementById('alumnoNumDoc')?.value.trim();
    const alFNac = document.getElementById('alumnoFechaNac')?.value.trim();
    const alGen = document.getElementById('alumnoGenero')?.value.trim();
    const alDir = document.getElementById('alumnoDireccion')?.value.trim();

    // Representante
    const repNom = document.getElementById('repreNombres')?.value.trim();
    const repApe = document.getElementById('repreApellidos')?.value.trim();
    const repDoc = document.getElementById('repreNumDoc')?.value.trim();
    const repTel = document.getElementById('repreTelefono')?.value.trim();
    const repCor = document.getElementById('repreCorreo')?.value.trim();
    const repDir = document.getElementById('repreDireccion')?.value.trim();

    // Grado
    const grado = document.getElementById('selectGrado')?.value;

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(repCor);
    const telValido = /^0[0-9]{3}-[0-9]{7}$/.test(repTel);

    return Boolean(
        alNom && alApe && alDoc && alFNac && alGen && alDir &&
        repNom && repApe && repDoc && telValido && emailValido && repDir &&
        grado
    );
}

function actualizarEstadoBotonImprimir() {
    const btnImprimir = document.getElementById('btnGenerarPlanilla');
    if (!btnImprimir) return;
    btnImprimir.disabled = false;
    btnImprimir.style.opacity = '1';
    btnImprimir.style.cursor = 'pointer';
    btnImprimir.title = 'Vista previa de la planilla oficial de preinscripción';
}

/* ==============================================================================
   5. ASISTENTE GUIADO POR CINCO PASOS CONSECUTIVOS & BARRA DE PROGRESO
   ============================================================================== */
function initWizardBloques() {
    irAlPaso(1);
}

function actualizarTimestampEmision() {
    const pTime = document.getElementById('planTimestamp');
    if (pTime) {
        const ahora = new Date();
        const opciones = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        pTime.textContent = ahora.toLocaleString('es-VE', opciones);
    }
}
window.actualizarTimestampEmision = actualizarTimestampEmision;

function irAlPaso(numPaso) {
    if (numPaso < 1 || numPaso > 5) return;

    // Mostrar el paso activo con display: block !important y ocultar los 4 restantes
    for (let p = 1; p <= 5; p++) {
        const stepContent = document.getElementById(`stepContent${p}`);
        if (stepContent) {
            if (p === numPaso) {
                stepContent.style.setProperty('display', 'block', 'important');
                stepContent.style.setProperty('visibility', 'visible', 'important');
                stepContent.style.setProperty('opacity', '1', 'important');
                stepContent.classList.add('active');
            } else {
                stepContent.style.setProperty('display', 'none', 'important');
                stepContent.style.removeProperty('visibility');
                stepContent.style.removeProperty('opacity');
                stepContent.classList.remove('active');
            }
        }

        // Stepper indicators (soporta stepInd1..5 y stepBlockInd1..5)
        const stepInd = document.getElementById(`stepInd${p}`) || document.getElementById(`stepBlockInd${p}`);
        if (stepInd) {
            if (p < numPaso) {
                stepInd.classList.add('completed');
                stepInd.classList.remove('active');
            } else if (p === numPaso) {
                stepInd.classList.add('active');
                stepInd.classList.remove('completed');
            } else {
                stepInd.classList.remove('active', 'completed');
            }
        }
    }

    // Actualizar Barra de Progreso Superior
    const progressBar = document.getElementById('wizardProgressBar');
    const progressPercent = document.getElementById('wizardProgressPercent');
    const stepName = document.getElementById('wizardStepName');

    const porcentajes = { 1: '20%', 2: '40%', 3: '60%', 4: '80%', 5: '100%' };
    const nombres = {
        1: 'Paso 1 de 5: Datos del Aspirante / Alumno',
        2: 'Paso 2 de 5: Datos del Representante Legal',
        3: 'Paso 3 de 5: Plantel o Escuela de Procedencia',
        4: 'Paso 4 de 5: Oferta Académica (Grado Primaria)',
        5: 'Paso 5 de 5: Consignación de Recaudos y Registro'
    };

    if (progressBar) progressBar.style.width = porcentajes[numPaso];
    if (progressPercent) progressPercent.textContent = `${numPaso * 20}% completado`;
    if (stepName) stepName.textContent = nombres[numPaso];

    AppState.pasoActual = numPaso;
    AppState.bloqueActual = numPaso <= 2 ? 1 : (numPaso <= 4 ? 2 : 3);
    actualizarEstadoBotonImprimir();
    actualizarTimestampEmision();
    window.scrollTo({ top: 180, behavior: 'smooth' });
}

function avanzarPasoConValidacion(pasoDestino) {
    const pasoActual = AppState.pasoActual || 1;
    if (pasoDestino > pasoActual) {
        if (!validarPaso(pasoActual)) return;
    }
    irAlPaso(pasoDestino);
}

function validarPaso(numPaso) {
    const stepElem = document.getElementById(`stepContent${numPaso}`);
    if (!stepElem) return true;

    const camposRequeridos = stepElem.querySelectorAll('input[required], select[required], textarea[required]');
    let esValido = true;
    let primerCampoInvalido = null;

    camposRequeridos.forEach(campo => {
        // Eximir campos ocultos o deshabilitados
        if (campo.offsetParent === null || campo.disabled) return;

        // Si es primer ingreso, ignorar plantel de procedencia
        const chkPrimerIngreso = document.getElementById('chkPrimerIngreso');
        if (chkPrimerIngreso && chkPrimerIngreso.checked && (campo.id === 'institutoNombre' || campo.id === 'institutoTipo')) {
            campo.classList.remove('input-invalid');
            return;
        }

        const valor = campo.value.trim();
        if (!valor) {
            campo.classList.add('input-invalid');
            esValido = false;
            if (!primerCampoInvalido) primerCampoInvalido = campo;
        } else {
            if (campo.id === 'repreTelefono' && !validarTelefonoVenezolano(campo)) {
                campo.classList.add('input-invalid');
                esValido = false;
                if (!primerCampoInvalido) primerCampoInvalido = campo;
            } else if (campo.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
                campo.classList.add('input-invalid');
                esValido = false;
                if (!primerCampoInvalido) primerCampoInvalido = campo;
            } else {
                campo.classList.remove('input-invalid');
            }
        }
    });

    if (!esValido) {
        if (primerCampoInvalido) {
            primerCampoInvalido.focus();
            primerCampoInvalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        mostrarToast('Datos Obligatorios Incompletos', 'Completa los campos requeridos con asterisco (*) antes de continuar.', 'error');
        return false;
    }

    return true;
}

// Retrocompatibilidad total
window.irAlPaso = irAlPaso;
window.avanzarPasoConValidacion = avanzarPasoConValidacion;
window.validarPaso = validarPaso;
window.irAlBloque = function(bloque) {
    if (bloque === 1) irAlPaso(1);
    else if (bloque === 2) irAlPaso(2);
    else if (bloque === 3) irAlPaso(5);
};
window.avanzarBloqueConValidacion = function(bloqueDestino) {
    if (bloqueDestino === 2) avanzarPasoConValidacion(2);
    else if (bloqueDestino === 3) avanzarPasoConValidacion(5);
};
window.validarBloque = function(bloque) {
    if (bloque === 1) return validarPaso(1);
    if (bloque === 2) return validarPaso(2) && validarPaso(3) && validarPaso(4);
    if (bloque === 3) return validarPaso(5);
    return true;
};

/* ==============================================================================
   6. AUTOGUARDADO EN SEGUNDO PLANO (localStorage)
   ============================================================================== */
function initAutoguardado() {
    const form = document.getElementById('preinscripcionForm');
    if (!form) return;

    // Restaurar borrador previo si existe
    restaurarBorrador();

    // Guardar automáticamente ante cada modificación (debounced a 500ms)
    form.addEventListener('input', programarAutoguardado);
    form.addEventListener('change', programarAutoguardado);
}

function programarAutoguardado() {
    clearTimeout(AppState.autoSaveTimer);
    AppState.autoSaveTimer = setTimeout(ejecutarAutoguardado, 500);
}

function ejecutarAutoguardado() {
    const datos = {
        alumnoTipoDoc: document.getElementById('alumnoTipoDoc')?.value,
        alumnoNumDoc: document.getElementById('alumnoNumDoc')?.value,
        alumnoNombres: document.getElementById('alumnoNombres')?.value,
        alumnoApellidos: document.getElementById('alumnoApellidos')?.value,
        alumnoFechaNac: document.getElementById('alumnoFechaNac')?.value,
        alumnoGenero: document.getElementById('alumnoGenero')?.value,
        alumnoTipoSangre: document.getElementById('alumnoTipoSangre')?.value,
        alumnoLugarNac: document.getElementById('alumnoLugarNac')?.value,
        alumnoViveCon: document.getElementById('alumnoViveCon')?.value,
        alumnoDireccion: document.getElementById('alumnoDireccion')?.value,
        alumnoAlergias: document.getElementById('alumnoAlergias')?.value,

        repreTipoDoc: document.getElementById('repreTipoDoc')?.value,
        repreNumDoc: document.getElementById('repreNumDoc')?.value,
        repreParentesco: document.getElementById('repreParentesco')?.value,
        repreNombres: document.getElementById('repreNombres')?.value,
        repreApellidos: document.getElementById('repreApellidos')?.value,
        repreTelefono: document.getElementById('repreTelefono')?.value,
        repreCorreo: document.getElementById('repreCorreo')?.value,
        repreOcupacion: document.getElementById('repreOcupacion')?.value,
        repreLugarTrabajo: document.getElementById('repreLugarTrabajo')?.value,
        repreDireccion: document.getElementById('repreDireccion')?.value,

        chkPrimerIngreso: document.getElementById('chkPrimerIngreso')?.checked,
        institutoNombre: document.getElementById('institutoNombre')?.value,
        institutoCodigo: document.getElementById('institutoCodigo')?.value,
        institutoTipo: document.getElementById('institutoTipo')?.value,
        institutoCiudad: document.getElementById('institutoCiudad')?.value,

        selectGrado: document.getElementById('selectGrado')?.value,
        observacionesPre: document.getElementById('observacionesPre')?.value
    };

    localStorage.setItem('fya_preinscripcion_draft', JSON.stringify(datos));
    mostrarAvisoAutoguardado();
}

function mostrarAvisoAutoguardado() {
    const pill = document.getElementById('autoSaveNoticePill');
    if (!pill) return;

    pill.style.display = 'inline-flex';
    clearTimeout(pill._timer);
    pill._timer = setTimeout(() => {
        pill.style.display = 'none';
    }, 2800);
}

function restaurarBorrador() {
    const borradorStr = localStorage.getItem('fya_preinscripcion_draft');
    if (!borradorStr) return;

    try {
        const d = JSON.parse(borradorStr);
        Object.keys(d).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = Boolean(d[id]);
                } else if (d[id] !== undefined && d[id] !== null) {
                    el.value = d[id];
                }
            }
        });

        actualizarResumenGrado();
        actualizarEstadoBotonImprimir();
        mostrarToast('Borrador Restaurado', 'Se recuperaron automáticamente los datos ingresados previamente.', 'info');
    } catch (e) {
        console.warn('Error al restaurar borrador:', e);
    }
}

/* ==============================================================================
   7. BÚSQUEDA EN TIEMPO REAL Y EXPORTACIÓN A EXCEL / CSV (DOCENTE)
   ============================================================================== */
function initBusquedaTiempoReal() {
    const input = document.getElementById('filtroDocenteBusqueda');
    if (input) {
        input.addEventListener('input', () => {
            filtrarYRenderizarPanelDocente();
        });
    }
}

function initExportarExcel() {
    const btnExport = document.getElementById('btnExportarExcelDocente');
    if (btnExport) {
        btnExport.addEventListener('click', exportarRegistrosAExcel);
    }
}

function exportarRegistrosAExcel() {
    const registros = AppState.registros || [];
    if (registros.length === 0) {
        mostrarToast('Sin Datos', 'No hay registros de preinscripción para exportar.', 'error');
        return;
    }

    // Cabecera CSV en Español
    const headers = [
        'N° Folio',
        'Estudiante (Aspirante)',
        'Documento Alumno',
        'Fecha Nacimiento',
        'Género',
        'Representante Legal',
        'Cédula Representante',
        'Parentesco',
        'Teléfono Contacto',
        'Correo Electrónico',
        'Grado Primaria Solicitado',
        'Escuela Procedencia',
        'Recaudos Consignados',
        'Estado de Solicitud',
        'Fecha de Preinscripción'
    ];

    const rows = registros.map(r => [
        `"${r.codigo || ''}"`,
        `"${(r.alumno || '').replace(/"/g, '""')}"`,
        `"${r.alumnoDoc || ''}"`,
        `"${r.alumnoFechaNac || ''}"`,
        `"${r.alumnoGenero || ''}"`,
        `"${(r.representante || '').replace(/"/g, '""')}"`,
        `"${r.repreDoc || ''}"`,
        `"${r.repreParentesco || ''}"`,
        `"${r.repreTelefono || ''}"`,
        `"${r.repreCorreo || ''}"`,
        `"${r.grado || ''}"`,
        `"${(r.instituto || '').replace(/"/g, '""')}"`,
        `"${r.recaudosCount || '5/5'}"`,
        `"${r.estado || ''}"`,
        `"${r.fecha || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Preinscripciones_FeyAlegria_2026_2027_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    mostrarToast('Exportación Exitosa', 'Archivo de preinscripciones generado para Microsoft Excel.');
}

/* ==============================================================================
   8. MOTOR OFICIAL DE GENERACIÓN Y DESCARGA DE PDF (HOJA CARTA ÚNICA)
   ============================================================================== */
let redireccionInterval = null;

function iniciarCuentaRegresivaRedireccion() {
    if (redireccionInterval) {
        clearInterval(redireccionInterval);
        redireccionInterval = null;
    }

    const modalRedir = document.getElementById('modal-redireccion');
    const contador = document.getElementById('contador-segundos');
    const barra = document.getElementById('barra-progreso-redireccion');

    if (modalRedir) {
        modalRedir.style.setProperty('display', 'flex', 'important');
        modalRedir.style.setProperty('visibility', 'visible', 'important');
        modalRedir.style.setProperty('opacity', '1', 'important');
    }

    let segundos = 5;
    if (contador) contador.textContent = '5';
    if (barra) barra.style.width = '100%';

    const ejecutarSalida = () => {
        if (redireccionInterval) {
            clearInterval(redireccionInterval);
            redireccionInterval = null;
        }
        localStorage.removeItem('fya_preinscripcion_draft');
        window.location.href = 'index.html';
    };

    const btnIr = document.getElementById('btnIrInicioAhora');
    if (btnIr) {
        btnIr.onclick = (e) => {
            if (e) e.preventDefault();
            ejecutarSalida();
        };
    }

    redireccionInterval = setInterval(() => {
        segundos--;
        if (contador) contador.textContent = String(segundos);
        if (barra) {
            barra.style.width = `${Math.max(0, (segundos / 5) * 100)}%`;
        }
        if (segundos <= 0) {
            ejecutarSalida();
        }
    }, 1000);
}
window.iniciarCuentaRegresivaRedireccion = iniciarCuentaRegresivaRedireccion;
window.irAlInicioInmediatamente = () => {
    if (redireccionInterval) clearInterval(redireccionInterval);
    localStorage.removeItem('fya_preinscripcion_draft');
    window.location.href = 'index.html';
};

async function generarYDescargarPdfPlanilla(cedulaAlumno) {
    // 1. Ejecutar sincronización obligatoria de datos
    sincronizarDatosPlanilla();

    const elemPlanilla = document.getElementById('planilla-oficial');
    if (!elemPlanilla) {
        console.error('[PDF] Elemento #planilla-oficial no encontrado en el DOM.');
        return;
    }

    const cedulaLimpia = (cedulaAlumno || 'ESTUDIANTE').toString().trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const nombreArchivo = `Planilla_Preinscripcion_${cedulaLimpia}.pdf`;

    // 2. Disparar modal prominente de cuenta regresiva al inicio exactamente al iniciar la descarga
    iniciarCuentaRegresivaRedireccion();

    mostrarToast('Generando Documento', `Descargando ${nombreArchivo}...`, 'success');

    // 3. Preparar estado visible temporal para erradicar el PDF en blanco y asegurar 1 sola hoja Carta completa
    const modalParent = document.getElementById('modalPlanillaBackdrop');
    const scrollParent = document.getElementById('modalSheetScrollContainer');
    const modalDialog = modalParent ? modalParent.querySelector('.modal-dialog') : null;
    const modalContent = modalParent ? modalParent.querySelector('.modal-content') : null;

    const prevModalDisplay = modalParent ? modalParent.style.display : '';
    const prevModalVisibility = modalParent ? modalParent.style.visibility : '';
    const prevModalOpacity = modalParent ? modalParent.style.opacity : '';
    const prevModalZIndex = modalParent ? modalParent.style.zIndex : '';
    const prevModalPosition = modalParent ? modalParent.style.position : '';
    const prevModalTop = modalParent ? modalParent.style.top : '';
    const prevModalLeft = modalParent ? modalParent.style.left : '';
    const prevModalWidth = modalParent ? modalParent.style.width : '';
    const prevModalPadding = modalParent ? modalParent.style.padding : '';
    const prevModalMargin = modalParent ? modalParent.style.margin : '';

    const prevDialogStyle = modalDialog ? (modalDialog.getAttribute('style') || '') : '';
    const prevContentStyle = modalContent ? (modalContent.getAttribute('style') || '') : '';
    const prevScrollStyle = scrollParent ? (scrollParent.getAttribute('style') || '') : '';
    const prevPlanillaStyle = elemPlanilla.getAttribute('style') || '';

    // Si el contenedor padre modal está oculto, darle visibilidad fija y alineada a la izquierda (x=0)
    if (modalParent) {
        modalParent.style.setProperty('display', 'block', 'important');
        modalParent.style.setProperty('visibility', 'visible', 'important');
        modalParent.style.setProperty('opacity', '1', 'important');
        modalParent.style.setProperty('position', 'fixed', 'important');
        modalParent.style.setProperty('top', '0', 'important');
        modalParent.style.setProperty('left', '0', 'important');
        modalParent.style.setProperty('width', '850px', 'important');
        modalParent.style.setProperty('margin', '0', 'important');
        modalParent.style.setProperty('padding', '0', 'important');
        modalParent.style.setProperty('z-index', '9998', 'important');
    }
    if (modalDialog) {
        modalDialog.style.setProperty('margin', '0', 'important');
        modalDialog.style.setProperty('padding', '0', 'important');
        modalDialog.style.setProperty('max-width', '850px', 'important');
        modalDialog.style.setProperty('width', '850px', 'important');
        modalDialog.style.setProperty('transform', 'none', 'important');
        modalDialog.style.setProperty('box-shadow', 'none', 'important');
        modalDialog.style.setProperty('border', 'none', 'important');
    }
    if (modalContent) {
        modalContent.style.setProperty('margin', '0', 'important');
        modalContent.style.setProperty('padding', '0', 'important');
        modalContent.style.setProperty('border', 'none', 'important');
        modalContent.style.setProperty('box-shadow', 'none', 'important');
        modalContent.style.setProperty('background', '#ffffff', 'important');
        modalContent.style.setProperty('transform', 'none', 'important');
    }
    if (scrollParent) {
        scrollParent.scrollTop = 0;
        scrollParent.scrollLeft = 0;
        scrollParent.style.setProperty('margin', '0', 'important');
        scrollParent.style.setProperty('padding', '0', 'important');
        scrollParent.style.setProperty('overflow', 'visible', 'important');
        scrollParent.style.setProperty('background', '#ffffff', 'important');
    }

    // Aplicar al contenedor '#planilla-oficial' un estado visible temporal con fondo blanco puro (#ffffff),
    // ancho fijo de 750px (proporción Carta), altura máxima de 980px, flush a la izquierda
    elemPlanilla.classList.add('captura-pdf-activa');
    elemPlanilla.style.setProperty('display', 'block', 'important');
    elemPlanilla.style.setProperty('visibility', 'visible', 'important');
    elemPlanilla.style.setProperty('opacity', '1', 'important');
    elemPlanilla.style.setProperty('background', '#ffffff', 'important');
    elemPlanilla.style.setProperty('background-color', '#ffffff', 'important');
    elemPlanilla.style.setProperty('width', '750px', 'important');
    elemPlanilla.style.setProperty('min-width', '750px', 'important');
    elemPlanilla.style.setProperty('max-width', '750px', 'important');
    elemPlanilla.style.setProperty('max-height', '980px', 'important');
    elemPlanilla.style.setProperty('overflow', 'hidden', 'important');
    elemPlanilla.style.setProperty('box-sizing', 'border-box', 'important');
    elemPlanilla.style.setProperty('margin', '0', 'important');
    elemPlanilla.style.setProperty('padding', '6px 12px', 'important');
    elemPlanilla.style.setProperty('position', 'relative', 'important');
    elemPlanilla.style.setProperty('left', '0', 'important');
    elemPlanilla.style.setProperty('top', '0', 'important');
    elemPlanilla.style.setProperty('transform', 'none', 'important');

    // Forzar en todos los elementos internos color: #000000 !important; border-color: #333333 !important; opacity: 1 !important;
    const internalElems = elemPlanilla.querySelectorAll('*');
    internalElems.forEach(el => {
        el.style.setProperty('color', '#000000', 'important');
        el.style.setProperty('border-color', '#333333', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
    });

    // Opciones estrictamente obligatorias según ingeniería documental (1 sola hoja Carta sin recortes)
    const opt = {
        margin: [5, 8, 5, 8],
        filename: "Planilla_Preinscripcion_" + cedulaLimpia + ".pdf",
        pagebreak: { mode: "avoid-all" },
        html2canvas: {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            width: 750,
            windowWidth: 850
        },
        jsPDF: {
            unit: "mm",
            format: "letter",
            orientation: "portrait"
        }
    };

    try {
        if (typeof html2pdf !== 'undefined') {
            await html2pdf().set(opt).from(elemPlanilla).save();
            console.log('[PDF] Documento PDF descargado exitosamente en una sola página Carta.');
        } else {
            console.warn('[PDF] html2pdf no está disponible en window; se completará redirección.');
        }
    } catch (err) {
        console.error('[PDF] Error capturando o guardando PDF:', err);
    } finally {
        elemPlanilla.classList.remove('captura-pdf-activa');
        if (prevPlanillaStyle) {
            elemPlanilla.setAttribute('style', prevPlanillaStyle);
        } else {
            elemPlanilla.removeAttribute('style');
        }
        if (modalDialog) {
            if (prevDialogStyle) modalDialog.setAttribute('style', prevDialogStyle);
            else modalDialog.removeAttribute('style');
        }
        if (modalContent) {
            if (prevContentStyle) modalContent.setAttribute('style', prevContentStyle);
            else modalContent.removeAttribute('style');
        }
        if (scrollParent) {
            if (prevScrollStyle) scrollParent.setAttribute('style', prevScrollStyle);
            else scrollParent.removeAttribute('style');
        }
        if (modalParent) {
            modalParent.style.display = prevModalDisplay;
            modalParent.style.visibility = prevModalVisibility;
            modalParent.style.opacity = prevModalOpacity;
            modalParent.style.zIndex = prevModalZIndex;
            modalParent.style.position = prevModalPosition;
            modalParent.style.top = prevModalTop;
            modalParent.style.left = prevModalLeft;
            modalParent.style.width = prevModalWidth;
            modalParent.style.padding = prevModalPadding;
            modalParent.style.margin = prevModalMargin;
        }
    }
}
window.generarYDescargarPdfPlanilla = generarYDescargarPdfPlanilla;

/* ==============================================================================
   9. SINCRONIZACIÓN DE LA PLANILLA OFICIAL IMPRIMIBLE (#planilla-oficial)
   ============================================================================== */
function sincronizarDatosPlanilla() {
    // 1. Metadatos de la Solicitud y Grado Seleccionado
    const codSol = document.getElementById('inputCodigoPre')?.value || 'PRE-2026-0001';
    const selectG = document.getElementById('selectGrado');
    const nombreGrado = selectG?.options[selectG.selectedIndex]?.text || '1er Grado de Educación Primaria';

    const planCod = document.getElementById('planCodigoSol');
    if (planCod) planCod.textContent = codSol;
    const planFecha = document.getElementById('planFechaReg');
    if (planFecha) planFecha.textContent = new Date().toLocaleDateString('es-VE');
    const planGrado = document.getElementById('planGradoSol');
    if (planGrado) planGrado.textContent = nombreGrado;

    // 2. Paso 1: Datos del Aspirante / Alumno
    const alNomInput = (document.getElementById('alumnoNombres')?.value || '').trim();
    const alApeInput = (document.getElementById('alumnoApellidos')?.value || '').trim();
    const alNom = (alNomInput || alApeInput) ? `${alNomInput} ${alApeInput}`.trim() : 'Jesús David Gómez Blanco';

    const alTipoDoc = document.getElementById('alumnoTipoDoc')?.value || 'CE';
    const alNumDoc = (document.getElementById('alumnoNumDoc')?.value || '').trim();
    const alDoc = alNumDoc ? `${alTipoDoc}-${alNumDoc}` : `${alTipoDoc}-118999444`;

    const fNac = document.getElementById('alumnoFechaNac')?.value;
    let edad = '6 años';
    if (fNac) {
        const anyoNac = new Date(fNac).getFullYear();
        if (!isNaN(anyoNac)) {
            const diff = 2026 - anyoNac;
            edad = `${diff > 0 ? diff : 6} años`;
        }
    }

    const selectGen = document.getElementById('alumnoGenero');
    const genTexto = selectGen?.options[selectGen.selectedIndex]?.text || selectGen?.value || 'MASCULINO';

    const selectSangre = document.getElementById('alumnoTipoSangre');
    const sangreTexto = selectSangre?.options[selectSangre.selectedIndex]?.text || selectSangre?.value || 'O+';

    const lugNac = (document.getElementById('alumnoLugarNac')?.value || '').trim() || 'San Francisco, Edo. Zulia';

    const selectVive = document.getElementById('alumnoViveCon');
    const viveTexto = selectVive?.options[selectVive.selectedIndex]?.text || (selectVive?.value || 'AMBOS_PADRES').replace(/_/g, ' ');

    const dirHab = (document.getElementById('alumnoDireccion')?.value || '').trim() || 'Barrio 24 de Julio, San Francisco, Edo. Zulia';
    const alergias = (document.getElementById('alumnoAlergias')?.value || '').trim() || 'Ninguna conocida';

    const pAlNom = document.getElementById('planAlumnoNombres');
    if (pAlNom) pAlNom.textContent = alNom;
    const pAlDoc = document.getElementById('planAlumnoDoc');
    if (pAlDoc) pAlDoc.textContent = alDoc;
    const pAlFNac = document.getElementById('planAlumnoFechaNac');
    if (pAlFNac) pAlFNac.textContent = fNac ? fNac.split('-').reverse().join('/') : '12/03/2020';
    const pAlEdad = document.getElementById('planAlumnoEdad');
    if (pAlEdad) pAlEdad.textContent = edad;
    const pAlGen = document.getElementById('planAlumnoGenero');
    if (pAlGen) pAlGen.textContent = genTexto;
    const pAlSang = document.getElementById('planAlumnoSangre');
    if (pAlSang) pAlSang.textContent = sangreTexto;
    const pAlLug = document.getElementById('planAlumnoLugarNac');
    if (pAlLug) pAlLug.textContent = lugNac;
    const pAlViv = document.getElementById('planAlumnoViveCon');
    if (pAlViv) pAlViv.textContent = viveTexto;
    const pAlDir = document.getElementById('planAlumnoDireccion');
    if (pAlDir) pAlDir.textContent = dirHab;
    const pAlAler = document.getElementById('planAlumnoAlergias');
    if (pAlAler) pAlAler.textContent = alergias;

    // 3. Paso 2: Datos del Representante Legal
    const repNomInput = (document.getElementById('repreNombres')?.value || '').trim();
    const repApeInput = (document.getElementById('repreApellidos')?.value || '').trim();
    const repNom = (repNomInput || repApeInput) ? `${repNomInput} ${repApeInput}`.trim() : 'Carmen Elena Blanco de Gómez';

    const repTipoDoc = document.getElementById('repreTipoDoc')?.value || 'V';
    const repNumDoc = (document.getElementById('repreNumDoc')?.value || '').trim();
    const repDoc = repNumDoc ? `${repTipoDoc}-${repNumDoc}` : `${repTipoDoc}-19888777`;

    const selectPar = document.getElementById('repreParentesco');
    const parTexto = selectPar?.options[selectPar.selectedIndex]?.text || selectPar?.value || 'MADRE';

    const repTel = (document.getElementById('repreTelefono')?.value || '').trim() || '0414-9876543';
    const repCor = (document.getElementById('repreCorreo')?.value || '').trim() || 'carmen.blanco@correo.com';
    const repOcu = (document.getElementById('repreOcupacion')?.value || '').trim() || 'Comerciante';
    const repDir = (document.getElementById('repreDireccion')?.value || '').trim() || dirHab;

    const pRepNom = document.getElementById('planRepreNombres');
    if (pRepNom) pRepNom.textContent = repNom;
    const pRepDoc = document.getElementById('planRepreDoc');
    if (pRepDoc) pRepDoc.textContent = repDoc;
    const pRepPar = document.getElementById('planRepreParentesco');
    if (pRepPar) pRepPar.textContent = parTexto;
    const pRepTel = document.getElementById('planRepreTelefono');
    if (pRepTel) pRepTel.textContent = repTel;
    const pRepCor = document.getElementById('planRepreCorreo');
    if (pRepCor) pRepCor.textContent = repCor;
    const pRepOcu = document.getElementById('planRepreOcupacion');
    if (pRepOcu) pRepOcu.textContent = repOcu;
    const pRepDir = document.getElementById('planRepreDireccion');
    if (pRepDir) pRepDir.textContent = repDir;

    // Firmas
    const sNomRep = document.getElementById('sigNombreRepre');
    if (sNomRep) sNomRep.textContent = repNom;
    const sDocRep = document.getElementById('sigDocRepre');
    if (sDocRep) sDocRep.textContent = repDoc;

    // 4. Paso 3: Plantel o Escuela de Procedencia
    const chkPI = document.getElementById('chkPrimerIngreso')?.checked;
    const pInstNom = document.getElementById('planInstNombre');
    const pInstCod = document.getElementById('planInstCodigo');
    const pInstTip = document.getElementById('planInstTipo');
    const pInstCiu = document.getElementById('planInstCiudad');

    if (chkPI) {
        if (pInstNom) pInstNom.textContent = 'Primer Ingreso (Sin Plantel Anterior)';
        if (pInstCod) pInstCod.textContent = 'N/A';
        if (pInstTip) pInstTip.textContent = 'N/A';
        if (pInstCiu) pInstCiu.textContent = 'San Francisco, Edo. Zulia';
    } else {
        const instNom = (document.getElementById('institutoNombre')?.value || '').trim() || 'C.E.I. Barrio 24 de Julio';
        const instCod = (document.getElementById('institutoCodigo')?.value || '').trim() || 'DEA-CEI-24J';
        const selectInstTipo = document.getElementById('institutoTipo');
        const instTip = selectInstTipo?.options[selectInstTipo.selectedIndex]?.text || selectInstTipo?.value || 'Pública';
        const instCiu = (document.getElementById('institutoCiudad')?.value || '').trim() || 'San Francisco, Edo. Zulia';

        if (pInstNom) pInstNom.textContent = instNom;
        if (pInstCod) pInstCod.textContent = instCod;
        if (pInstTip) pInstTip.textContent = instTip;
        if (pInstCiu) pInstCiu.textContent = instCiu;
    }

    // 5. Paso 5: Recaudos y Documentos Consignados
    sincronizarRecaudosPlanilla();

    // 6. Timestamp Oficial
    actualizarTimestampEmision();
}
window.sincronizarDatosPlanilla = sincronizarDatosPlanilla;
window.sincronizarDatosPlanillaOficial = sincronizarDatosPlanilla;

function sincronizarDatosPlanillaDesdeRegistro(r) {
    document.getElementById('planCodigoSol').textContent = r.codigo;
    document.getElementById('planFechaReg').textContent = r.fecha || new Date().toLocaleDateString('es-VE');
    document.getElementById('planGradoSol').textContent = r.grado;

    document.getElementById('planAlumnoNombres').textContent = r.alumno;
    document.getElementById('planAlumnoDoc').textContent = r.alumnoDoc || 'CE-S/N';
    document.getElementById('planAlumnoFechaNac').textContent = r.alumnoFechaNac ? r.alumnoFechaNac.split('-').reverse().join('/') : '12/03/2020';
    document.getElementById('planAlumnoEdad').textContent = '6 años';
    document.getElementById('planAlumnoGenero').textContent = r.alumnoGenero || 'MASCULINO';
    document.getElementById('planAlumnoSangre').textContent = r.alumnoSangre || 'O+';
    document.getElementById('planAlumnoLugarNac').textContent = r.alumnoLugarNac || 'San Francisco, Edo. Zulia';
    document.getElementById('planAlumnoViveCon').textContent = r.alumnoViveCon || 'Ambos Padres';
    document.getElementById('planAlumnoDireccion').textContent = r.alumnoDireccion || 'San Francisco, Edo. Zulia';
    document.getElementById('planAlumnoAlergias').textContent = r.alumnoAlergias || 'Ninguna';

    document.getElementById('planRepreNombres').textContent = r.representante;
    document.getElementById('planRepreDoc').textContent = r.repreDoc || 'V-S/N';
    document.getElementById('planRepreParentesco').textContent = r.repreParentesco || 'MADRE';
    document.getElementById('planRepreTelefono').textContent = r.repreTelefono || '0414-0000000';
    document.getElementById('planRepreCorreo').textContent = r.repreCorreo || 'correo@ejemplo.com';
    document.getElementById('planRepreOcupacion').textContent = r.repreOcupacion || 'Particular';
    document.getElementById('planRepreDireccion').textContent = r.repreDireccion || r.alumnoDireccion || 'San Francisco, Edo. Zulia';

    document.getElementById('sigNombreRepre').textContent = r.representante;
    document.getElementById('sigDocRepre').textContent = r.repreDoc || '';

    actualizarTimestampEmision();
    const nowStr = document.getElementById('planTimestamp')?.textContent || new Date().toLocaleString('es-VE');

    document.getElementById('planInstNombre').textContent = r.instituto || 'C.E.I. Barrio 24 de Julio';
    document.getElementById('planInstCodigo').textContent = r.institutoCodigo || 'DEA-CEI-24J';
    document.getElementById('planInstTipo').textContent = r.institutoTipo || 'PUBLICA';
    document.getElementById('planInstCiudad').textContent = r.institutoCiudad || 'San Francisco, Edo. Zulia';

    sincronizarRecaudosPlanilla(r);
}

function sincronizarRecaudosPlanilla(registro = null) {
    const tbody = document.getElementById('planDocTableBody');
    if (!tbody) return;

    const lista = [
        { id: '1', nombre: 'Partida de Nacimiento del Estudiante', idSelect: 'estadoDoc1' },
        { id: '2', nombre: 'Copia de Cédula de Identidad del Representante Legal', idSelect: 'estadoDoc2' },
        { id: '3', nombre: 'Boleta o Informe Descriptivo del Grado Anterior', idSelect: 'estadoDoc3' },
        { id: '4', nombre: '4 Fotografías Tipo Carnet del Estudiante', idSelect: 'estadoDoc4' },
        { id: '5', nombre: 'Constancia de Residencia de la Comunidad', idSelect: 'estadoDoc5' }
    ];

    let html = '';
    lista.forEach(item => {
        let est = 'NO_CONSIGNADO';
        let tieneArchivo = false;

        if (registro) {
            est = (registro.documentos && registro.documentos[item.id]) || 'CONSIGNADO';
            tieneArchivo = Boolean(registro.archivos && registro.archivos[item.id]);
        } else {
            const sel = document.getElementById(item.idSelect);
            est = sel ? sel.value : 'NO_CONSIGNADO';
            tieneArchivo = Boolean(AppState.archivosCargados[item.id]);
        }

        const entregado = est === 'APROBADO' || est === 'CONSIGNADO' || tieneArchivo;
        const check = entregado ? '[ X ]' : '[ &nbsp; ]';
        const color = est === 'APROBADO' ? '#15803d' : (entregado ? '#0369a1' : '#b91c1c');

        html += `
            <tr>
                <td style="text-align: center; font-family: monospace; font-weight: bold;">${check}</td>
                <td>
                    ${item.nombre}
                    ${tieneArchivo ? '<span style="font-size: 7pt; color: #16a34a; margin-left: 0.35rem; font-weight: bold;">[Digital]</span>' : ''}
                </td>
                <td style="color: ${color}; font-weight: bold; font-size: 7.5pt;">${est}</td>
                <td style="font-size: 7.5pt; color: #52525b;">${entregado ? 'Consignado' : 'Pendiente'}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/* ==============================================================================
   10. CARGA DE ARCHIVOS / RECAUDOS POR EL REPRESENTANTE
   ============================================================================== */
function initUploadRecaudos() {
    document.querySelectorAll('.file-recaudo-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const docId = e.target.getAttribute('data-doc-id');
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                mostrarToast('Archivo muy grande', 'El documento excede el límite de 5 MB permitido.', 'error');
                e.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                AppState.archivosCargados[docId] = {
                    nombre: file.name,
                    tamano: file.size,
                    tipo: file.type,
                    dataUrl: dataUrl,
                    fecha: new Date().toLocaleDateString('es-VE')
                };

                renderizarChipArchivoCargado(docId, file.name, file.size);

                const sel = document.getElementById(`estadoDoc${docId}`);
                if (sel) sel.value = 'CONSIGNADO';

                mostrarToast('Recaudo Cargado', `"${file.name}" cargado exitosamente.`);
            };
            reader.readAsDataURL(file);
        });
    });
}

function renderizarChipArchivoCargado(docId, nombre, tamano) {
    const statusElem = document.getElementById(`fileStatusDoc${docId}`);
    if (!statusElem) return;

    const tamanoStr = tamano ? (tamano > 1024 * 1024 ? (tamano / (1024 * 1024)).toFixed(1) + ' MB' : (tamano / 1024).toFixed(0) + ' KB') : 'Adjunto';

    statusElem.innerHTML = `
        <div class="recaudo-file-chip">
            <i class="fa-solid fa-circle-check"></i>
            <span style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${nombre}">
                ${nombre} (${tamanoStr})
            </span>
            <div class="recaudo-chip-actions">
                <button type="button" class="recaudo-chip-btn" onclick="previsualizarArchivoCargado('${docId}')" title="Ver documento">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="recaudo-chip-btn" onclick="quitarArchivoCargado('${docId}')" title="Quitar archivo">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

window.quitarArchivoCargado = function(docId) {
    delete AppState.archivosCargados[docId];
    const input = document.getElementById(`fileUploadDoc${docId}`);
    if (input) input.value = '';

    const statusElem = document.getElementById(`fileStatusDoc${docId}`);
    if (statusElem) {
        statusElem.innerHTML = `
            <i class="fa-regular fa-file"></i>
            <div>
                <strong style="display: block; font-size: 0.86rem; color: var(--text-secondary);">Sin archivo adjunto</strong>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Formatos admitidos: PDF, JPG, PNG (Máx 5MB)</span>
            </div>
        `;
    }

    const sel = document.getElementById(`estadoDoc${docId}`);
    if (sel) sel.value = 'NO_CONSIGNADO';

    mostrarToast('Recaudo Eliminado', 'Se retiró el archivo adjunto.');
};

window.previsualizarArchivoCargado = function(docId) {
    const archivo = AppState.archivosCargados[docId];
    if (archivo) {
        mostrarModalPreviewDoc(archivo.nombre, archivo.dataUrl, archivo.tipo);
    }
};

/* ==============================================================================
   11. RENDERIZADO DEL PANEL DOCENTE & TABLA DE PREINSCRITOS
   ============================================================================== */
function renderizarPanelDocente() {
    filtrarYRenderizarPanelDocente();
    actualizarKpisDocente();
}

function filtrarYRenderizarPanelDocente() {
    const tbody = document.getElementById('tablaDocenteRegistrosBody');
    if (!tbody) return;

    const texto = (document.getElementById('filtroDocenteBusqueda')?.value || '').trim().toLowerCase();
    const gradoFiltro = document.getElementById('filtroDocenteGrado')?.value || AppState.filtroGradoActivo || '';
    const estadoFiltro = document.getElementById('filtroDocenteEstado')?.value || '';

    const filtrados = (AppState.registros || []).filter(r => {
        const matchTexto = !texto ||
            (r.alumno && r.alumno.toLowerCase().includes(texto)) ||
            (r.codigo && r.codigo.toLowerCase().includes(texto)) ||
            (r.alumnoDoc && r.alumnoDoc.toLowerCase().includes(texto)) ||
            (r.representante && r.representante.toLowerCase().includes(texto)) ||
            (r.repreDoc && r.repreDoc.toLowerCase().includes(texto)) ||
            (r.instituto && r.instituto.toLowerCase().includes(texto));

        const matchGrado = !gradoFiltro || (r.grado && r.grado.includes(gradoFiltro));
        const matchEstado = !estadoFiltro || r.estado === estadoFiltro;

        return matchTexto && matchGrado && matchEstado;
    });

    if (!AppState.registros || AppState.registros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size: 2.4rem; color: #94a3b8; display: block; margin-bottom: 0.75rem;"></i>
                    <strong style="display: block; font-size: 1.05rem; margin-bottom: 0.35rem; color: var(--text-secondary);">No hay registros de preinscripción en el sistema</strong>
                    <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">El panel ha sido limpiado o aún no se han registrado aspirantes.</p>
                    <button type="button" class="btn btn-primary btn-sm" onclick="restablecerRegistrosEjemplo()">
                        <i class="fa-solid fa-rotate-left"></i> Restablecer Registros de Demostración
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                    <i class="fa-solid fa-inbox" style="font-size: 2.2rem; color: #94a3b8; display: block; margin-bottom: 0.6rem;"></i>
                    No se encontraron preinscripciones con los criterios de búsqueda aplicados.
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtrados.forEach(r => {
        const badgeColor = {
            'APROBADA': 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;',
            'EN_REVISION': 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;',
            'DOCUMENTOS_INCOMPLETOS': 'background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;',
            'PENDIENTE': 'background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;',
            'LISTA_DE_ESPERA': 'background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe;'
        }[r.estado] || 'background: #f1f5f9; color: #475569;';

        const recaudosBadge = r.recaudosCount || '4/5';

        // Acciones: Planilla, Recaudos y Eliminar (Ver SQL y Cambiar Perfil removidos definitivamente)
        html += `
            <tr>
                <td><strong style="font-family: monospace; color: var(--fya-red);">${r.codigo}</strong></td>
                <td>
                    <div style="font-weight: 700; color: var(--text-primary);">${r.alumno}</div>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">C.I./C.E: ${r.alumnoDoc || 'S/N'}</span>
                </td>
                <td>
                    <div style="font-weight: 600;">${r.representante}</div>
                    <span style="font-size: 0.78rem; color: var(--text-muted);"><i class="fa-solid fa-phone"></i> ${r.repreTelefono || 'N/A'}</span>
                </td>
                <td>
                    <span class="badge-tag" style="background: var(--fya-red-bg); color: var(--fya-red-dark); font-size: 0.8rem; font-weight: 700;">
                        ${r.grado}
                    </span>
                </td>
                <td>
                    <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">${r.instituto || 'C.E.I. Barrio 24 de Julio'}</span><br>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${r.institutoCiudad || 'San Francisco, Zulia'}</span>
                </td>
                <td>
                    <button type="button" class="btn btn-outline-red btn-sm" onclick="abrirVerificarRecaudos('${r.codigo}')" title="Ver y Validar Recaudos" style="padding: 0.25rem 0.55rem; font-size: 0.78rem;">
                        <i class="fa-solid fa-folder-open"></i> ${recaudosBadge}
                    </button>
                </td>
                <td>
                    <select class="form-control" style="font-size: 0.78rem; font-weight: 700; padding: 0.25rem 0.5rem; ${badgeColor}" onchange="cambiarEstadoPreinscripcion('${r.codigo}', this.value)">
                        <option value="EN_REVISION" ${r.estado === 'EN_REVISION' ? 'selected' : ''}>EN REVISIÓN</option>
                        <option value="APROBADA" ${r.estado === 'APROBADA' ? 'selected' : ''}>APROBADA</option>
                        <option value="DOCUMENTOS_INCOMPLETOS" ${r.estado === 'DOCUMENTOS_INCOMPLETOS' ? 'selected' : ''}>DOCS. INCOMPLETOS</option>
                        <option value="PENDIENTE" ${r.estado === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
                        <option value="LISTA_DE_ESPERA" ${r.estado === 'LISTA_DE_ESPERA' ? 'selected' : ''}>LISTA DE ESPERA</option>
                    </select>
                </td>
                <td style="text-align: center;">
                    <div class="table-action-btn-group">
                        <button type="button" class="btn-action-icon btn-action-print" onclick="verPlanillaRegistro('${r.codigo}')" title="Ver / Imprimir Planilla Oficial">
                            <i class="fa-solid fa-print"></i> <span class="btn-action-text">Planilla</span>
                        </button>
                        <button type="button" class="btn-action-icon btn-action-docs" onclick="abrirVerificarRecaudos('${r.codigo}')" title="Verificar Recaudos">
                            <i class="fa-solid fa-folder-open"></i> <span class="btn-action-text">Recaudos</span>
                        </button>
                        <button type="button" class="btn-action-icon btn-action-delete" onclick="solicitarEliminarRegistro('${r.codigo}')" title="Eliminar Registro">
                            <i class="fa-solid fa-trash-can"></i> <span class="btn-action-text">Eliminar</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function actualizarKpisDocente() {
    const registros = AppState.registros || [];
    const total = registros.length;
    let aprobadas = 0;
    let enRevision = 0;
    let incompletos = 0;

    const gradoCount = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };

    registros.forEach(r => {
        if (r.estado === 'APROBADA') aprobadas++;
        else if (r.estado === 'EN_REVISION') enRevision++;
        else if (r.estado === 'DOCUMENTOS_INCOMPLETOS') incompletos++;

        for (let g = 1; g <= 6; g++) {
            if (r.grado && r.grado.includes(`${g}`)) {
                gradoCount[String(g)]++;
            }
        }
    });

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setT('kpiTotalPreinscritos', total);
    setT('kpiAprobadas', aprobadas);
    setT('kpiEnRevision', enRevision);
    setT('kpiDocsIncompletos', incompletos);

    for (let g = 1; g <= 6; g++) {
        setT(`kpiGrado${g}`, gradoCount[String(g)]);
        setT(`pillCount${g}`, gradoCount[String(g)]);
    }
    setT('pillCountTodos', total);
}

window.filtrarDocentePorGradoPill = function(gradoNombre) {
    AppState.filtroGradoActivo = gradoNombre;
    const sel = document.getElementById('filtroDocenteGrado');
    if (sel) sel.value = gradoNombre;

    document.querySelectorAll('.grade-pill-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.grado-kpi-card').forEach(card => card.classList.remove('active'));

    if (!gradoNombre) {
        document.getElementById('pillGradoTodos')?.classList.add('active');
    } else {
        const num = gradoNombre.match(/\d/)?.[0];
        if (num) {
            document.getElementById(`pillGrado${num}`)?.classList.add('active');
            document.getElementById(`cardGrado${num}`)?.classList.add('active');
        }
    }

    filtrarYRenderizarPanelDocente();
};

window.cambiarEstadoPreinscripcion = async function(codigo, nuevoEstado) {
    const reg = (AppState.registros || []).find(r => r.codigo === codigo);
    if (reg) {
        reg.estado = nuevoEstado;
        localStorage.setItem('fya_preinscripciones_db', JSON.stringify(AppState.registros));
        actualizarKpisDocente();
        mostrarToast('Estado Actualizado', `Solicitud ${codigo} actualizada a ${nuevoEstado}.`);

        // Sincronizar cambio en la nube
        try {
            await fetch(`/api/preinscripciones/${encodeURIComponent(codigo)}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
        } catch (e) {
            console.warn('[Cloud Sync Estado Warning]', e.message);
        }
    }
};

window.verPlanillaRegistro = function(codigo) {
    const reg = (AppState.registros || []).find(r => r.codigo === codigo);
    if (reg) {
        // Cerrar modal de historial para aislar estrictamente la planilla del momento
        cerrarModal('modalHistorialBackdrop');
        sincronizarDatosPlanillaDesdeRegistro(reg);
        abrirModal('modalPlanillaBackdrop');
    }
};

window.solicitarEliminarRegistro = function(codigo) {
    const reg = (AppState.registros || []).find(r => r.codigo === codigo);
    if (!reg) return;

    AppState.registroAEliminar = codigo;
    const tit = document.getElementById('tituloConfirmarEliminar');
    const desc = document.getElementById('descConfirmarEliminar');
    const det = document.getElementById('detalleRegistroEliminar');

    if (tit) tit.textContent = '¿Eliminar preinscripción en la Nube?';
    if (desc) desc.textContent = 'Esta acción removerá el expediente del alumno del sistema en la nube de Railway.';
    if (det) {
        det.innerHTML = `
            <strong>Aspirante:</strong> ${reg.alumno}<br>
            <strong>Folio:</strong> <code style="font-weight: bold; font-size: 0.95rem;">${reg.codigo}</code> &nbsp;|&nbsp; <strong>Grado:</strong> ${reg.grado}<br>
            <strong>Representante:</strong> ${reg.representante} (${reg.repreDoc || 'S/N'})
        `;
    }

    abrirModal('modalConfirmarEliminarBackdrop');
};

window.solicitarLimpiarTodosRegistros = function() {
    if (!AppState.registros || AppState.registros.length === 0) {
        mostrarToast('Sin Registros', 'No hay registros de preinscripción para limpiar.', 'info');
        return;
    }

    AppState.registroAEliminar = '__ALL__';
    const tit = document.getElementById('tituloConfirmarEliminar');
    const desc = document.getElementById('descConfirmarEliminar');
    const det = document.getElementById('detalleRegistroEliminar');

    if (tit) tit.textContent = '¿Vaciar todos los registros en la Nube?';
    if (desc) desc.textContent = 'Se eliminarán permanentemente todas las preinscripciones almacenadas en la nube de Railway para todos los usuarios.';
    if (det) {
        det.innerHTML = `<strong>Total a eliminar en la nube:</strong> ${AppState.registros.length} expedientes de preinscripción.`;
    }

    abrirModal('modalConfirmarEliminarBackdrop');
};

window.ejecutarEliminarRegistro = async function() {
    if (!AppState.registroAEliminar) {
        cerrarModal('modalConfirmarEliminarBackdrop');
        return;
    }

    const esLimpiarTodos = AppState.registroAEliminar === '__ALL__';
    const codigo = AppState.registroAEliminar;

    cerrarModal('modalConfirmarEliminarBackdrop');
    mostrarToast('Procesando...', esLimpiarTodos ? 'Limpiando todos los registros en la nube...' : `Eliminando folio ${codigo} en la nube...`, 'info');

    try {
        if (esLimpiarTodos) {
            const res = await fetch('/api/preinscripciones', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || 'Error en el servidor');

            AppState.registros = [];
            localStorage.setItem('fya_preinscripciones_db', JSON.stringify([]));
            recalcularCorrelativo();
            mostrarToast('Nube Limpiada', 'Todos los registros han sido eliminados de la nube satisfactoriamente.', 'success');
        } else {
            const res = await fetch(`/api/preinscripciones/${encodeURIComponent(codigo)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || 'Error en el servidor');

            AppState.registros = (AppState.registros || []).filter(r => r.codigo !== codigo);
            localStorage.setItem('fya_preinscripciones_db', JSON.stringify(AppState.registros));
            recalcularCorrelativo();
            mostrarToast('Registro Eliminado', `El folio ${codigo} ha sido eliminado satisfactoriamente de la nube.`, 'success');
        }
    } catch (err) {
        console.error('[Eliminar Error]', err);
        if (esLimpiarTodos) {
            AppState.registros = [];
            localStorage.setItem('fya_preinscripciones_db', JSON.stringify([]));
            recalcularCorrelativo();
            mostrarToast('Limpiado Localmente', 'No se pudo contactar el servidor en la nube; registros limpiados localmente.', 'warning');
        } else {
            AppState.registros = (AppState.registros || []).filter(r => r.codigo !== codigo);
            localStorage.setItem('fya_preinscripciones_db', JSON.stringify(AppState.registros));
            recalcularCorrelativo();
            mostrarToast('Eliminado Localmente', `El folio ${codigo} ha sido eliminado localmente.`, 'warning');
        }
    } finally {
        AppState.registroAEliminar = null;
        actualizarBadges();
        actualizarKpisDocente();
        filtrarYRenderizarPanelDocente();
        filtrarYRenderizarHistorial();
    }
};

window.restablecerRegistrosEjemplo = async function() {
    mostrarToast('Restableciendo...', 'Recuperando registros iniciales de demostración en la nube...', 'info');
    try {
        const res = await fetch('/api/preinscripciones/restablecer', { method: 'POST' });
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data)) {
            AppState.registros = json.data;
            localStorage.setItem('fya_preinscripciones_db', JSON.stringify(AppState.registros));
            recalcularCorrelativo();
            actualizarBadges();
            actualizarKpisDocente();
            filtrarYRenderizarPanelDocente();
            filtrarYRenderizarHistorial();
            mostrarToast('Datos Restaurados en la Nube', 'Se han restablecido los registros de demostración iniciales en línea.', 'success');
            return;
        }
    } catch (e) {
        console.warn('[Restablecer fallback local]', e.message);
    }
    // Fallback local
    localStorage.removeItem('fya_preinscripciones_db');
    AppState.registros = null;
    cargarRegistroSemillaSiVacio();
    recalcularCorrelativo();
    actualizarBadges();
    actualizarKpisDocente();
    filtrarYRenderizarPanelDocente();
    filtrarYRenderizarHistorial();
    mostrarToast('Datos Restaurados', 'Se han restablecido los registros de demostración iniciales.');
};

/* ==============================================================================
   12. VER PLANILLAS (HISTORIAL EXCLUSIVO DE DOCENTE)
   ============================================================================== */
function abrirHistorialDocente() {
    if (AppState.rol !== 'docente' || !AppState.docenteAutenticado) {
        window.location.href = 'docente-login.html';
        return;
    }
    filtrarYRenderizarHistorial();
    abrirModal('modalHistorialBackdrop');
}

function filtrarYRenderizarHistorial() {
    const tbody = document.getElementById('historialTableBody');
    if (!tbody) return;

    const texto = (document.getElementById('filtroHistorialBusqueda')?.value || '').trim().toLowerCase();
    const gradoFiltro = document.getElementById('filtroHistorialGrado')?.value || '';
    const estadoFiltro = document.getElementById('filtroHistorialEstado')?.value || '';

    const registros = AppState.registros || [];
    const filtrados = registros.filter(r => {
        const matchTexto = !texto ||
            (r.alumno && r.alumno.toLowerCase().includes(texto)) ||
            (r.codigo && r.codigo.toLowerCase().includes(texto)) ||
            (r.alumnoDoc && r.alumnoDoc.toLowerCase().includes(texto)) ||
            (r.representante && r.representante.toLowerCase().includes(texto)) ||
            (r.repreDoc && r.repreDoc.toLowerCase().includes(texto));

        const matchGrado = !gradoFiltro || (r.grado && r.grado.includes(gradoFiltro));
        const matchEstado = !estadoFiltro || r.estado === estadoFiltro;

        return matchTexto && matchGrado && matchEstado;
    });

    const countElem = document.getElementById('historialResultsCount');
    if (countElem) {
        countElem.textContent = `Mostrando ${filtrados.length} de ${registros.length} planillas registradas.`;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="fa-solid fa-search" style="font-size: 1.8rem; color: #94a3b8; display: block; margin-bottom: 0.5rem;"></i>
                    No se encontraron planillas con los filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtrados.forEach(r => {
        const badgeColor = {
            'APROBADA': 'background: #dcfce7; color: #15803d;',
            'EN_REVISION': 'background: #fef3c7; color: #b45309;',
            'DOCUMENTOS_INCOMPLETOS': 'background: #fee2e2; color: #b91c1c;',
            'PENDIENTE': 'background: #f1f5f9; color: #475569;',
            'LISTA_DE_ESPERA': 'background: #ede9fe; color: #6d28d9;'
        }[r.estado] || 'background: #f1f5f9; color: #475569;';

        html += `
            <tr>
                <td><strong style="font-family: monospace; color: var(--fya-red);">${r.codigo}</strong></td>
                <td>
                    <div style="font-weight: 700; color: var(--text-primary);">${r.alumno}</div>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${r.alumnoDoc || ''}</span>
                </td>
                <td>
                    <div style="font-weight: 600;">${r.representante}</div>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${r.repreTelefono || ''}</span>
                </td>
                <td><span class="badge-tag" style="background: var(--fya-red-bg); color: var(--fya-red-dark); font-size: 0.78rem;">${r.grado}</span></td>
                <td>
                    <span class="badge-tag" style="background: #e0f2fe; color: #0284c7; font-size: 0.78rem;">
                        <i class="fa-solid fa-folder"></i> ${r.recaudosCount || '4/5'}
                    </span>
                </td>
                <td>
                    <span style="font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 999px; ${badgeColor}">
                        ${r.estado}
                    </span>
                </td>
                <td style="text-align: center;">
                    <div class="table-action-btn-group">
                        <button type="button" class="btn-action-icon btn-action-print" onclick="verPlanillaRegistro('${r.codigo}')" style="padding: 0.28rem 0.6rem; font-size: 0.8rem;" title="Ver e Imprimir Planilla">
                            <i class="fa-solid fa-print"></i> <span class="btn-action-text">Planilla</span>
                        </button>
                        <button type="button" class="btn-action-icon btn-action-docs" onclick="abrirVerificarRecaudos('${r.codigo}')" style="padding: 0.28rem 0.6rem; font-size: 0.8rem;" title="Verificar Recaudos">
                            <i class="fa-solid fa-folder-open"></i> <span class="btn-action-text">Recaudos</span>
                        </button>
                        <button type="button" class="btn-action-icon btn-action-delete" onclick="solicitarEliminarRegistro('${r.codigo}')" style="padding: 0.28rem 0.6rem; font-size: 0.8rem;" title="Eliminar Registro">
                            <i class="fa-solid fa-trash-can"></i> <span class="btn-action-text">Eliminar</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/* ==============================================================================
   13. ENVÍO DEL FORMULARIO Y GUARDADO EN MYSQL & LOCALSTORAGE
   ============================================================================== */
async function manejarEnvioPreinscripcion(e) {
    e.preventDefault();

    // Validar rigurosamente los 5 pasos consecutivos
    for (let p = 1; p <= 5; p++) {
        if (!validarPaso(p)) {
            irAlPaso(p);
            return;
        }
    }

    const codSol = document.getElementById('inputCodigoPre')?.value || 'PRE-2026-0001';
    const alNom = `${document.getElementById('alumnoNombres')?.value || ''} ${document.getElementById('alumnoApellidos')?.value || ''}`.trim();
    const repNom = `${document.getElementById('repreNombres')?.value || ''} ${document.getElementById('repreApellidos')?.value || ''}`.trim();
    const selectG = document.getElementById('selectGrado');
    const gradoNom = selectG?.options[selectG.selectedIndex]?.text || '1er Grado de Educación Primaria';
    const gradoVal = selectG?.value || '1';

    let est = 'EN_REVISION';
    let opNombre = 'Control de Estudios';
    let idUser = '1';

    if (AppState.rol === 'docente') {
        est = document.getElementById('selectEstadoPre')?.value || 'EN_REVISION';
        const selOp = document.getElementById('selectUsuarioAuditor');
        opNombre = selOp ? selOp.options[selOp.selectedIndex].text : 'Control de Estudios (Admin)';
        idUser = selOp ? selOp.value : '1';
    }

    const docEstados = {};
    let recaudosEntregados = 0;
    ['1', '2', '3', '4', '5'].forEach(id => {
        const el = document.getElementById(`estadoDoc${id}`);
        const tieneArch = Boolean(AppState.archivosCargados[id]);
        const val = el ? el.value : (tieneArch ? 'CONSIGNADO' : 'NO_CONSIGNADO');
        docEstados[id] = val;
        if (val === 'APROBADO' || val === 'CONSIGNADO' || tieneArch) {
            recaudosEntregados++;
        }
    });

    const registro = {
        codigo: codSol,
        alumno: alNom,
        alumnoDoc: `${document.getElementById('alumnoTipoDoc')?.value}-${document.getElementById('alumnoNumDoc')?.value}`,
        alumnoFechaNac: document.getElementById('alumnoFechaNac')?.value,
        alumnoGenero: document.getElementById('alumnoGenero')?.value,
        alumnoSangre: document.getElementById('alumnoTipoSangre')?.value,
        alumnoLugarNac: document.getElementById('alumnoLugarNac')?.value || 'San Francisco, Edo. Zulia',
        alumnoViveCon: document.getElementById('alumnoViveCon')?.value,
        alumnoDireccion: document.getElementById('alumnoDireccion')?.value,
        alumnoAlergias: document.getElementById('alumnoAlergias')?.value,
        representante: repNom,
        repreDoc: `${document.getElementById('repreTipoDoc')?.value}-${document.getElementById('repreNumDoc')?.value}`,
        repreParentesco: document.getElementById('repreParentesco')?.value,
        repreTelefono: document.getElementById('repreTelefono')?.value,
        repreCorreo: document.getElementById('repreCorreo')?.value,
        repreOcupacion: document.getElementById('repreOcupacion')?.value,
        repreDireccion: document.getElementById('repreDireccion')?.value,
        instituto: document.getElementById('chkPrimerIngreso')?.checked ? 'Primer Ingreso' : document.getElementById('institutoNombre')?.value,
        institutoCodigo: document.getElementById('chkPrimerIngreso')?.checked ? 'N/A' : document.getElementById('institutoCodigo')?.value,
        institutoTipo: document.getElementById('institutoTipo')?.value,
        institutoCiudad: document.getElementById('institutoCiudad')?.value || 'San Francisco, Edo. Zulia',
        grado: gradoNom,
        gradoId: gradoVal,
        estado: est,
        periodo: '2026-2027',
        operador: opNombre,
        idUser: idUser,
        documentos: docEstados,
        archivos: { ...AppState.archivosCargados },
        recaudosCount: `${recaudosEntregados}/5`,
        fecha: new Date().toLocaleDateString('es-VE')
    };

    // Control Estricto Anti-Duplicados y Deduplicación por Cédula del Alumno
    const numDocAlumno = (document.getElementById('alumnoNumDoc')?.value || '').trim();
    const tipoDocAlumno = (document.getElementById('alumnoTipoDoc')?.value || 'CE').trim();
    const docAlumnoClave = `${tipoDocAlumno}-${numDocAlumno}`;

    if (!Array.isArray(AppState.registros)) {
        AppState.registros = [];
    }

    // Consultar si ya existe una preinscripción previa con la misma cédula
    const indiceDuplicado = AppState.registros.findIndex(r => {
        if (!r) return false;
        const rDoc = (r.alumnoDoc || '').replace(/\s+/g, '').toUpperCase();
        const rNum = (rDoc.split('-')[1] || rDoc).trim();
        return rDoc === docAlumnoClave.toUpperCase() || rNum === numDocAlumno.toUpperCase();
    });

    let esActualizacion = false;
    let folioAsignado = codSol;

    if (indiceDuplicado !== -1) {
        // Deduplicación automática: eliminar registro duplicado previo y conservar únicamente el nuevo registro depurado
        const registroPrevio = AppState.registros[indiceDuplicado];
        folioAsignado = registroPrevio.codigo || codSol;
        AppState.registros.splice(indiceDuplicado, 1);
        esActualizacion = true;
    }

    registro.codigo = folioAsignado;

    // 1. Guardar registro limpio en almacenamiento local
    AppState.registros.unshift(registro);
    localStorage.setItem('fya_preinscripciones_db', JSON.stringify(AppState.registros));
    localStorage.removeItem('fya_preinscripcion_draft'); // Limpiar borrador

    // 2. Guardar y sincronizar con la nube (Railway)
    await enviarPreinscripcionALaNube(registro);

    if (!esActualizacion) {
        recalcularCorrelativo();
    }

    actualizarBadges();
    if (AppState.rol === 'docente') {
        actualizarKpisDocente();
    }

    // Notificación visual clara según el estado del trámite
    if (esActualizacion) {
        mostrarToast(
            'Expediente Actualizado en la Nube',
            `El aspirante ya se encontraba registrado; se ha actualizado su expediente en línea (Folio: ${folioAsignado}).`,
            'info'
        );
    } else {
        mostrarToast(
            'Preinscripción Guardada en la Nube',
            `La solicitud ${folioAsignado} para ${gradoNom} fue registrada exitosamente en línea.`,
            'success'
        );
    }

    // Generar marca temporal de emisión en la planilla
    actualizarTimestampEmision();

    // Sincronizar todos los datos de la solicitud en la planilla oficial antes de descargar
    sincronizarDatosPlanilla();

    // Generar y descargar automáticamente el archivo PDF nombrado Planilla_Preinscripcion_[CEDULA].pdf
    await generarYDescargarPdfPlanilla(numDocAlumno || folioAsignado);
}

async function enviarPreinscripcionALaNube(registro) {
    try {
        actualizarIndicadorNube('syncing');
        const res = await fetch('/api/preinscripciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registro)
        });

        if (res.ok) {
            const data = await res.json();
            console.log('[Cloud Sync] Preinscripción sincronizada con éxito en la nube:', data);
            actualizarIndicadorNube('online');
            return true;
        } else {
            console.warn('[Cloud Sync] Servidor respondió con estado:', res.status);
            actualizarIndicadorNube('offline', 'Modo Local');
            return false;
        }
    } catch (err) {
        console.warn('[Cloud Sync] Servidor no accesible en este momento; registro persistido localmente.', err.message);
        actualizarIndicadorNube('offline', 'Modo Local');
        return false;
    }
}

function actualizarBadges() {
    const total = AppState.registros ? AppState.registros.length : 0;
    const b = document.getElementById('totalRegistrosBadge');
    if (b) b.textContent = total;
    document.querySelectorAll('.sidebar-badge-count').forEach(el => el.textContent = total);
}

function actualizarResumenGrado() {
    const select = document.getElementById('selectGrado');
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    const nombre = opt ? opt.text : '1er Grado de Educación Primaria';
    const resumen = document.getElementById('resumenNombreGrado');
    if (resumen) resumen.textContent = nombre;
}

/* ==============================================================================
   14. DATOS SEMILLA DE EJEMPLO (MUNICIPIO SAN FRANCISCO, ZULIA)
   ============================================================================== */
function cargarRegistroSemillaSiVacio() {
    if (!AppState.registros || AppState.registros.length === 0) {
        AppState.registros = [
            {
                codigo: 'PRE-2026-0001',
                alumno: 'Jesús David Gómez Blanco',
                alumnoDoc: 'CE-120555666',
                alumnoFechaNac: '2020-03-12',
                alumnoGenero: 'MASCULINO',
                alumnoSangre: 'O+',
                alumnoLugarNac: 'San Francisco, Edo. Zulia',
                alumnoViveCon: 'Ambos Padres',
                alumnoDireccion: 'Barrio 24 de Julio, Av. 49B entre Calles 176 y 177, San Francisco, Edo. Zulia',
                alumnoAlergias: 'Ninguna conocida / Sin alergias',
                representante: 'Carmen Elena Blanco de Gómez',
                repreDoc: 'V-19888777',
                repreParentesco: 'MADRE',
                repreTelefono: '0414-6309876',
                repreCorreo: 'carmen.blanco@correo.com',
                repreOcupacion: 'Comerciante / Emprendedora',
                repreDireccion: 'Barrio 24 de Julio, Av. 49B entre Calles 176 y 177, San Francisco, Edo. Zulia',
                instituto: 'C.E.I. Barrio 24 de Julio',
                institutoCodigo: 'DEA-CEI-24J',
                institutoTipo: 'PUBLICA',
                institutoCiudad: 'San Francisco, Edo. Zulia',
                grado: '1er Grado de Educación Primaria',
                gradoId: '1',
                estado: 'EN_REVISION',
                periodo: '2026-2027',
                operador: 'Control de Estudios (Admin)',
                idUser: '1',
                documentos: { '1': 'APROBADO', '2': 'APROBADO', '3': 'CONSIGNADO', '4': 'CONSIGNADO', '5': 'NO_CONSIGNADO' },
                recaudosCount: '4/5',
                fecha: '08/10/2026'
            },
            {
                codigo: 'PRE-2026-0002',
                alumno: 'Sofia Valentina Rincón Morales',
                alumnoDoc: 'CE-121888333',
                alumnoFechaNac: '2019-06-25',
                alumnoGenero: 'FEMENINO',
                alumnoSangre: 'A+',
                alumnoLugarNac: 'San Francisco, Edo. Zulia',
                alumnoViveCon: 'Madre',
                alumnoDireccion: 'Urb. Coromoto, Calle 171, San Francisco, Edo. Zulia',
                alumnoAlergias: 'Ninguna',
                representante: 'Carlos Eduardo Rincón',
                repreDoc: 'V-18456123',
                repreParentesco: 'PADRE',
                repreTelefono: '0424-6123456',
                repreCorreo: 'carlos.rincon@gmail.com',
                repreOcupacion: 'Ingeniero en Computación',
                repreDireccion: 'Urb. Coromoto, Calle 171, San Francisco, Edo. Zulia',
                instituto: 'U.E. Fe y Alegría La Chinita',
                institutoCodigo: 'DEA-FYA-CHINITA',
                institutoTipo: 'SUBVENCIONADA_FE_Y_ALEGRIA',
                institutoCiudad: 'San Francisco, Edo. Zulia',
                grado: '2do Grado de Educación Primaria',
                gradoId: '2',
                estado: 'APROBADA',
                periodo: '2026-2027',
                operador: 'Secretaría Académica',
                idUser: '2',
                documentos: { '1': 'APROBADO', '2': 'APROBADO', '3': 'APROBADO', '4': 'APROBADO', '5': 'APROBADO' },
                recaudosCount: '5/5',
                fecha: '08/10/2026'
            },
            {
                codigo: 'PRE-2026-0003',
                alumno: 'Mathias Alejandro Urdaneta Soto',
                alumnoDoc: 'CE-122999111',
                alumnoFechaNac: '2018-11-04',
                alumnoGenero: 'MASCULINO',
                alumnoSangre: 'O+',
                alumnoLugarNac: 'Maracaibo, Edo. Zulia',
                alumnoViveCon: 'Ambos Padres',
                alumnoDireccion: 'Sector El Manzanillo, Av. 5, Casa 22, San Francisco, Edo. Zulia',
                alumnoAlergias: 'Rinitis alérgica',
                representante: 'Mariángel Soto de Urdaneta',
                repreDoc: 'V-20112345',
                repreParentesco: 'MADRE',
                repreTelefono: '0412-5554321',
                repreCorreo: 'mariangel.soto@hotmail.com',
                repreOcupacion: 'Docente de Preescolar',
                repreDireccion: 'Sector El Manzanillo, Av. 5, Casa 22, San Francisco, Edo. Zulia',
                instituto: 'C.E.I. Simoncito El Manzanillo',
                institutoCodigo: 'DEA-SIM-MANZ',
                institutoTipo: 'PUBLICA',
                institutoCiudad: 'San Francisco, Edo. Zulia',
                grado: '3er Grado de Educación Primaria',
                gradoId: '3',
                estado: 'DOCUMENTOS_INCOMPLETOS',
                periodo: '2026-2027',
                operador: 'Control de Estudios (Admin)',
                idUser: '1',
                documentos: { '1': 'APROBADO', '2': 'APROBADO', '3': 'NO_CONSIGNADO', '4': 'CONSIGNADO', '5': 'NO_CONSIGNADO' },
                recaudosCount: '3/5',
                fecha: '08/10/2026'
            },
            {
                codigo: 'PRE-2026-0004',
                alumno: 'Isabella Coromoto Villalobos Pineda',
                alumnoDoc: 'CE-123444555',
                alumnoFechaNac: '2016-08-19',
                alumnoGenero: 'FEMENINO',
                alumnoSangre: 'B+',
                alumnoLugarNac: 'Maracaibo, Edo. Zulia',
                alumnoViveCon: 'Ambos Padres',
                alumnoDireccion: 'Sector Los Cortijos, San Francisco, Edo. Zulia',
                alumnoAlergias: 'Ninguna',
                representante: 'Roberto José Villalobos',
                repreDoc: 'V-17890123',
                repreParentesco: 'PADRE',
                repreTelefono: '0416-7890123',
                repreCorreo: 'roberto.villalobos@outlook.com',
                repreOcupacion: 'Técnico Electricista',
                repreDireccion: 'Sector Los Cortijos, San Francisco, Edo. Zulia',
                instituto: 'Colegio San Vicente de Paúl',
                institutoCodigo: 'DEA-COL-SVP',
                institutoTipo: 'PRIVADA',
                institutoCiudad: 'Maracaibo, Edo. Zulia',
                grado: '5to Grado de Educación Primaria',
                gradoId: '5',
                estado: 'APROBADA',
                periodo: '2026-2027',
                operador: 'Control de Estudios (Admin)',
                idUser: '1',
                documentos: { '1': 'APROBADO', '2': 'APROBADO', '3': 'APROBADO', '4': 'APROBADO', '5': 'APROBADO' },
                recaudosCount: '5/5',
                fecha: '08/10/2026'
            }
        ];
        localStorage.setItem('fya_preinscripciones_db', JSON.stringify(AppState.registros));
    }
}

function cargarAspiranteEjemplo() {
    // Alumno
    document.getElementById('alumnoTipoDoc').value = 'CE';
    document.getElementById('alumnoNumDoc').value = '120555666';
    document.getElementById('alumnoNombres').value = 'Jesús David';
    document.getElementById('alumnoApellidos').value = 'Gómez Blanco';
    document.getElementById('alumnoFechaNac').value = '2020-03-12';
    document.getElementById('alumnoGenero').value = 'MASCULINO';
    document.getElementById('alumnoTipoSangre').value = 'O+';
    document.getElementById('alumnoLugarNac').value = 'San Francisco, Edo. Zulia';
    document.getElementById('alumnoViveCon').value = 'AMBOS_PADRES';
    document.getElementById('alumnoDireccion').value = 'Barrio 24 de Julio, Av. 49B entre Calles 176 y 177, San Francisco, Edo. Zulia';
    document.getElementById('alumnoAlergias').value = 'Ninguna conocida / Sin alergias';

    // Representante
    document.getElementById('repreTipoDoc').value = 'V';
    document.getElementById('repreNumDoc').value = '19888777';
    document.getElementById('repreParentesco').value = 'MADRE';
    document.getElementById('repreNombres').value = 'Carmen Elena';
    document.getElementById('repreApellidos').value = 'Blanco de Gómez';
    document.getElementById('repreTelefono').value = '0414-6309876';
    document.getElementById('repreCorreo').value = 'carmen.blanco@correo.com';
    document.getElementById('repreOcupacion').value = 'Comerciante / Emprendedora';
    document.getElementById('repreLugarTrabajo').value = 'Sector San Francisco Centro';
    document.getElementById('repreDireccion').value = 'Barrio 24 de Julio, Av. 49B entre Calles 176 y 177, San Francisco, Edo. Zulia';

    // Instituto de Procedencia
    document.getElementById('chkPrimerIngreso').checked = false;
    const instWrapper = document.getElementById('institutoFieldsWrapper');
    if (instWrapper) {
        instWrapper.style.opacity = '1';
        instWrapper.style.pointerEvents = 'auto';
    }
    document.getElementById('institutoNombre').value = 'C.E.I. Barrio 24 de Julio';
    document.getElementById('institutoCodigo').value = 'DEA-CEI-24J';
    document.getElementById('institutoTipo').value = 'PUBLICA';
    document.getElementById('institutoCiudad').value = 'San Francisco, Edo. Zulia';

    // Grado Primaria
    document.getElementById('selectGrado').value = '1';
    actualizarResumenGrado();

    // Recaudos
    document.getElementById('estadoDoc1').value = 'APROBADO';
    document.getElementById('estadoDoc2').value = 'APROBADO';
    document.getElementById('estadoDoc3').value = 'CONSIGNADO';
    document.getElementById('estadoDoc4').value = 'CONSIGNADO';
    document.getElementById('estadoDoc5').value = 'CONSIGNADO';

    document.querySelectorAll('.input-invalid').forEach(el => el.classList.remove('input-invalid'));
    actualizarEstadoBotonImprimir();
    mostrarToast('Ejemplo Cargado', 'Formulario autocompletado con aspirante para 1er Grado (San Francisco, Zulia).');
}

/* ==============================================================================
   15. EVENTOS GENERALES & MODALES
   ============================================================================== */
function initEventListeners() {
    // Enlaces de Navegación de Barra Lateral
    const linkLlenar = document.getElementById('sidebarLinkLlenarPlanilla');
    if (linkLlenar) linkLlenar.addEventListener('click', mostrarFormularioDesdeSidebar);

    const linkPanel = document.getElementById('sidebarLinkPanelDocente');
    if (linkPanel) linkPanel.addEventListener('click', mostrarPanelDocenteDesdeSidebar);

    const linkVerPlanillas = document.getElementById('sidebarLinkVerPlanillas');
    if (linkVerPlanillas) linkVerPlanillas.addEventListener('click', abrirHistorialDocenteDesdeSidebar);

    // Si imprime desde el botón de la vista previa, también activar el flujo para mostrar el modal de finalización
    const btnPrintPlanillaModal = document.querySelector('#modalPlanillaBackdrop button[onclick="window.print()"]');
    if (btnPrintPlanillaModal) {
        btnPrintPlanillaModal.addEventListener('click', () => {
            AppState.flujoImpresionPendiente = true;
        });
    }

    // Botón "Vista Previa": Realiza el mapeo inmediato de los datos del formulario a '#planilla-oficial' y abre la previsualización
    const btnGenerarPlanilla = document.getElementById('btnGenerarPlanilla');
    if (btnGenerarPlanilla) {
        btnGenerarPlanilla.addEventListener('click', () => {
            sincronizarDatosPlanilla();
            abrirModal('modalPlanillaBackdrop');
        });
    }

    // Rutina de sincronización en tiempo real para mantener actualizada la planilla oficial al teclear
    const formElem = document.getElementById('preinscripcionForm');
    if (formElem) {
        formElem.addEventListener('input', () => {
            sincronizarDatosPlanilla();
        });
        formElem.addEventListener('change', () => {
            sincronizarDatosPlanilla();
        });
    }

    const btnCerrarPlanillaModal = document.getElementById('btnCerrarPlanillaModal');
    if (btnCerrarPlanillaModal) {
        btnCerrarPlanillaModal.addEventListener('click', () => cerrarModal('modalPlanillaBackdrop'));
    }

    // Modal Historial
    const btnVerHistorial = document.getElementById('btnVerHistorial');
    if (btnVerHistorial) btnVerHistorial.addEventListener('click', abrirHistorialDocente);

    const btnCerrarHistorial = document.getElementById('btnCerrarHistorial');
    const btnCerrarHistorialModal = document.getElementById('btnCerrarHistorialModal');
    if (btnCerrarHistorial) btnCerrarHistorial.addEventListener('click', () => cerrarModal('modalHistorialBackdrop'));
    if (btnCerrarHistorialModal) btnCerrarHistorialModal.addEventListener('click', () => cerrarModal('modalHistorialBackdrop'));

    // Modal Eliminar
    const btnCerrarModalEliminar = document.getElementById('btnCerrarModalEliminar');
    const btnCancelarEliminar = document.getElementById('btnCancelarEliminar');
    const btnConfirmarEliminar = document.getElementById('btnConfirmarEliminarAccion');
    if (btnCerrarModalEliminar) btnCerrarModalEliminar.addEventListener('click', () => cerrarModal('modalConfirmarEliminarBackdrop'));
    if (btnCancelarEliminar) btnCancelarEliminar.addEventListener('click', () => cerrarModal('modalConfirmarEliminarBackdrop'));
    if (btnConfirmarEliminar) btnConfirmarEliminar.addEventListener('click', ejecutarEliminarRegistro);

    // Modal Verificar Recaudos
    const btnCerrarVerificarModal = document.getElementById('btnCerrarVerificarRecaudosModal');
    const btnCerrarVerificar = document.getElementById('btnCerrarVerificarRecaudos');
    if (btnCerrarVerificarModal) btnCerrarVerificarModal.addEventListener('click', () => cerrarModal('modalVerificarRecaudosBackdrop'));
    if (btnCerrarVerificar) btnCerrarVerificar.addEventListener('click', () => cerrarModal('modalVerificarRecaudosBackdrop'));

    // Modal Preview Doc
    const btnCerrarPrevModal = document.getElementById('btnCerrarPreviewDocModal');
    const btnCerrarPrev = document.getElementById('btnCerrarPreviewDoc');
    if (btnCerrarPrevModal) btnCerrarPrevModal.addEventListener('click', () => cerrarModal('modalPreviewDocBackdrop'));
    if (btnCerrarPrev) btnCerrarPrev.addEventListener('click', () => cerrarModal('modalPreviewDocBackdrop'));

    // Checkbox Misma Dirección
    const chkMismaDir = document.getElementById('chkMismaDireccion');
    if (chkMismaDir) {
        chkMismaDir.addEventListener('change', (e) => {
            const dirAlumno = document.getElementById('alumnoDireccion')?.value;
            const dirRepre = document.getElementById('repreDireccion');
            if (e.target.checked && dirAlumno && dirRepre) {
                dirRepre.value = dirAlumno;
                dirRepre.classList.remove('input-invalid');
                actualizarEstadoBotonImprimir();
            }
        });
    }

    // Checkbox Primer Ingreso
    const chkPrimerIngreso = document.getElementById('chkPrimerIngreso');
    const instWrapper = document.getElementById('institutoFieldsWrapper');
    if (chkPrimerIngreso && instWrapper) {
        chkPrimerIngreso.addEventListener('change', (e) => {
            const instNombre = document.getElementById('institutoNombre');
            const instCodigo = document.getElementById('institutoCodigo');
            if (e.target.checked) {
                instWrapper.style.opacity = '0.4';
                instWrapper.style.pointerEvents = 'none';
                if (instNombre) { instNombre.value = 'Primer Ingreso (Sin Plantel Anterior)'; instNombre.classList.remove('input-invalid'); }
                if (instCodigo) instCodigo.value = 'S/N';
            } else {
                instWrapper.style.opacity = '1';
                instWrapper.style.pointerEvents = 'auto';
                if (instNombre) instNombre.value = 'C.E.I. Barrio 24 de Julio';
                if (instCodigo) instCodigo.value = 'DEA-CEI-24J';
            }
        });
    }

    // Selector de Grado
    const selectGrado = document.getElementById('selectGrado');
    if (selectGrado) {
        selectGrado.addEventListener('change', () => {
            actualizarResumenGrado();
            actualizarEstadoBotonImprimir();
        });
    }

    // Botón Llenar Ejemplo
    const btnCargarEjemplo = document.getElementById('btnCargarEjemplo');
    if (btnCargarEjemplo) btnCargarEjemplo.addEventListener('click', cargarAspiranteEjemplo);

    // Botones de acción Docente
    const btnIrNuevaPre = document.getElementById('btnIrNuevaPreinscripcionDocente');
    if (btnIrNuevaPre) btnIrNuevaPre.addEventListener('click', mostrarFormularioEnModoDocente);

    const btnVolverPanel = document.getElementById('btnVolverAlPanelDocente');
    if (btnVolverPanel) btnVolverPanel.addEventListener('click', mostrarPanelDocente);

    const btnCerrarSesionBanner = document.getElementById('btnCerrarSesionDocenteBanner');
    if (btnCerrarSesionBanner) btnCerrarSesionBanner.addEventListener('click', cerrarSesionDocente);

    const btnLimpiarTodos = document.getElementById('btnLimpiarTodosRegistros');
    if (btnLimpiarTodos) btnLimpiarTodos.addEventListener('click', solicitarLimpiarTodosRegistros);

    const btnResetFiltros = document.getElementById('btnResetDocenteFiltros');
    if (btnResetFiltros) {
        btnResetFiltros.addEventListener('click', () => {
            const inBus = document.getElementById('filtroDocenteBusqueda');
            const sGrado = document.getElementById('filtroDocenteGrado');
            const sEst = document.getElementById('filtroDocenteEstado');
            if (inBus) inBus.value = '';
            if (sGrado) sGrado.value = '';
            if (sEst) sEst.value = '';
            filtrarDocentePorGradoPill('');
        });
    }

    // Filtros Historial Modal
    const fHistBus = document.getElementById('filtroHistorialBusqueda');
    if (fHistBus) fHistBus.addEventListener('input', filtrarYRenderizarHistorial);
    const fHistGra = document.getElementById('filtroHistorialGrado');
    if (fHistGra) fHistGra.addEventListener('change', filtrarYRenderizarHistorial);
    const fHistEst = document.getElementById('filtroHistorialEstado');
    if (fHistEst) fHistEst.addEventListener('change', filtrarYRenderizarHistorial);
    const btnResetHist = document.getElementById('btnResetHistorialFiltros');
    if (btnResetHist) {
        btnResetHist.addEventListener('click', () => {
            if (fHistBus) fHistBus.value = '';
            if (fHistGra) fHistGra.value = '';
            if (fHistEst) fHistEst.value = '';
            filtrarYRenderizarHistorial();
        });
    }

    // Envío del Formulario
    const form = document.getElementById('preinscripcionForm');
    if (form) form.addEventListener('submit', manejarEnvioPreinscripcion);

    // Cierre modal al hacer click fuera
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}

function abrirModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
}

function cerrarModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
}

function mostrarToast(titulo, mensaje, tipo = 'success') {
    const t = document.getElementById('toastNotification');
    if (!t) return;
    document.getElementById('toastTitle').textContent = titulo;
    document.getElementById('toastMessage').textContent = mensaje;

    const icon = document.getElementById('toastIcon');
    if (tipo === 'error') {
        t.classList.add('error');
        icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: #dc2626;"></i>';
    } else if (tipo === 'info') {
        t.classList.remove('error');
        icon.innerHTML = '<i class="fa-solid fa-circle-info" style="color: #0284c7;"></i>';
    } else {
        t.classList.remove('error');
        icon.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #10b981;"></i>';
    }

    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
        t.classList.remove('show');
    }, 4500);
}

// Modal Verificar Recaudos
window.abrirVerificarRecaudos = function(codigo) {
    const reg = (AppState.registros || []).find(r => r.codigo === codigo);
    if (!reg) return;

    const elNom = document.getElementById('modalVerifyAlumnoNom');
    const elSub = document.getElementById('modalVerifyInfoSub');
    if (elNom) elNom.textContent = `Aspirante: ${reg.alumno} (C.I./C.E: ${reg.alumnoDoc || 'S/N'})`;
    if (elSub) elSub.textContent = `N° Folio: ${reg.codigo} | Grado Solicitado: ${reg.grado} | Representante: ${reg.representante}`;

    const container = document.getElementById('modalVerifyDocumentosList');
    if (!container) return;

    const docsMeta = [
        { id: '1', nombre: 'Partida de Nacimiento del Estudiante', icon: 'fa-certificate' },
        { id: '2', nombre: 'Cédula de Identidad del Representante Legal', icon: 'fa-id-card' },
        { id: '3', nombre: 'Boleta o Informe Descriptivo del Grado Anterior', icon: 'fa-file-invoice' },
        { id: '4', nombre: '4 Fotografías Tipo Carnet del Estudiante', icon: 'fa-image' },
        { id: '5', nombre: 'Constancia de Residencia de la Comunidad', icon: 'fa-house-chimney-user' }
    ];

    let html = '';
    docsMeta.forEach(doc => {
        const fileInfo = reg.archivos ? reg.archivos[doc.id] : null;
        const estDoc = (reg.documentos && reg.documentos[doc.id]) || (fileInfo ? 'CONSIGNADO' : 'NO_CONSIGNADO');

        const badgeClass = {
            'APROBADO': 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;',
            'CONSIGNADO': 'background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;',
            'NO_CONSIGNADO': 'background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;'
        }[estDoc] || 'background: #f1f5f9; color: #475569;';

        const tieneArchivo = Boolean(fileInfo);
        const fileName = fileInfo ? fileInfo.nombre : 'Sin archivo digital';
        const fileDate = fileInfo ? `Cargado: ${fileInfo.fecha}` : 'Pendiente';

        html += `
            <div class="recaudo-verify-card">
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 240px;">
                    <div class="doc-icon-badge" style="width: 44px; height: 44px; font-size: 1.25rem;">
                        <i class="fa-solid ${doc.icon}"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.15rem; color: var(--text-primary);">${doc.nombre}</h4>
                        <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">
                            <i class="fa-solid fa-paperclip"></i> ${fileName} • ${fileDate}
                        </span>
                        <div style="margin-top: 0.35rem;">
                            <span style="font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; ${badgeClass}">
                                ${estDoc}
                            </span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    ${tieneArchivo ? `
                        <button type="button" class="btn btn-outline-red btn-sm" onclick="mostrarModalPreviewDoc('${fileName}', '${fileInfo.dataUrl || ''}', '${fileInfo.tipo || ''}')" title="Ver documento">
                            <i class="fa-solid fa-eye"></i> Ver
                        </button>
                    ` : ''}
                    <button type="button" class="btn btn-primary btn-sm" onclick="verificarRecaudoDocente('${reg.codigo}', '${doc.id}', 'APROBADO')" style="background: #16a34a; border-color: #16a34a; font-size: 0.78rem;" title="Aprobar este documento">
                        <i class="fa-solid fa-check"></i> Aprobar
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="verificarRecaudoDocente('${reg.codigo}', '${doc.id}', 'NO_CONSIGNADO')" style="font-size: 0.78rem;" title="Observar / Marcar Incompleto">
                        <i class="fa-solid fa-xmark"></i> Incompleto
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    abrirModal('modalVerificarRecaudosBackdrop');
};

window.verificarRecaudoDocente = async function(codigo, docId, nuevoEstado) {
    const reg = (AppState.registros || []).find(r => r.codigo === codigo);
    if (!reg) return;

    if (!reg.documentos) reg.documentos = {};
    reg.documentos[docId] = nuevoEstado;

    let entregados = 0;
    for (let i = 1; i <= 5; i++) {
        const e = reg.documentos[String(i)] || (reg.archivos && reg.archivos[String(i)] ? 'CONSIGNADO' : 'NO_CONSIGNADO');
        if (e === 'APROBADO' || e === 'CONSIGNADO') entregados++;
    }
    reg.recaudosCount = `${entregados}/5`;

    if (entregados === 5 && reg.estado === 'DOCUMENTOS_INCOMPLETOS') {
        reg.estado = 'APROBADA';
    }

    localStorage.setItem('fya_preinscripciones_db', JSON.stringify(AppState.registros));
    actualizarKpisDocente();
    filtrarYRenderizarPanelDocente();
    abrirVerificarRecaudos(codigo);

    mostrarToast('Recaudo Verificado', `Documento ${docId} marcado como ${nuevoEstado}.`);

    // Sincronizar recaudo en la nube
    try {
        await fetch(`/api/preinscripciones/${encodeURIComponent(codigo)}/recaudo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docId, nuevoEstado })
        });
    } catch (err) {
        console.warn('[Cloud Sync Recaudo Warning]', err.message);
    }
};

window.mostrarModalPreviewDoc = function(titulo, dataUrl, tipo) {
    const t = document.getElementById('modalPreviewDocTitulo');
    const c = document.getElementById('modalPreviewDocContenido');
    if (t) t.textContent = `Vista Previa: ${titulo}`;
    if (!c) return;

    if (dataUrl && (dataUrl.startsWith('data:image/') || (tipo && tipo.startsWith('image/')))) {
        c.innerHTML = `
            <img src="${dataUrl}" alt="Recaudo" style="max-width: 100%; max-height: 550px; border-radius: var(--radius-md); box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
            <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">${titulo}</p>
        `;
    } else {
        c.innerHTML = `
            <div style="padding: 2.5rem 1.5rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                <i class="fa-solid fa-file-pdf" style="font-size: 3.5rem; color: var(--fya-red); margin-bottom: 1rem;"></i>
                <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--text-primary);">${titulo}</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 450px; margin: 0 auto 1.5rem;">
                    Documento digital consignado en formato PDF. Documento verificado y almacenado en el expediente escolar del aspirante.
                </p>
                ${dataUrl ? `<a href="${dataUrl}" download="${titulo}" class="btn btn-primary btn-sm"><i class="fa-solid fa-download"></i> Descargar Documento</a>` : ''}
            </div>
        `;
    }

    abrirModal('modalPreviewDocBackdrop');
};

// Exposición Global
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;

/* ==============================================================================
   CICLO DE FINALIZACIÓN DE IMPRESIÓN & MODAL DE RETORNO (afterprint)
   ============================================================================== */
window.addEventListener('afterprint', () => {
    if (AppState.flujoImpresionPendiente) {
        AppState.flujoImpresionPendiente = false;
        // Cerrar el modal visor de la planilla
        cerrarModal('modalPlanillaBackdrop');
        // Limpiar de forma segura el borrador temporal de localStorage
        localStorage.removeItem('fya_preinscripcion_draft');
        // Mostrar modal de éxito profesional y centrado
        abrirModal('modalExitoFinalizacionBackdrop');
    }
});

window.limpiarBorradorYSeguridad = function() {
    localStorage.removeItem('fya_preinscripcion_draft');
};

window.iniciarNuevaPreinscripcion = function() {
    localStorage.removeItem('fya_preinscripcion_draft');
    cerrarModal('modalExitoFinalizacionBackdrop');
    const form = document.getElementById('preinscripcionForm');
    if (form) form.reset();
    irAlPaso(1);
    mostrarToast('Nueva Solicitud', 'Formulario restablecido para un nuevo registro de aspirante.');
};

window.volverAlInicioDesdeExito = function() {
    localStorage.removeItem('fya_preinscripcion_draft');
    window.location.href = 'index.html';
};
