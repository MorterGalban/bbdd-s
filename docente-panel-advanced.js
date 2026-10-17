/**
 * MODULO AVANZADO DE PANEL DOCENTE, FILTROS CRUZADOS, EXPORTACIÓN DINÁMICA Y AUDITORÍA
 * U.E. Fe y Alegría "Nueva América" - Periodo Escolar 2026 - 2027
 * 
 * Funcionalidades:
 * 1. Filtros cruzados en tiempo real (Búsqueda + Grado + Estatus de Recaudos + Estatus Solicitud + Fecha)
 * 2. Exportación dinámica a Excel/CSV del subconjunto exacto filtrado en pantalla
 * 3. Vaciado total permanente con DELETE/TRUNCATE real en MySQL y Cloud
 * 4. Control seguro con sesiones temporales para el personal docente
 */

(function () {
    'use strict';

    // ==============================================================================
    // 1. FILTRADO CRUZADO EN TIEMPO REAL
    // ==============================================================================
    function obtenerEstadoGlobal() {
        if (typeof window !== 'undefined' && window.AppState) return window.AppState;
        if (typeof AppState !== 'undefined') return AppState;
        return null;
    }

    function aplicarFiltrosAvanzadosDocente() {
        const state = obtenerEstadoGlobal();
        const tbody = document.getElementById('tablaDocenteRegistrosBody');
        if (!tbody) return;

        if (!state || !Array.isArray(state.registros)) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.8rem; color: var(--fya-red); display: block; margin-bottom: 0.5rem;"></i>
                        Sincronizando información de preinscripciones...
                    </td>
                </tr>
            `;
            return;
        }

        const texto = (document.getElementById('filtroDocenteBusqueda')?.value || '').trim().toLowerCase();
        const grado = document.getElementById('filtroDocenteGrado')?.value || state.filtroGradoActivo || '';
        const recaudosFiltro = document.getElementById('filtroDocenteRecaudos')?.value || '';
        const estado = document.getElementById('filtroDocenteEstado')?.value || '';
        const fechaFiltro = document.getElementById('filtroDocenteFecha')?.value || ''; // Formato: YYYY-MM-DD

        const filtrados = state.registros.filter(r => {
            if (!r) return false;

            // 1. Búsqueda por texto (Alumno, cédula, representante, cédula representante, colegio)
            const matchTexto = !texto ||
                (r.alumno && r.alumno.toLowerCase().includes(texto)) ||
                (r.codigo && r.codigo.toLowerCase().includes(texto)) ||
                (r.alumnoDoc && r.alumnoDoc.toLowerCase().includes(texto)) ||
                (r.representante && r.representante.toLowerCase().includes(texto)) ||
                (r.repreDoc && r.repreDoc.toLowerCase().includes(texto)) ||
                (r.instituto && r.instituto.toLowerCase().includes(texto));

            // 2. Grado Solicitado (soporte robusto para '1er Grado', '1° Grado', ID '1', etc.)
            let matchGrado = true;
            if (grado) {
                const gNum = grado.match(/\d/)?.[0];
                const rNum = (r.gradoId ? String(r.gradoId) : '') || (r.grado ? r.grado.match(/\d/)?.[0] : '');
                matchGrado = (r.grado && r.grado.toLowerCase().includes(grado.toLowerCase())) || (Boolean(gNum) && Boolean(rNum) && gNum === rNum);
            }

            // 3. Estatus de Solicitud (EN_REVISION, APROBADA, etc.)
            const matchEstado = !estado || (r.estado === estado);

            // 4. Estatus de Recaudos (Aprobado/Completo 5/5, En Revisión 5/5, Incompleto < 5)
            let matchRecaudos = true;
            if (recaudosFiltro) {
                let entregados = 0;
                if (r.documentos) {
                    for (let i = 1; i <= 5; i++) {
                        const d = r.documentos[String(i)] || (r.archivos && r.archivos[String(i)] ? 'CONSIGNADO' : 'NO_CONSIGNADO');
                        if (d === 'APROBADO' || d === 'CONSIGNADO') entregados++;
                    }
                } else if (r.recaudosCount) {
                    entregados = parseInt(r.recaudosCount.split('/')[0] || '0', 10);
                }

                if (recaudosFiltro === 'COMPLETO') {
                    matchRecaudos = (entregados >= 5);
                } else if (recaudosFiltro === 'REVISION') {
                    matchRecaudos = (entregados >= 5 && r.estado === 'EN_REVISION');
                } else if (recaudosFiltro === 'INCOMPLETO') {
                    matchRecaudos = (entregados < 5 || r.estado === 'DOCUMENTOS_INCOMPLETOS');
                }
            }

            // 5. Fecha de Registro
            let matchFecha = true;
            if (fechaFiltro) {
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
        state.registrosFiltrados = filtrados;

        // Renderizado del cuerpo de la tabla
        if (!state.registros || state.registros.length === 0) {
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
            // Contar recaudos y evaluar máquina de estados automática
            let entregados = 0;
            if (r.documentos) {
                for (let i = 1; i <= 5; i++) {
                    const docVal = r.documentos[String(i)] || (r.archivos && r.archivos[String(i)] ? 'CONSIGNADO' : 'NO_CONSIGNADO');
                    if (docVal === 'APROBADO' || docVal === 'CONSIGNADO') entregados++;
                }
            } else if (r.recaudosCount) {
                entregados = parseInt(r.recaudosCount.split('/')[0] || '0', 10);
            }
            r.recaudosCount = `${entregados}/5`;

            // Máquina de estados: si faltan recaudos (< 5), se bloquea automáticamente en DOCUMENTOS_INCOMPLETOS.
            // Si tiene 100% (5/5) y estaba en DOCUMENTOS_INCOMPLETOS, pasa a EN_REVISION (habilitando el control docente).
            const estaIncompleto = (entregados < 5);
            if (estaIncompleto) {
                r.estado = 'DOCUMENTOS_INCOMPLETOS';
            } else if (r.estado === 'DOCUMENTOS_INCOMPLETOS' || !r.estado) {
                r.estado = 'EN_REVISION';
            }

            const badgeColor = {
                'APROBADA': 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;',
                'EN_REVISION': 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;',
                'DOCUMENTOS_INCOMPLETOS': 'background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;',
                'PENDIENTE': 'background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;',
                'LISTA_DE_ESPERA': 'background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe;'
            }[r.estado] || 'background: #f1f5f9; color: #475569;';

            const recaudosBadge = r.recaudosCount;

            const selectorEstadoHtml = estaIncompleto ? `
                <div class="status-locked-wrapper" title="Bloqueo automático del sistema: Faltan recaudos obligatorios (${entregados}/5 consignados). El expediente está bloqueado hasta consignar el 100% de recaudos.">
                    <span class="badge-lock-indicator"><i class="fa-solid fa-lock"></i> BLOQUEADO</span>
                    <select class="form-control select-locked-status" disabled title="Bloqueado por sistema: Faltan recaudos por consignar (${entregados}/5). Debe consignar el 100% para habilitar revisión y aprobación docente.">
                        <option value="DOCUMENTOS_INCOMPLETOS" selected>DOCS. INCOMPLETOS</option>
                    </select>
                </div>
            ` : `
                <div class="status-unlocked-wrapper" title="Expediente con 100% de recaudos consignados (5/5). Control docente habilitado para revisión y aprobación en taquilla.">
                    <span class="badge-unlocked-indicator"><i class="fa-solid fa-lock-open"></i> HABILITADO</span>
                    <select class="form-control" style="font-size: 0.78rem; font-weight: 700; padding: 0.25rem 0.5rem; ${badgeColor}" onchange="cambiarEstadoPreinscripcion('${r.codigo}', this.value)">
                        <option value="EN_REVISION" ${r.estado === 'EN_REVISION' ? 'selected' : ''}>EN REVISIÓN</option>
                        <option value="APROBADA" ${r.estado === 'APROBADA' ? 'selected' : ''}>APROBADA / EN REGLA</option>
                        <option value="DOCUMENTOS_INCOMPLETOS" ${r.estado === 'DOCUMENTOS_INCOMPLETOS' ? 'selected' : ''}>DOCS. INCOMPLETOS</option>
                        <option value="PENDIENTE" ${r.estado === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
                        <option value="LISTA_DE_ESPERA" ${r.estado === 'LISTA_DE_ESPERA' ? 'selected' : ''}>LISTA DE ESPERA</option>
                    </select>
                </div>
            `;

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
                        ${selectorEstadoHtml}
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
        const state = obtenerEstadoGlobal();
        const registrosAExportar = (state && state.registrosFiltrados) 
            ? state.registrosFiltrados 
            : (state?.registros || []);

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

        const state = obtenerEstadoGlobal();
        if (state) {
            state.filtroGradoActivo = '';
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
        const state = obtenerEstadoGlobal();
        if (!state || !state.registroAEliminar) {
            if (typeof cerrarModal === 'function') cerrarModal('modalConfirmarEliminarBackdrop');
            return;
        }

        const esLimpiarTodos = (state.registroAEliminar === '__ALL__');

        if (esLimpiarTodos) {
            if (typeof cerrarModal === 'function') cerrarModal('modalConfirmarEliminarBackdrop');
            if (typeof mostrarToast === 'function') {
                mostrarToast('Vaciando Base de Datos...', 'Enviando orden de eliminación permanente a MySQL...', 'info');
            }

            try {
                const usuarioActual = sessionStorage.getItem('fya_docente_user') || localStorage.getItem('fya_docente_user') || 'manteca';
                let res = await fetch('/api/preinscripciones/purge', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user': usuarioActual
                    }
                }).catch(() => null);

                if (!res || !res.ok) {
                    res = await fetch('/api/preinscripciones/purge', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-user': usuarioActual
                        },
                        body: JSON.stringify({ usuario: usuarioActual })
                    });
                }

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Error al vaciar registros en MySQL.');
                }

                // Limpieza en memoria y localStorage
                state.registros = [];
                state.registrosFiltrados = [];
                localStorage.setItem('fya_preinscripciones_db', JSON.stringify([]));

                if (typeof recalcularCorrelativo === 'function') recalcularCorrelativo();
                if (typeof actualizarKpisDocente === 'function') actualizarKpisDocente();
                if (typeof filtrarYRenderizarHistorial === 'function') filtrarYRenderizarHistorial();
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
            }
            aplicarFiltrosAvanzadosDocente();
        }
    };

    // ==============================================================================
    // 5. RESTRICCIÓN DE AUDITORÍA: RESERVADA EXCLUSIVAMENTE PARA SUPERROOT
    // ==============================================================================
    // Por directriz de seguridad jerárquica, el docente no visualiza los logs del sistema.

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
