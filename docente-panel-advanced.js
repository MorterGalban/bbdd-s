/**
 * MODULO AVANZADO DE PANEL DOCENTE, FILTROS CRUZADOS, EXPORTACIÓN DINÁMICA Y AUDITORÍA
 * U.E. Fe y Alegría "Nueva América" - Periodo Escolar 2026 - 2027
 * 
 * Funcionalidades:
 * 1. Filtros cruzados en tiempo real (Búsqueda + Grado + Estatus de Recaudos + Estatus Solicitud + Fecha)
 * 2. Exportación dinámica a Excel/CSV del subconjunto exacto filtrado en pantalla
 * 3. Vaciado total permanente con DELETE/TRUNCATE real en MySQL y Cloud
 * 4. Modal de Historial de Auditoría (System Logs) para el personal docente
 */

(function () {
    'use strict';

    let logsDocenteCache = [];

    // ==============================================================================
    // 1. FILTRADO CRUZADO EN TIEMPO REAL
    // ==============================================================================
    function aplicarFiltrosAvanzadosDocente() {
        if (!window.AppState || !Array.isArray(window.AppState.registros)) {
            return;
        }

        const tbody = document.getElementById('tablaDocenteRegistrosBody');
        if (!tbody) return;

        const texto = (document.getElementById('filtroDocenteBusqueda')?.value || '').trim().toLowerCase();
        const grado = document.getElementById('filtroDocenteGrado')?.value || window.AppState.filtroGradoActivo || '';
        const recaudosFiltro = document.getElementById('filtroDocenteRecaudos')?.value || '';
        const estado = document.getElementById('filtroDocenteEstado')?.value || '';
        const fechaFiltro = document.getElementById('filtroDocenteFecha')?.value || ''; // Formato: YYYY-MM-DD

        const filtrados = window.AppState.registros.filter(r => {
            if (!r) return false;

            // 1. Búsqueda por texto (Alumno, cédula, representante, cédula representante, colegio)
            const matchTexto = !texto ||
                (r.alumno && r.alumno.toLowerCase().includes(texto)) ||
                (r.codigo && r.codigo.toLowerCase().includes(texto)) ||
                (r.alumnoDoc && r.alumnoDoc.toLowerCase().includes(texto)) ||
                (r.representante && r.representante.toLowerCase().includes(texto)) ||
                (r.repreDoc && r.repreDoc.toLowerCase().includes(texto)) ||
                (r.instituto && r.instituto.toLowerCase().includes(texto));

            // 2. Grado Solicitado
            const matchGrado = !grado || (r.grado && r.grado.includes(grado));

            // 3. Estatus de Solicitud (EN_REVISION, APROBADA, etc.)
            const matchEstado = !estado || (r.estado === estado);

            // 4. Estatus de Recaudos (Aprobado/Completo 5/5, En Revisión 4/5, Incompleto < 4)
            let matchRecaudos = true;
            if (recaudosFiltro) {
                const countStr = r.recaudosCount || '4/5';
                const entregados = parseInt(countStr.split('/')[0] || '0', 10);
                if (recaudosFiltro === 'COMPLETO') {
                    matchRecaudos = (entregados >= 5);
                } else if (recaudosFiltro === 'REVISION') {
                    matchRecaudos = (entregados === 4);
                } else if (recaudosFiltro === 'INCOMPLETO') {
                    matchRecaudos = (entregados < 4 || r.estado === 'DOCUMENTOS_INCOMPLETOS');
                }
            }

            // 5. Fecha de Registro
            let matchFecha = true;
            if (fechaFiltro) {
                // fechaFiltro viene en YYYY-MM-DD (ej: 2026-10-08)
                // r.fecha puede venir en '08/10/2026' o ISO '2026-10-08...'
                const rFecha = String(r.fecha || '');
                if (rFecha.includes('/')) {
                    const partes = rFecha.split('/');
                    if (partes.length === 3) {
                        const isoRecord = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                        matchFecha = (isoRecord === fechaFiltro);
                    }
                } else if (rFecha.startsWith(fechaFiltro)) {
                    matchFecha = true;
                } else {
                    matchFecha = false;
                }
            }

            return matchTexto && matchGrado && matchEstado && matchRecaudos && matchFecha;
        });

        // Guardar subconjunto exacto visible en memoria global para exportación dinámica
        window.AppState.registrosFiltrados = filtrados;

        // Renderizado del cuerpo de la tabla
        if (!window.AppState.registros || window.AppState.registros.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
                        <i class="fa-solid fa-folder-open" style="font-size: 2.4rem; color: #94a3b8; display: block; margin-bottom: 0.75rem;"></i>
                        <strong style="display: block; font-size: 1.05rem; margin-bottom: 0.35rem; color: var(--text-secondary);">No hay registros de preinscripción en el sistema</strong>
                        <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">La base de datos MySQL ha sido limpiada o aún no se han registrado aspirantes.</p>
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
                        <i class="fa-solid fa-filter-circle-xmark" style="font-size: 2.2rem; color: #94a3b8; display: block; margin-bottom: 0.6rem;"></i>
                        No se encontraron preinscripciones con los filtros combinados aplicados.
                        <div style="margin-top: 0.75rem;">
                            <button type="button" class="btn btn-outline-red btn-sm" onclick="resetearTodosLosFiltrosDocente()">
                                <i class="fa-solid fa-rotate-left"></i> Restablecer Filtros
                            </button>
                        </div>
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

    // Sobrescribir la función de filtrado del sistema principal sin alterar el resto
    window.filtrarYRenderizarPanelDocente = aplicarFiltrosAvanzadosDocente;

    // ==============================================================================
    // 2. EXPORTACIÓN DINÁMICA A EXCEL / CSV DEL SUBCONJUNTO EXACTO FILTRADO
    // ==============================================================================
    window.exportarRegistrosAExcel = function () {
        // Garantizar que se exporte exactamente el subconjunto de datos filtrados visible en pantalla
        const registrosAExportar = (window.AppState && window.AppState.registrosFiltrados) 
            ? window.AppState.registrosFiltrados 
            : (window.AppState?.registros || []);

        if (registrosAExportar.length === 0) {
            if (typeof mostrarToast === 'function') {
                mostrarToast('Sin Datos Filtrados', 'No hay registros que coincidan con los filtros aplicados para exportar.', 'error');
            } else {
                alert('No hay registros que coincidan con los filtros aplicados para exportar.');
            }
            return;
        }

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

        const rows = registrosAExportar.map(r => [
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
        a.download = `Preinscripciones_Filtradas_${registrosAExportar.length}_Alumnos_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof mostrarToast === 'function') {
            mostrarToast('Exportación Exitosa', `Se descargaron ${registrosAExportar.length} registros filtrados para Microsoft Excel.`, 'success');
        }
    };

    // ==============================================================================
    // 3. REINICIALIZAR Y LIMPIAR FILTROS
    // ==============================================================================
    window.resetearTodosLosFiltrosDocente = function () {
        const inpBusqueda = document.getElementById('filtroDocenteBusqueda');
        const selGrado = document.getElementById('filtroDocenteGrado');
        const selRecaudos = document.getElementById('filtroDocenteRecaudos');
        const selEstado = document.getElementById('filtroDocenteEstado');
        const inpFecha = document.getElementById('filtroDocenteFecha');

        if (inpBusqueda) inpBusqueda.value = '';
        if (selGrado) selGrado.value = '';
        if (selRecaudos) selRecaudos.value = '';
        if (selEstado) selEstado.value = '';
        if (inpFecha) inpFecha.value = '';

        if (window.AppState) {
            window.AppState.filtroGradoActivo = '';
        }

        document.querySelectorAll('.grade-pill-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('pillGradoTodos')?.classList.add('active');

        aplicarFiltrosAvanzadosDocente();
    };

    // ==============================================================================
    // 4. BORRADO REAL Y PERMANENTE EN MYSQL (LIMPIAR TODOS)
    // ==============================================================================
    const originalEjecutarEliminarRegistro = window.ejecutarEliminarRegistro;

    window.ejecutarEliminarRegistro = async function () {
        if (!window.AppState || !window.AppState.registroAEliminar) {
            if (typeof cerrarModal === 'function') cerrarModal('modalConfirmarEliminarBackdrop');
            return;
        }

        const esLimpiarTodos = (window.AppState.registroAEliminar === '__ALL__');

        if (esLimpiarTodos) {
            if (typeof cerrarModal === 'function') cerrarModal('modalConfirmarEliminarBackdrop');
            if (typeof mostrarToast === 'function') {
                mostrarToast('Vaciando Base de Datos...', 'Enviando orden de eliminación permanente a MySQL...', 'info');
            }

            try {
                const usuarioActual = localStorage.getItem('fya_docente_user') || 'manteca';
                const res = await fetch('/api/preinscripciones/purge', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user': usuarioActual
                    },
                    body: JSON.stringify({ usuario: usuarioActual })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Error al vaciar registros en MySQL.');
                }

                // Limpieza en memoria y localStorage
                window.AppState.registros = [];
                window.AppState.registrosFiltrados = [];
                localStorage.setItem('fya_preinscripciones_db', JSON.stringify([]));

                if (typeof recalcularCorrelativo === 'function') recalcularCorrelativo();
                if (typeof actualizarKpisDocente === 'function') actualizarKpisDocente();
                aplicarFiltrosAvanzadosDocente();

                if (typeof mostrarToast === 'function') {
                    mostrarToast('Base de Datos Limpia', 'Todas las tablas de preinscripciones han sido vaciadas permanentemente en MySQL.', 'success');
                }
            } catch (err) {
                console.error('[Error Vaciado Real MySQL]', err);
                if (typeof mostrarToast === 'function') {
                    mostrarToast('Error al Limpiar', 'No se pudo vaciar la base de datos MySQL.', 'error');
                }
            }
        } else {
            // Mantener comportamiento normal para eliminar un solo folio
            if (typeof originalEjecutarEliminarRegistro === 'function') {
                await originalEjecutarEliminarRegistro();
                aplicarFiltrosAvanzadosDocente();
            }
        }
    };

    // ==============================================================================
    // 5. HISTORIAL DE AUDITORÍA Y LOGS EN MYSQL (VISTA DOCENTE)
    // ==============================================================================
    window.abrirModalAuditoriaDocente = function () {
        const modal = document.getElementById('modalAuditoriaDocenteBackdrop');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            cargarLogsDocente();
        }
    };

    window.cerrarModalAuditoriaDocente = function () {
        const modal = document.getElementById('modalAuditoriaDocenteBackdrop');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    };

    window.cargarLogsDocente = async function () {
        const tbody = document.getElementById('tablaAuditoriaDocenteBody');
        const icon = document.getElementById('iconSyncLogsDocente');
        if (icon) icon.classList.add('fa-spin');

        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando eventos desde MySQL...</td></tr>`;
        }

        try {
            const res = await fetch('/api/logs?limit=80');
            const data = await res.json();

            if (res.ok && data.success && Array.isArray(data.data)) {
                logsDocenteCache = data.data;
                renderizarTablaLogsDocente(logsDocenteCache);
            } else {
                if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #dc2626; padding: 1.5rem;">Error al consultar logs de auditoría.</td></tr>`;
            }
        } catch (e) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #dc2626; padding: 1.5rem;">Error de conexión con la base de datos.</td></tr>`;
        } finally {
            if (icon) icon.classList.remove('fa-spin');
        }
    };

    function renderizarTablaLogsDocente(logs) {
        const tbody = document.getElementById('tablaAuditoriaDocenteBody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay eventos de auditoría registrados aún.</td></tr>`;
            return;
        }

        let html = '';
        logs.forEach(l => {
            const fecha = l.timestamp ? new Date(l.timestamp).toLocaleString('es-VE') : 'N/D';
            const accionBadge = {
                'APROBACION_DOCENTE': 'color: #15803d; font-weight: 700;',
                'RECHAZO_DOCENTE': 'color: #b91c1c; font-weight: 700;',
                'VACIADO_TABLAS': 'color: #dc2626; font-weight: 800;',
                'CAMBIO_ESTADO_ALUMNO': 'color: #0284c7; font-weight: 700;',
                'NUEVA_PREINSCRIPCION': 'color: #16a34a; font-weight: 700;',
                'RECUPERACION_CLAVE': 'color: #7c3aed; font-weight: 700;'
            }[l.accion] || 'color: var(--text-primary); font-weight: 600;';

            html += `
                <tr>
                    <td style="white-space: nowrap; font-family: monospace; font-size: 0.78rem;">${fecha}</td>
                    <td><strong style="color: var(--text-primary);">${l.usuario || 'Sistema'}</strong></td>
                    <td><span class="badge-tag" style="font-size: 0.72rem; padding: 2px 6px;">${l.rol || 'DOCENTE'}</span></td>
                    <td style="${accionBadge}">${l.accion || 'OPERACION'}</td>
                    <td style="color: var(--text-secondary); line-height: 1.4;">${l.descripcion || ''}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    window.exportarLogsDocenteCSV = function () {
        if (!logsDocenteCache || logsDocenteCache.length === 0) {
            if (typeof mostrarToast === 'function') {
                mostrarToast('Sin Datos', 'No hay registros de auditoría para exportar.', 'error');
            }
            return;
        }

        const headers = ['Fecha y Hora', 'Usuario', 'Rol', 'Acción', 'Descripción'];
        const rows = logsDocenteCache.map(l => [
            `"${l.timestamp || ''}"`,
            `"${(l.usuario || '').replace(/"/g, '""')}"`,
            `"${l.rol || ''}"`,
            `"${l.accion || ''}"`,
            `"${(l.descripcion || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Auditoria_Docente_MySQL_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ==============================================================================
    // 6. INICIALIZACIÓN DE LISTENERS
    // ==============================================================================
    function initListenersAvanzados() {
        const inpBusqueda = document.getElementById('filtroDocenteBusqueda');
        const selGrado = document.getElementById('filtroDocenteGrado');
        const selRecaudos = document.getElementById('filtroDocenteRecaudos');
        const selEstado = document.getElementById('filtroDocenteEstado');
        const inpFecha = document.getElementById('filtroDocenteFecha');
        const btnReset = document.getElementById('btnResetDocenteFiltros');

        [inpBusqueda, selGrado, selRecaudos, selEstado, inpFecha].forEach(el => {
            if (el) {
                el.addEventListener('input', aplicarFiltrosAvanzadosDocente);
                el.addEventListener('change', aplicarFiltrosAvanzadosDocente);
            }
        });

        if (btnReset) {
            btnReset.addEventListener('click', (e) => {
                e.preventDefault();
                window.resetearTodosLosFiltrosDocente();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initListenersAvanzados);
    } else {
        initListenersAvanzados();
    }

})();
