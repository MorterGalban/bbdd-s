/**
 * SERVIDOR BACKEND INSTITUCIONAL (Node.js + Express + MySQL / Cloud Storage)
 * U.E. Fe y Alegría "Nueva América" - Periodo Escolar 2026 - 2027
 * Sincronización en la nube para Railway y despliegues web
 * 
 * Módulos Integrados:
 * - Preinscripción Estudiantil (CRUD y persistencia Cloud/MySQL)
 * - Registro y Autenticación Jerárquica de Docentes
 * - Recuperación de Contraseñas mediante Pregunta de Seguridad
 * - Panel Maestro Superroot (mantecosadmin67) con Protección de Ruta Estricta
 * - Sistema de Auditoría y Logs en MySQL y Archivo de Persistencia
 */

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================================================
// RUTAS Y ARCHIVOS DE PERSISTENCIA CLOUD LOCAL
// ==============================================================================
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'preinscripciones.json');
const DOCENTES_FILE = path.join(DATA_DIR, 'docentes.json');
const LOGS_FILE = path.join(DATA_DIR, 'system_logs.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config_sistema.json');

// Constantes de Seguridad para el Administrador Maestro (Superroot)
const SUPERROOT_USER = process.env.SUPERROOT_USER || 'superroot';
const SUPERROOT_PASS = process.env.SUPERROOT_PASS || 'Mantec0s#SuperRoot2026!';
const SUPERROOT_TOKEN_SECRET = process.env.SUPERROOT_SECRET || 'fya-superroot-secret-key-2026';

// Semilla institucional de demostración para preinscripciones
const REGISTROS_DEMO = [
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
        documentos: { '1': 'APROBADO', '2': 'APROBADO', '3': 'CONSIGNADO', '4': 'CONSIGNADO' },
        recaudosCount: '4/4',
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
        documentos: { '1': 'APROBADO', '2': 'APROBADO', '3': 'APROBADO', '4': 'APROBADO' },
        recaudosCount: '4/4',
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
        documentos: { '1': 'APROBADO', '2': 'APROBADO', '3': 'NO_CONSIGNADO', '4': 'NO_CONSIGNADO' },
        recaudosCount: '2/4',
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
        documentos: { '1': 'APROBADO', '2': 'APROBADO', '3': 'APROBADO', '4': 'APROBADO' },
        recaudosCount: '4/4',
        fecha: '08/10/2026'
    }
];

// Semilla inicial del docente único autorizado por defecto ('manteca' / 'manteca')
const DOCENTES_SEMILLA = [
    {
        id: 1,
        nombres: 'Profesor',
        apellidos: 'Manteca',
        usuario: 'manteca',
        correo: 'manteca@feyalegrianuevaamerica.edu.ve',
        password_hash: 'manteca',
        pregunta_seguridad: '¿Color institucional representativo?',
        respuesta_seguridad_hash: 'rojo',
        is_approved: 1,
        fecha_registro: new Date().toISOString(),
        fecha_aprobacion: new Date().toISOString(),
        aprobado_por: 'superroot'
    }
];

// ==============================================================================
// GESTIÓN DE ARCHIVOS LOCALES PERSISTENTES
// ==============================================================================
function asegurarDirectorioYArchivos() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(REGISTROS_DEMO, null, 2), 'utf8');
        }
        if (!fs.existsSync(DOCENTES_FILE)) {
            fs.writeFileSync(DOCENTES_FILE, JSON.stringify(DOCENTES_SEMILLA, null, 2), 'utf8');
        }
        if (!fs.existsSync(LOGS_FILE)) {
            const logInicial = [{
                id: 1,
                timestamp: new Date().toISOString(),
                usuario: 'superroot',
                rol: 'SUPERROOT',
                accion: 'INICIALIZACION_SISTEMA',
                descripcion: "Sistema de Control y Preinscripción 2026-2027 iniciado. Docente predefinido 'manteca' configurado.",
                ip_address: '127.0.0.1'
            }];
            fs.writeFileSync(LOGS_FILE, JSON.stringify(logInicial, null, 2), 'utf8');
        }
        if (!fs.existsSync(CONFIG_FILE)) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG_DEFECTO, null, 2), 'utf8');
        }
    } catch (e) {
        console.error('[Storage Local File] Error inicializando archivos:', e.message);
    }
}

function leerRegistrosArchivo() {
    try {
        asegurarDirectorioYArchivos();
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error('[Storage Local File] Error leyendo registros:', e.message);
        return [];
    }
}

function guardarRegistrosArchivo(registros) {
    try {
        asegurarDirectorioYArchivos();
        const tmpFile = `${DATA_FILE}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(registros, null, 2), 'utf8');
        fs.renameSync(tmpFile, DATA_FILE);
        return true;
    } catch (e) {
        console.error('[Storage Local File] Error guardando registros:', e.message);
        return false;
    }
}

function leerDocentesArchivo() {
    try {
        asegurarDirectorioYArchivos();
        const raw = fs.readFileSync(DOCENTES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : DOCENTES_SEMILLA;
    } catch (e) {
        return DOCENTES_SEMILLA;
    }
}

function guardarDocentesArchivo(docentes) {
    try {
        asegurarDirectorioYArchivos();
        const tmp = `${DOCENTES_FILE}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(docentes, null, 2), 'utf8');
        fs.renameSync(tmp, DOCENTES_FILE);
        return true;
    } catch (e) {
        console.error('[Docentes Storage] Error guardando:', e.message);
        return false;
    }
}

function leerLogsArchivo() {
    try {
        asegurarDirectorioYArchivos();
        const raw = fs.readFileSync(LOGS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function guardarLogsArchivo(logs) {
    try {
        asegurarDirectorioYArchivos();
        const tmp = `${LOGS_FILE}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(logs, null, 2), 'utf8');
        fs.renameSync(tmp, LOGS_FILE);
        return true;
    } catch (e) {
        return false;
    }
}

// Configuración general del sistema (Estado de admisión y cupos por grado)
const CONFIG_DEFECTO = {
    procesoAbierto: true,
    cuposPorGrado: {
        '1': 35,
        '2': 35,
        '3': 35,
        '4': 35,
        '5': 35,
        '6': 35
    },
    ultimaModificacion: new Date().toISOString()
};

function leerConfigSistema() {
    try {
        asegurarDirectorioYArchivos();
        if (!fs.existsSync(CONFIG_FILE)) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG_DEFECTO, null, 2), 'utf8');
            return { ...CONFIG_DEFECTO };
        }
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            procesoAbierto: parsed.procesoAbierto !== undefined ? parsed.procesoAbierto : true,
            cuposPorGrado: { ...CONFIG_DEFECTO.cuposPorGrado, ...(parsed.cuposPorGrado || {}) },
            ultimaModificacion: parsed.ultimaModificacion || new Date().toISOString()
        };
    } catch (e) {
        return { ...CONFIG_DEFECTO };
    }
}

function guardarConfigSistema(config) {
    try {
        asegurarDirectorioYArchivos();
        const tmp = `${CONFIG_FILE}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
        fs.renameSync(tmp, CONFIG_FILE);
        return true;
    } catch (e) {
        console.error('[Config Storage] Error guardando config:', e.message);
        return false;
    }
}

// ==============================================================================
// FUNCIONES AUXILIARES DE CRIPTOGRAFÍA Y AUDITORÍA
// ==============================================================================
function hashPassword(pass) {
    return crypto.createHash('sha256').update(String(pass)).digest('hex');
}

function verifyPassword(pass, hash) {
    if (!hash || !pass) return false;
    const cleanPass = String(pass);
    return hash === cleanPass || hash === hashPassword(cleanPass);
}

function hashRespuesta(ans) {
    return crypto.createHash('sha256').update(String(ans).trim().toLowerCase()).digest('hex');
}

function verifyRespuesta(ans, hash) {
    if (!hash || !ans) return false;
    const clean = String(ans).trim().toLowerCase();
    return hash === clean || hash === hashRespuesta(clean);
}

// Validación de Requisitos de Contraseña (mínimo 8 caracteres, mayúscula, minúscula, número y símbolo)
function validarPasswordSegura(password) {
    if (!password || typeof password !== 'string') {
        return { valida: false, error: 'Debe ingresar una contraseña.' };
    }
    if (password.length < 8) {
        return { valida: false, error: 'La contraseña debe contener al menos 8 caracteres (más de 8 dígitos/letras).' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valida: false, error: 'La contraseña debe incluir al menos una letra mayúscula (A-Z).' };
    }
    if (!/[a-z]/.test(password)) {
        return { valida: false, error: 'La contraseña debe incluir al menos una letra minúscula (a-z).' };
    }
    if (!/[0-9]/.test(password)) {
        return { valida: false, error: 'La contraseña debe incluir al menos un número o dígito (0-9).' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
        return { valida: false, error: 'La contraseña debe incluir al menos un carácter especial (@, $, !, %, *, #, etc.).' };
    }
    return { valida: true };
}

function generarTokenSuperroot() {
    const payload = { role: 'SUPERROOT', ts: Date.now() };
    const str = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', SUPERROOT_TOKEN_SECRET).update(str).digest('hex');
    return Buffer.from(str).toString('base64') + '.' + hmac;
}

function verificarTokenSuperroot(token) {
    try {
        if (!token) return false;
        const [base64, hmac] = token.split('.');
        if (!base64 || !hmac) return false;
        const str = Buffer.from(base64, 'base64').toString('utf8');
        const expectedHmac = crypto.createHmac('sha256', SUPERROOT_TOKEN_SECRET).update(str).digest('hex');
        if (hmac !== expectedHmac) return false;
        const payload = JSON.parse(str);
        if (Date.now() - payload.ts > 24 * 60 * 60 * 1000) return false; // 24 horas de validez
        return payload.role === 'SUPERROOT';
    } catch (e) {
        return false;
    }
}

// Registro global de Auditoría (MySQL + Fallback Cloud Storage)
async function registrarLog(usuario, rol, accion, descripcion, req = null) {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const timestamp = new Date().toISOString();

    const logEntry = {
        id: Date.now(),
        timestamp,
        usuario: String(usuario || 'SISTEMA'),
        rol: String(rol || 'SISTEMA'),
        accion: String(accion || 'OPERACION'),
        descripcion: String(descripcion || ''),
        ip_address: String(ip)
    };

    // 1. Guardar en archivo local
    try {
        const logs = leerLogsArchivo();
        logs.unshift(logEntry);
        if (logs.length > 500) logs.pop(); // Mantener últimos 500
        guardarLogsArchivo(logs);
    } catch (e) {
        console.error('[Auditoría Archivo Error]:', e.message);
    }

    // 2. Guardar en MySQL si está conectado
    if (isMySQLConnected && pool) {
        try {
            await pool.query(
                `INSERT INTO system_logs (usuario, rol, accion, descripcion, ip_address)
                 VALUES (?, ?, ?, ?, ?)`,
                [logEntry.usuario, logEntry.rol, logEntry.accion, logEntry.descripcion, logEntry.ip_address]
            );
        } catch (sqlErr) {
            console.error('[MySQL Auditoría Log Error]:', sqlErr.message);
        }
    }

    console.log(`[AUDIT] [${logEntry.rol}] ${logEntry.usuario} -> ${logEntry.accion}: ${logEntry.descripcion}`);
}

// ==============================================================================
// GESTIÓN DE CONEXIÓN MYSQL (RAILWAY Y LOCAL)
// ==============================================================================
let pool = null;
let isMySQLConnected = false;

function buildMySQLConfig() {
    const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (dbUrl) return dbUrl;

    return {
        host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),
        user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
        password: process.env.MYSQLPASSWORD !== undefined ? process.env.MYSQLPASSWORD : (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : ''),
        database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'sistema_preinscripcion',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
}

async function inicializarMySQL() {
    try {
        const config = buildMySQLConfig();
        pool = mysql.createPool(config);

        const conn = await pool.getConnection();
        console.log('[MySQL] Conexión establecida con éxito en la nube.');
        conn.release();

        await inicializarEsquemaMySQL(pool);
        isMySQLConnected = true;
    } catch (err) {
        isMySQLConnected = false;
        console.warn('[MySQL] No se pudo conectar a MySQL:', err.message);
        console.info('[Storage] Utilizando almacenamiento Cloud persistente en servidor.');
    }
}

async function inicializarEsquemaMySQL(poolInstance) {
    const conn = await poolInstance.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                nombre_completo VARCHAR(100) NOT NULL,
                nombre_usuario VARCHAR(50) NOT NULL UNIQUE,
                correo VARCHAR(120) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                rol VARCHAR(50) NOT NULL DEFAULT 'REPRESENTANTE',
                estado VARCHAR(50) NOT NULL DEFAULT 'ACTIVO',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS institutos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                codigo_plantel VARCHAR(30) NULL,
                nombre VARCHAR(150) NOT NULL,
                tipo_institucion VARCHAR(50) NOT NULL DEFAULT 'PUBLICA',
                telefono VARCHAR(25) NULL,
                ciudad VARCHAR(80) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS representantes (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                tipo_documento VARCHAR(10) NOT NULL DEFAULT 'V',
                numero_identificacion VARCHAR(25) NOT NULL,
                nombres VARCHAR(80) NOT NULL,
                apellidos VARCHAR(80) NOT NULL,
                parentesco VARCHAR(50) NOT NULL DEFAULT 'PADRE',
                telefono_principal VARCHAR(25) NOT NULL,
                correo VARCHAR(120) NULL,
                profesion_ocupacion VARCHAR(100) NULL,
                direccion_habitacion TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS alumnos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                tipo_documento VARCHAR(10) NOT NULL DEFAULT 'CE',
                numero_identificacion VARCHAR(25) NOT NULL,
                nombres VARCHAR(80) NOT NULL,
                apellidos VARCHAR(80) NOT NULL,
                fecha_nacimiento DATE NULL,
                genero VARCHAR(20) NULL,
                lugar_nacimiento VARCHAR(120) NULL,
                direccion_habitacion TEXT NULL,
                tipo_sangre VARCHAR(10) NULL,
                alergias_condiciones TEXT NULL,
                vive_con VARCHAR(50) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS grados (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                codigo VARCHAR(20) NOT NULL,
                nombre VARCHAR(80) NOT NULL,
                nivel_educativo VARCHAR(50) NOT NULL DEFAULT 'PRIMARIA',
                orden_jerarquico TINYINT UNSIGNED NOT NULL
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS periodos_academicos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                codigo VARCHAR(25) NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                estado VARCHAR(50) NOT NULL DEFAULT 'PREINSCRIPCION_ABIERTA'
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS grado_periodos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_grado INT UNSIGNED NOT NULL,
                id_periodo INT UNSIGNED NOT NULL,
                estado VARCHAR(50) NOT NULL DEFAULT 'DISPONIBLE'
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS preinscripciones (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                codigo_solicitud VARCHAR(30) NOT NULL UNIQUE,
                id_repre INT UNSIGNED NULL,
                id_alumno INT UNSIGNED NULL,
                id_instituto INT UNSIGNED NULL,
                id_g_periodo INT UNSIGNED NULL,
                id_user INT UNSIGNED NULL,
                fecha_solicitud DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                estado VARCHAR(50) NOT NULL DEFAULT 'EN_REVISION',
                motivo_rechazo TEXT NULL,
                observaciones TEXT NULL,
                datos_completos LONGTEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_pre_codigo (codigo_solicitud),
                INDEX idx_pre_estado (estado)
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS preinscripcion_documentos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_pre INT UNSIGNED NOT NULL,
                id_documento INT UNSIGNED NOT NULL,
                estado VARCHAR(50) NOT NULL DEFAULT 'NO_CONSIGNADO',
                fecha_entrega DATETIME NULL,
                ruta_archivo LONGTEXT NULL,
                archivo_base64 LONGTEXT NULL,
                observaciones TEXT NULL,
                motivo_rechazo TEXT NULL,
                INDEX idx_rpd_pre (id_pre)
            ) ENGINE=InnoDB;
        `);

        // TABLA: docentes (Sistema Jerárquico de Registro y Aprobación)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS docentes (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                nombres VARCHAR(100) NOT NULL,
                apellidos VARCHAR(100) NOT NULL,
                correo VARCHAR(150) NOT NULL UNIQUE,
                usuario VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                pregunta_seguridad VARCHAR(255) NOT NULL,
                respuesta_seguridad_hash VARCHAR(255) NOT NULL,
                is_approved TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Pendiente, 1: Aprobado, -1: Rechazado',
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                fecha_aprobacion DATETIME NULL,
                aprobado_por VARCHAR(100) NULL,
                ultimo_acceso DATETIME NULL,
                INDEX idx_doc_usuario (usuario),
                INDEX idx_doc_approved (is_approved)
            ) ENGINE=InnoDB;
        `);

        // TABLA: system_logs (Historial de Auditoría Interna)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                usuario VARCHAR(100) NOT NULL,
                rol VARCHAR(50) NOT NULL,
                accion VARCHAR(80) NOT NULL,
                descripcion TEXT NOT NULL,
                ip_address VARCHAR(50) NULL,
                INDEX idx_logs_timestamp (timestamp),
                INDEX idx_logs_accion (accion)
            ) ENGINE=InnoDB;
        `);

        // Semilla del único docente base 'manteca' / 'manteca' aprobado por defecto
        await conn.query(`
            INSERT IGNORE INTO docentes (id, nombres, apellidos, correo, usuario, password_hash, pregunta_seguridad, respuesta_seguridad_hash, is_approved, aprobado_por)
            VALUES (1, 'Profesor', 'Manteca', 'manteca@feyalegrianuevaamerica.edu.ve', 'manteca', 'manteca', '¿Color institucional representativo?', 'rojo', 1, 'superroot');
        `);

        // Semillas académicas
        await conn.query(`
            INSERT IGNORE INTO periodos_academicos (id, codigo, nombre, estado) VALUES
            (1, '2026-2027', 'Año Escolar 2026 - 2027', 'PREINSCRIPCION_ABIERTA');
        `);

        for (let i = 1; i <= 6; i++) {
            await conn.query(`
                INSERT IGNORE INTO grados (id, codigo, nombre, orden_jerarquico) VALUES
                (?, ?, ?, ?);
            `, [i, `PRIM-${i}`, `${i}er Grado de Educación Primaria`, i]);

            await conn.query(`
                INSERT IGNORE INTO grado_periodos (id, id_grado, id_periodo, estado) VALUES
                (?, ?, 1, 'DISPONIBLE');
            `, [i, i]);
        }

        const [countRows] = await conn.query(`SELECT COUNT(*) as total FROM preinscripciones;`);
        if (countRows && countRows[0].total === 0) {
            console.log('[MySQL] Insertando registros demo iniciales...');
            for (const r of REGISTROS_DEMO) {
                await insertarRegistroEnMySQL(conn, r);
            }
        }

        console.log('[MySQL] Tablas, esquemas y usuario manteca inicializados correctamente.');
    } catch (err) {
        console.error('[MySQL] Error inicializando esquema:', err.message);
    } finally {
        conn.release();
    }
}

async function insertarRegistroEnMySQL(conn, reg) {
    const cod = reg.codigo;
    const est = reg.estado || 'EN_REVISION';
    const jsonStr = JSON.stringify(reg);

    const alNomPartes = (reg.alumno || '').trim().split(' ');
    const alNombres = alNomPartes.slice(0, Math.ceil(alNomPartes.length / 2)).join(' ') || reg.alumno || 'Aspirante';
    const alApellidos = alNomPartes.slice(Math.ceil(alNomPartes.length / 2)).join(' ') || '';

    const repNomPartes = (reg.representante || '').trim().split(' ');
    const repNombres = repNomPartes.slice(0, Math.ceil(repNomPartes.length / 2)).join(' ') || reg.representante || 'Representante';
    const repApellidos = repNomPartes.slice(Math.ceil(repNomPartes.length / 2)).join(' ') || '';

    const alDoc = (reg.alumnoDoc || '').replace(/^[A-Z]+-/, '');
    const alTipo = ((reg.alumnoDoc || '').split('-')[0] || 'CE').toUpperCase();

    const repDoc = (reg.repreDoc || '').replace(/^[A-Z]+-/, '');
    const repTipo = ((reg.repreDoc || '').split('-')[0] || 'V').toUpperCase();

    let alumnoId = null;
    const [resAl] = await conn.query(
        `INSERT INTO alumnos (tipo_documento, numero_identificacion, nombres, apellidos, fecha_nacimiento, genero, lugar_nacimiento, direccion_habitacion, tipo_sangre, alergias_condiciones, vive_con)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            nombres = VALUES(nombres),
            apellidos = VALUES(apellidos),
            fecha_nacimiento = VALUES(fecha_nacimiento),
            genero = VALUES(genero),
            lugar_nacimiento = VALUES(lugar_nacimiento),
            direccion_habitacion = VALUES(direccion_habitacion),
            tipo_sangre = VALUES(tipo_sangre),
            alergias_condiciones = VALUES(alergias_condiciones),
            vive_con = VALUES(vive_con),
            id = LAST_INSERT_ID(id)`,
        [alTipo, alDoc, alNombres, alApellidos, reg.alumnoFechaNac || null, reg.alumnoGenero || 'MASCULINO', reg.alumnoLugarNac || '', reg.alumnoDireccion || '', reg.alumnoSangre || 'O+', reg.alumnoAlergias || '', reg.alumnoViveCon || 'Ambos Padres']
    );
    alumnoId = resAl.insertId;

    let repreId = null;
    const [resRep] = await conn.query(
        `INSERT INTO representantes (tipo_documento, numero_identificacion, nombres, apellidos, parentesco, telefono_principal, correo, profesion_ocupacion, direccion_habitacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            nombres = VALUES(nombres),
            apellidos = VALUES(apellidos),
            parentesco = VALUES(parentesco),
            telefono_principal = VALUES(telefono_principal),
            correo = VALUES(correo),
            profesion_ocupacion = VALUES(profesion_ocupacion),
            direccion_habitacion = VALUES(direccion_habitacion),
            id = LAST_INSERT_ID(id)`,
        [repTipo, repDoc, repNombres, repApellidos, reg.repreParentesco || 'MADRE', reg.repreTelefono || '', reg.repreCorreo || '', reg.repreOcupacion || '', reg.repreDireccion || '']
    );
    repreId = resRep.insertId;

    let instId = null;
    if (reg.instituto && reg.instituto !== 'Primer Ingreso') {
        const [resInst] = await conn.query(
            `INSERT INTO institutos (codigo_plantel, nombre, tipo_institucion, ciudad)
             VALUES (?, ?, ?, ?)`,
            [reg.institutoCodigo || '', reg.instituto, reg.institutoTipo || 'PUBLICA', reg.institutoCiudad || 'San Francisco, Zulia']
        );
        instId = resInst.insertId;
    }

    const gradoId = parseInt(reg.gradoId || '1', 10) || 1;
    const idUser = parseInt(reg.idUser || '1', 10) || 1;

    const [resPre] = await conn.query(
        `INSERT INTO preinscripciones (codigo_solicitud, id_repre, id_alumno, id_instituto, id_g_periodo, id_user, estado, datos_completos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            id_repre = VALUES(id_repre),
            id_alumno = VALUES(id_alumno),
            id_instituto = VALUES(id_instituto),
            id_g_periodo = VALUES(id_g_periodo),
            estado = VALUES(estado),
            datos_completos = VALUES(datos_completos),
            updated_at = NOW()`,
        [cod, repreId, alumnoId, instId, gradoId, idUser, est, jsonStr]
    );

    const preId = resPre.insertId || (await conn.query(`SELECT id FROM preinscripciones WHERE codigo_solicitud = ?`, [cod]))[0][0]?.id;

    if (preId && reg.documentos) {
        await conn.query(`DELETE FROM preinscripcion_documentos WHERE id_pre = ?`, [preId]);
        for (const [docId, docEstado] of Object.entries(reg.documentos)) {
            await conn.query(
                `INSERT INTO preinscripcion_documentos (id_pre, id_documento, estado, fecha_entrega)
                 VALUES (?, ?, ?, NOW())`,
                [preId, parseInt(docId, 10), docEstado]
            );
        }
    }
}

// ==============================================================================
// CONFIGURACIÓN DE MIDDLEWARE DE EXPRESS
// ==============================================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de autenticación y protección para rutas administrativas sensibles
function authSuperrootMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer ')) 
        ? authHeader.slice(7) 
        : (req.query.token || req.body?.token);

    if (verificarTokenSuperroot(token)) {
        req.superroot = true;
        return next();
    }
    return res.status(401).json({
        success: false,
        error: 'Acceso no autorizado: Se requieren credenciales de Administrador Maestro (Superroot).'
    });
}

// Servir archivos estáticos del directorio raíz
app.use(express.static(__dirname));

// ==============================================================================
// RUTAS DE AUTENTICACIÓN Y GESTIÓN SUPERROOT (ADMINISTRADOR MAESTRO)
// ==============================================================================

// 1. Iniciar Sesión como Administrador Maestro (Superroot)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;
        const u = (usuario || '').trim().toLowerCase();
        const p = (password || '').trim();

        const isUserMatch = (u === SUPERROOT_USER.toLowerCase() || u === 'mantecosadmin');
        const isPassMatch = (p === SUPERROOT_PASS);

        if (isUserMatch && isPassMatch) {
            const token = generarTokenSuperroot();
            await registrarLog(u, 'SUPERROOT', 'LOGIN_SUPERROOT', 'Acceso autenticado al Panel Maestro Superroot.', req);
            return res.json({
                success: true,
                message: 'Autenticación de Superroot exitosa.',
                token,
                role: 'SUPERROOT',
                usuario: u
            });
        }

        await registrarLog(u || 'desconocido', 'ANONIMO', 'FALLO_LOGIN_SUPERROOT', `Intento de acceso inválido con usuario: ${u}`, req);
        return res.status(401).json({
            success: false,
            error: 'Credenciales del Administrador Maestro incorrectas. Verifique usuario y contraseña de alta seguridad.'
        });
    } catch (e) {
        console.error('[POST /api/admin/login]', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Verificar Sesión de Superroot
app.get('/api/admin/verificar-sesion', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : req.query.token;

    if (verificarTokenSuperroot(token)) {
        return res.json({ success: true, valid: true });
    }
    return res.status(401).json({ success: false, valid: false, error: 'Sesión inválida o expirada.' });
});

// 3. Listar solicitudes de registro de docentes pendientes (is_approved = 0)
app.get('/api/admin/docentes/pendientes', authSuperrootMiddleware, async (req, res) => {
    try {
        let lista = [];
        const docentesLocal = leerDocentesArchivo();
        const pendientesLocal = docentesLocal.filter(d => d.is_approved === 0);

        if (isMySQLConnected && pool) {
            try {
                const [rows] = await pool.query(`
                    SELECT id, nombres, apellidos, correo, usuario, pregunta_seguridad, is_approved, fecha_registro
                    FROM docentes
                    WHERE is_approved = 0
                    ORDER BY id DESC
                `);
                lista = rows || [];

                // Combinar con solicitudes locales que no figuren en MySQL para garantizar visibilidad total
                for (const p of pendientesLocal) {
                    if (!lista.some(r => r.usuario.toLowerCase() === p.usuario.toLowerCase())) {
                        lista.push(p);
                    }
                }
                return res.json({ success: true, data: lista });
            } catch (err) {
                console.warn('[MySQL Docentes Pendientes Error]', err.message);
            }
        }

        res.json({ success: true, data: pendientesLocal });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Listar todos los docentes registrados
app.get('/api/admin/docentes', authSuperrootMiddleware, async (req, res) => {
    try {
        const docentesLocal = leerDocentesArchivo();
        const segurosLocal = docentesLocal.map(({ password_hash, respuesta_seguridad_hash, ...rest }) => rest);

        if (isMySQLConnected && pool) {
            try {
                const [rows] = await pool.query(`
                    SELECT id, nombres, apellidos, correo, usuario, pregunta_seguridad, is_approved, fecha_registro, fecha_aprobacion, aprobado_por
                    FROM docentes
                    ORDER BY id DESC
                `);
                let lista = rows || [];
                for (const d of segurosLocal) {
                    if (!lista.some(r => r.usuario.toLowerCase() === d.usuario.toLowerCase())) {
                        lista.push(d);
                    }
                }
                return res.json({ success: true, data: lista });
            } catch (err) {
                console.warn('[MySQL Docentes Error]', err.message);
            }
        }

        res.json({ success: true, data: segurosLocal });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5. Aprobar solicitud de registro docente
app.post('/api/admin/docentes/:id/aprobar', authSuperrootMiddleware, async (req, res) => {
    try {
        const rawId = req.params.id;
        const bodyUsuario = (req.body && req.body.usuario) ? String(req.body.usuario).trim().toLowerCase() : null;
        const numId = parseInt(rawId, 10);
        const ahora = new Date().toISOString();

        let target = null;
        let docentes = leerDocentesArchivo();

        // 1. Buscar en MySQL primero si está conectado
        if (isMySQLConnected && pool) {
            try {
                let sql = '';
                let params = [];
                if (!isNaN(numId) && bodyUsuario) {
                    sql = `SELECT * FROM docentes WHERE id = ? OR usuario = ?`;
                    params = [numId, bodyUsuario];
                } else if (!isNaN(numId)) {
                    sql = `SELECT * FROM docentes WHERE id = ? OR usuario = ?`;
                    params = [numId, String(rawId)];
                } else {
                    sql = `SELECT * FROM docentes WHERE usuario = ?`;
                    params = [String(rawId).toLowerCase()];
                }

                const [rows] = await pool.query(sql, params);
                if (rows && rows.length > 0) {
                    target = rows[0];
                    await pool.query(
                        `UPDATE docentes 
                         SET is_approved = 1, fecha_aprobacion = NOW(), aprobado_por = 'superroot'
                         WHERE id = ?`,
                        [target.id]
                    );
                }
            } catch (err) {
                console.error('[MySQL Aprobar Docente Error]', err.message);
            }
        }

        // 2. Buscar en archivo local por ID numérico, ID string o Usuario
        let targetIndex = docentes.findIndex(d => 
            (!isNaN(numId) && (d.id === numId || String(d.id) === String(numId))) ||
            (bodyUsuario && d.usuario && d.usuario.toLowerCase() === bodyUsuario) ||
            (target && d.usuario && d.usuario.toLowerCase() === target.usuario.toLowerCase()) ||
            (d.usuario && d.usuario.toLowerCase() === String(rawId).toLowerCase())
        );

        if (targetIndex !== -1) {
            docentes[targetIndex].is_approved = 1;
            docentes[targetIndex].fecha_aprobacion = ahora;
            docentes[targetIndex].aprobado_por = 'superroot';
            if (target && target.id) {
                docentes[targetIndex].id = target.id;
            }
            if (!target) {
                target = docentes[targetIndex];
            }
        } else if (target) {
            // Existe en MySQL pero no en archivo local: sincronizar agregándolo
            docentes.push({
                id: target.id,
                nombres: target.nombres,
                apellidos: target.apellidos,
                correo: target.correo,
                usuario: target.usuario,
                password_hash: target.password_hash,
                pregunta_seguridad: target.pregunta_seguridad,
                respuesta_seguridad_hash: target.respuesta_seguridad_hash,
                is_approved: 1,
                fecha_registro: target.fecha_registro || ahora,
                fecha_aprobacion: ahora,
                aprobado_por: 'superroot'
            });
        }

        guardarDocentesArchivo(docentes);

        // Si se encontró sólo en local y MySQL está conectado, sincronizar en MySQL
        if (target && isMySQLConnected && pool) {
            try {
                await pool.query(
                    `UPDATE docentes 
                     SET is_approved = 1, fecha_aprobacion = NOW(), aprobado_por = 'superroot'
                     WHERE usuario = ? OR id = ?`,
                    [target.usuario, target.id]
                );
            } catch (syncErr) {
                console.warn('[MySQL Sync Approval Warning]', syncErr.message);
            }
        }

        if (!target) {
            return res.status(404).json({ success: false, error: 'Docente no encontrado en el sistema.' });
        }

        await registrarLog(
            'superroot',
            'SUPERROOT',
            'APROBACION_DOCENTE',
            `El Administrador Maestro autorizó la cuenta del docente ${target.nombres} ${target.apellidos} (@${target.usuario}, ${target.correo}).`,
            req
        );

        res.json({
            success: true,
            message: `Docente ${target.nombres} ${target.apellidos} (@${target.usuario}) aprobado exitosamente. Ya puede iniciar sesión.`
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. Rechazar / Eliminar solicitud de registro docente
app.post('/api/admin/docentes/:id/rechazar', authSuperrootMiddleware, async (req, res) => {
    try {
        const rawId = req.params.id;
        const bodyUsuario = (req.body && req.body.usuario) ? String(req.body.usuario).trim().toLowerCase() : null;
        const numId = parseInt(rawId, 10);

        let target = null;
        let docentes = leerDocentesArchivo();

        // Proteger cuenta maestra base
        if (bodyUsuario === 'manteca' || String(rawId).toLowerCase() === 'manteca' || rawId === '1') {
            return res.status(400).json({ success: false, error: 'No es posible rechazar ni eliminar la cuenta base institucional.' });
        }

        // 1. Eliminar en MySQL si está conectado
        if (isMySQLConnected && pool) {
            try {
                let sql = '';
                let params = [];
                if (!isNaN(numId) && bodyUsuario) {
                    sql = `SELECT * FROM docentes WHERE id = ? OR usuario = ?`;
                    params = [numId, bodyUsuario];
                } else if (!isNaN(numId)) {
                    sql = `SELECT * FROM docentes WHERE id = ? OR usuario = ?`;
                    params = [numId, String(rawId)];
                } else {
                    sql = `SELECT * FROM docentes WHERE usuario = ?`;
                    params = [String(rawId).toLowerCase()];
                }

                const [rows] = await pool.query(sql, params);
                if (rows && rows.length > 0) {
                    target = rows[0];
                    if (target.usuario === 'manteca' || target.id === 1) {
                        return res.status(400).json({ success: false, error: 'No es posible rechazar ni eliminar la cuenta base institucional.' });
                    }
                    await pool.query(`DELETE FROM docentes WHERE id = ?`, [target.id]);
                }
            } catch (err) {
                console.error('[MySQL Rechazar Docente Error]', err.message);
            }
        }

        // 2. Eliminar en archivo local
        let targetIndex = docentes.findIndex(d => 
            (!isNaN(numId) && (d.id === numId || String(d.id) === String(numId))) ||
            (bodyUsuario && d.usuario && d.usuario.toLowerCase() === bodyUsuario) ||
            (target && d.usuario && d.usuario.toLowerCase() === target.usuario.toLowerCase()) ||
            (d.usuario && d.usuario.toLowerCase() === String(rawId).toLowerCase())
        );

        if (targetIndex !== -1) {
            if (docentes[targetIndex].usuario === 'manteca' || docentes[targetIndex].id === 1) {
                return res.status(400).json({ success: false, error: 'No es posible rechazar ni eliminar la cuenta base institucional.' });
            }
            if (!target) target = docentes[targetIndex];
            docentes.splice(targetIndex, 1);
            guardarDocentesArchivo(docentes);
        }

        if (!target) {
            return res.status(404).json({ success: false, error: 'Docente no encontrado en el sistema.' });
        }

        await registrarLog(
            'superroot',
            'SUPERROOT',
            'RECHAZO_DOCENTE',
            `El Administrador Maestro denegó y removió la solicitud de registro del docente ${target.nombres} ${target.apellidos} (@${target.usuario}).`,
            req
        );

        res.json({
            success: true,
            message: `Solicitud del docente @${target.usuario} rechazada y removida del sistema.`
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6.1. Suspender o Reactivar Docente
app.post('/api/admin/docentes/:id/suspender', authSuperrootMiddleware, async (req, res) => {
    try {
        const rawId = req.params.id;
        const numId = parseInt(rawId, 10);
        const { nuevoEstado, usuario } = req.body;
        const bodyUsuario = usuario ? String(usuario).trim().toLowerCase() : null;
        const targetEstado = Number(nuevoEstado) === 2 ? 2 : 1; // 2: Suspendido, 1: Activo

        if (bodyUsuario === 'manteca' || String(rawId).toLowerCase() === 'manteca' || rawId === '1') {
            return res.status(400).json({ success: false, error: 'No es posible suspender la cuenta base institucional (manteca).' });
        }

        let target = null;
        let docentes = leerDocentesArchivo();

        // 1. Actualizar en MySQL
        if (isMySQLConnected && pool) {
            try {
                let sql = !isNaN(numId) && bodyUsuario
                    ? `SELECT * FROM docentes WHERE id = ? OR usuario = ?`
                    : (!isNaN(numId) ? `SELECT * FROM docentes WHERE id = ? OR usuario = ?` : `SELECT * FROM docentes WHERE usuario = ?`);
                let params = !isNaN(numId) && bodyUsuario ? [numId, bodyUsuario] : (!isNaN(numId) ? [numId, String(rawId)] : [String(rawId).toLowerCase()]);

                const [rows] = await pool.query(sql, params);
                if (rows && rows.length > 0) {
                    target = rows[0];
                    if (target.usuario === 'manteca' || target.id === 1) {
                        return res.status(400).json({ success: false, error: 'No es posible suspender la cuenta base institucional.' });
                    }
                    await pool.query(`UPDATE docentes SET is_approved = ? WHERE id = ?`, [targetEstado, target.id]);
                }
            } catch (err) {
                console.error('[MySQL Suspender Docente Error]', err.message);
            }
        }

        // 2. Actualizar en archivo local
        let targetIndex = docentes.findIndex(d =>
            (!isNaN(numId) && (d.id === numId || String(d.id) === String(numId))) ||
            (bodyUsuario && d.usuario && d.usuario.toLowerCase() === bodyUsuario) ||
            (target && d.usuario && d.usuario.toLowerCase() === target.usuario.toLowerCase()) ||
            (d.usuario && d.usuario.toLowerCase() === String(rawId).toLowerCase())
        );

        if (targetIndex !== -1) {
            if (docentes[targetIndex].usuario === 'manteca' || docentes[targetIndex].id === 1) {
                return res.status(400).json({ success: false, error: 'No es posible suspender la cuenta base institucional.' });
            }
            docentes[targetIndex].is_approved = targetEstado;
            if (!target) target = docentes[targetIndex];
            guardarDocentesArchivo(docentes);
        }

        if (!target) {
            return res.status(404).json({ success: false, error: 'Docente no encontrado en el sistema.' });
        }

        const accionAudit = targetEstado === 2 ? 'DOCENTE_SUSPENDIDO' : 'DOCENTE_REACTIVADO';
        const descAudit = targetEstado === 2
            ? `El Superroot suspendió el acceso al sistema del docente ${target.nombres} ${target.apellidos} (@${target.usuario}).`
            : `El Superroot reactivó el acceso al sistema del docente ${target.nombres} ${target.apellidos} (@${target.usuario}).`;

        await registrarLog('superroot', 'SUPERROOT', accionAudit, descAudit, req);

        res.json({
            success: true,
            message: targetEstado === 2
                ? `Docente @${target.usuario} suspendido correctamente.`
                : `Docente @${target.usuario} reactivado con éxito.`,
            is_approved: targetEstado
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6.2. Resetear contraseña de docente desde el Superroot
app.post('/api/admin/docentes/:id/reset-password', authSuperrootMiddleware, async (req, res) => {
    try {
        const rawId = req.params.id;
        const numId = parseInt(rawId, 10);
        const { nueva_password, usuario } = req.body;
        const bodyUsuario = usuario ? String(usuario).trim().toLowerCase() : null;

        if (!nueva_password) {
            return res.status(400).json({ success: false, error: 'Debe ingresar la nueva contraseña.' });
        }

        const valPass = validarPasswordSegura(nueva_password);
        if (!valPass.valida) {
            return res.status(400).json({ success: false, error: valPass.error });
        }

        const nuevoHash = hashPassword(nueva_password);
        let target = null;
        let docentes = leerDocentesArchivo();

        // 1. Actualizar en MySQL
        if (isMySQLConnected && pool) {
            try {
                let sql = !isNaN(numId) && bodyUsuario
                    ? `SELECT * FROM docentes WHERE id = ? OR usuario = ?`
                    : (!isNaN(numId) ? `SELECT * FROM docentes WHERE id = ? OR usuario = ?` : `SELECT * FROM docentes WHERE usuario = ?`);
                let params = !isNaN(numId) && bodyUsuario ? [numId, bodyUsuario] : (!isNaN(numId) ? [numId, String(rawId)] : [String(rawId).toLowerCase()]);

                const [rows] = await pool.query(sql, params);
                if (rows && rows.length > 0) {
                    target = rows[0];
                    await pool.query(`UPDATE docentes SET password_hash = ? WHERE id = ?`, [nuevoHash, target.id]);
                }
            } catch (err) {
                console.error('[MySQL Reset Password Error]', err.message);
            }
        }

        // 2. Actualizar en archivo local
        let targetIndex = docentes.findIndex(d =>
            (!isNaN(numId) && (d.id === numId || String(d.id) === String(numId))) ||
            (bodyUsuario && d.usuario && d.usuario.toLowerCase() === bodyUsuario) ||
            (target && d.usuario && d.usuario.toLowerCase() === target.usuario.toLowerCase()) ||
            (d.usuario && d.usuario.toLowerCase() === String(rawId).toLowerCase())
        );

        if (targetIndex !== -1) {
            docentes[targetIndex].password_hash = nuevoHash;
            if (!target) target = docentes[targetIndex];
            guardarDocentesArchivo(docentes);
        }

        if (!target) {
            return res.status(404).json({ success: false, error: 'Docente no encontrado en el sistema.' });
        }

        await registrarLog(
            'superroot',
            'SUPERROOT',
            'RESET_PASSWORD_ADMIN',
            `El Administrador Maestro asignó una nueva contraseña a la cuenta del docente ${target.nombres} ${target.apellidos} (@${target.usuario}).`,
            req
        );

        res.json({
            success: true,
            message: `Contraseña del docente @${target.usuario} actualizada satisfactoriamente.`
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6.3. Eliminar definitivamente cuenta docente
app.delete('/api/admin/docentes/:id', authSuperrootMiddleware, async (req, res) => {
    try {
        const rawId = req.params.id;
        const numId = parseInt(rawId, 10);
        const bodyUsuario = (req.body && req.body.usuario) ? String(req.body.usuario).trim().toLowerCase() : null;

        if (bodyUsuario === 'manteca' || String(rawId).toLowerCase() === 'manteca' || rawId === '1') {
            return res.status(400).json({ success: false, error: 'No es posible eliminar la cuenta base institucional (manteca).' });
        }

        let target = null;
        let docentes = leerDocentesArchivo();

        // 1. Eliminar en MySQL
        if (isMySQLConnected && pool) {
            try {
                let sql = !isNaN(numId) && bodyUsuario
                    ? `SELECT * FROM docentes WHERE id = ? OR usuario = ?`
                    : (!isNaN(numId) ? `SELECT * FROM docentes WHERE id = ? OR usuario = ?` : `SELECT * FROM docentes WHERE usuario = ?`);
                let params = !isNaN(numId) && bodyUsuario ? [numId, bodyUsuario] : (!isNaN(numId) ? [numId, String(rawId)] : [String(rawId).toLowerCase()]);

                const [rows] = await pool.query(sql, params);
                if (rows && rows.length > 0) {
                    target = rows[0];
                    if (target.usuario === 'manteca' || target.id === 1) {
                        return res.status(400).json({ success: false, error: 'No es posible eliminar la cuenta base institucional.' });
                    }
                    await pool.query(`DELETE FROM docentes WHERE id = ?`, [target.id]);
                }
            } catch (err) {
                console.error('[MySQL Eliminar Docente Error]', err.message);
            }
        }

        // 2. Eliminar en archivo local
        let targetIndex = docentes.findIndex(d =>
            (!isNaN(numId) && (d.id === numId || String(d.id) === String(numId))) ||
            (bodyUsuario && d.usuario && d.usuario.toLowerCase() === bodyUsuario) ||
            (target && d.usuario && d.usuario.toLowerCase() === target.usuario.toLowerCase()) ||
            (d.usuario && d.usuario.toLowerCase() === String(rawId).toLowerCase())
        );

        if (targetIndex !== -1) {
            if (docentes[targetIndex].usuario === 'manteca' || docentes[targetIndex].id === 1) {
                return res.status(400).json({ success: false, error: 'No es posible eliminar la cuenta base institucional.' });
            }
            if (!target) target = docentes[targetIndex];
            docentes.splice(targetIndex, 1);
            guardarDocentesArchivo(docentes);
        }

        if (!target) {
            return res.status(404).json({ success: false, error: 'Docente no encontrado en el sistema.' });
        }

        await registrarLog(
            'superroot',
            'SUPERROOT',
            'DOCENTE_ELIMINADO',
            `El Administrador Maestro eliminó definitivamente la cuenta del docente ${target.nombres} ${target.apellidos} (@${target.usuario}) de la base de datos.`,
            req
        );

        res.json({
            success: true,
            message: `Docente @${target.usuario} eliminado permanentemente del sistema.`
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6.4. Consultar estado del proceso de admisión y cupos por grado
app.get('/api/proceso-admision/estado', async (req, res) => {
    try {
        const config = leerConfigSistema();
        const preinscripciones = leerRegistrosArchivo();

        // Contar cupos ocupados por grado (1 a 6)
        const cuposOcupados = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
        const desgloseEstados = {
            aprobadas: 0,
            en_revision: 0,
            incompletas: 0,
            total: preinscripciones.length
        };

        preinscripciones.forEach(p => {
            const gid = String(p.gradoId || '');
            if (cuposOcupados[gid] !== undefined) {
                cuposOcupados[gid]++;
            } else if (p.grado) {
                for (let i = 1; i <= 6; i++) {
                    if (p.grado.includes(`${i}er`) || p.grado.includes(`${i}do`) || p.grado.includes(`${i}to`) || p.grado.includes(`${i}mo`) || p.grado.startsWith(String(i))) {
                        cuposOcupados[String(i)]++;
                        break;
                    }
                }
            }

            let entregados = 0;
            if (p.documentos) {
                for (let i = 1; i <= 4; i++) {
                    const e = p.documentos[String(i)] || (p.archivos && p.archivos[String(i)] ? 'CONSIGNADO' : 'NO_CONSIGNADO');
                    if (e === 'APROBADO' || e === 'CONSIGNADO') entregados++;
                }
            } else if (p.recaudosCount) {
                entregados = parseInt(p.recaudosCount.split('/')[0] || '0', 10);
            }

            let est = (p.estado || '').toUpperCase();
            if (entregados < 4) {
                est = 'DOCUMENTOS_INCOMPLETOS';
            } else if (est === 'DOCUMENTOS_INCOMPLETOS' || !est) {
                est = 'EN_REVISION';
            }

            if (est === 'APROBADA') desgloseEstados.aprobadas++;
            else if (est === 'EN_REVISION') desgloseEstados.en_revision++;
            else desgloseEstados.incompletas++;
        });

        res.json({
            success: true,
            procesoAbierto: config.procesoAbierto,
            cuposPorGrado: config.cuposPorGrado,
            cuposOcupados,
            desgloseEstados,
            ultimaModificacion: config.ultimaModificacion
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6.5. Alternar apertura / cierre del proceso de admisión
app.post('/api/admin/proceso-admision/toggle', authSuperrootMiddleware, async (req, res) => {
    try {
        const config = leerConfigSistema();
        config.procesoAbierto = req.body.procesoAbierto !== undefined ? Boolean(req.body.procesoAbierto) : !config.procesoAbierto;
        config.ultimaModificacion = new Date().toISOString();
        guardarConfigSistema(config);

        // Actualizar en MySQL si está conectado
        if (isMySQLConnected && pool) {
            try {
                const nuevoEstadoSQL = config.procesoAbierto ? 'PREINSCRIPCION_ABIERTA' : 'PREINSCRIPCION_CERRADA';
                await pool.query(`UPDATE periodos_academicos SET estado = ? WHERE id = 1`, [nuevoEstadoSQL]);
            } catch (err) {
                console.error('[MySQL Toggle Periodo Error]', err.message);
            }
        }

        const accionAudit = config.procesoAbierto ? 'PROCESO_ADMISIÓN_ABIERTO' : 'PROCESO_ADMISIÓN_CERRADO';
        const descAudit = config.procesoAbierto
            ? 'El Administrador Maestro ACTIVÓ Y ABRIÓ el proceso general de preinscripciones escolares 2026-2027.'
            : 'El Administrador Maestro CERRÓ Y BLOQUEÓ el proceso general de preinscripciones escolares 2026-2027.';

        await registrarLog('superroot', 'SUPERROOT', accionAudit, descAudit, req);

        res.json({
            success: true,
            procesoAbierto: config.procesoAbierto,
            message: config.procesoAbierto ? 'Proceso de admisión abierto exitosamente.' : 'Proceso de admisión cerrado exitosamente.'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6.6. Ajustar capacidad máxima de cupos por grado
app.post('/api/admin/proceso-admision/cupos', authSuperrootMiddleware, async (req, res) => {
    try {
        const { gradoId, nuevoLimite } = req.body;
        const gid = String(gradoId);
        const limite = parseInt(nuevoLimite, 10);

        if (!gid || isNaN(limite) || limite <= 0 || limite > 500) {
            return res.status(400).json({ success: false, error: 'Límite de cupos inválido (debe ser un valor positivo entre 1 y 500).' });
        }

        const config = leerConfigSistema();
        config.cuposPorGrado[gid] = limite;
        config.ultimaModificacion = new Date().toISOString();
        guardarConfigSistema(config);

        await registrarLog(
            'superroot',
            'SUPERROOT',
            'AJUSTE_CAPACIDAD_CUPOS',
            `Se ajustó la capacidad del ${gid}° Grado de Primaria a un máximo de ${limite} cupos.`,
            req
        );

        res.json({
            success: true,
            cuposPorGrado: config.cuposPorGrado,
            message: `Capacidad del ${gid}° Grado actualizada a ${limite} cupos.`
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6.7. Descargar Respaldo Completo del Sistema (JSON)
app.get('/api/admin/backup', authSuperrootMiddleware, async (req, res) => {
    try {
        const preinscripciones = leerRegistrosArchivo();
        const docentes = leerDocentesArchivo();
        const logs = leerLogsArchivo();
        const config = leerConfigSistema();

        const backupData = {
            institucion: 'U.E. Fe y Alegría "Nueva América"',
            periodo: '2026-2027',
            fecha_exportacion: new Date().toISOString(),
            exportado_por: 'superroot',
            total_preinscripciones: preinscripciones.length,
            total_docentes: docentes.length,
            total_logs: logs.length,
            configuracion: config,
            docentes: docentes.map(({ password_hash, respuesta_seguridad_hash, ...d }) => d),
            preinscripciones: preinscripciones,
            system_logs: logs
        };

        await registrarLog(
            'superroot',
            'SUPERROOT',
            'BACKUP_DESCARGADO',
            `Respaldo completo del sistema descargado en formato JSON (${preinscripciones.length} expedientes, ${docentes.length} docentes, ${logs.length} logs).`,
            req
        );

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="backup_feyalegria_${new Date().toISOString().slice(0, 10)}.json"`);
        res.send(JSON.stringify(backupData, null, 2));
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6.8. Descargar Preinscripciones en Formato CSV
app.get('/api/admin/backup/csv', authSuperrootMiddleware, async (req, res) => {
    try {
        const registros = leerRegistrosArchivo();
        const headers = [
            'Codigo', 'Estado', 'Fecha', 'Alumno', 'Alumno_Doc', 'Grado', 'Genero',
            'Fecha_Nac', 'Lugar_Nac', 'Direccion', 'Alergias', 'Vive_Con',
            'Representante', 'Repre_Doc', 'Parentesco', 'Telefono', 'Correo', 'Ocupacion',
            'Instituto_Procedencia', 'Recaudos'
        ];
        const escapeCSV = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

        const rows = registros.map(r => [
            escapeCSV(r.codigo),
            escapeCSV(r.estado),
            escapeCSV(r.fecha),
            escapeCSV(r.alumno),
            escapeCSV(r.alumnoDoc),
            escapeCSV(r.grado),
            escapeCSV(r.alumnoGenero),
            escapeCSV(r.alumnoFechaNac),
            escapeCSV(r.alumnoLugarNac),
            escapeCSV(r.alumnoDireccion),
            escapeCSV(r.alumnoAlergias),
            escapeCSV(r.alumnoViveCon),
            escapeCSV(r.representante),
            escapeCSV(r.repreDoc),
            escapeCSV(r.repreParentesco),
            escapeCSV(r.repreTelefono),
            escapeCSV(r.repreCorreo),
            escapeCSV(r.repreOcupacion),
            escapeCSV(r.instituto),
            escapeCSV(r.recaudosCount)
        ].join(','));

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

        await registrarLog(
            'superroot',
            'SUPERROOT',
            'BACKUP_DESCARGADO',
            `Exportación CSV de preinscritos generada satisfactoriamente (${registros.length} expedientes).`,
            req
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="preinscripciones_feyalegria_${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(csvContent);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==============================================================================
// RUTAS DE REGISTRO, AUTENTICACIÓN Y RECUPERACIÓN DOCENTE
// ==============================================================================

// 7. Registro de nuevo docente (solicitud en estado pendiente is_approved = 0)
app.post('/api/docente/registro', async (req, res) => {
    try {
        const { nombres, apellidos, correo, usuario, password, pregunta_seguridad, respuesta_seguridad } = req.body;

        if (!nombres || !apellidos || !correo || !usuario || !password || !pregunta_seguridad || !respuesta_seguridad) {
            return res.status(400).json({
                success: false,
                error: 'Todos los campos son obligatorios para tramitar la solicitud de acceso docente.'
            });
        }

        // Validación estricta de parámetros de contraseña
        const valPass = validarPasswordSegura(password);
        if (!valPass.valida) {
            return res.status(400).json({
                success: false,
                error: valPass.error
            });
        }

        const uLimpio = usuario.trim().toLowerCase();
        const cLimpio = correo.trim().toLowerCase();

        // Verificar duplicados en archivo local
        const docentes = leerDocentesArchivo();
        const yaExisteLocal = docentes.some(d => d.usuario.toLowerCase() === uLimpio || d.correo.toLowerCase() === cLimpio);
        if (yaExisteLocal) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe un usuario o correo registrado con esos datos. Verifique o intente recuperar su acceso.'
            });
        }

        // Verificar duplicados en MySQL
        if (isMySQLConnected && pool) {
            try {
                const [dup] = await pool.query(
                    `SELECT id FROM docentes WHERE usuario = ? OR correo = ?`,
                    [uLimpio, cLimpio]
                );
                if (dup.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'El nombre de usuario o correo institucional ya se encuentra registrado.'
                    });
                }
            } catch (e) {
                console.warn('[MySQL Dup Check]', e.message);
            }
        }

        let nuevoId = Date.now();
        const passHash = hashPassword(password);
        const ansHash = hashRespuesta(respuesta_seguridad);
        const ahora = new Date().toISOString();

        // Guardar primero en MySQL si está conectado para obtener el mismo ID consistente
        if (isMySQLConnected && pool) {
            try {
                const [result] = await pool.query(
                    `INSERT INTO docentes (nombres, apellidos, correo, usuario, password_hash, pregunta_seguridad, respuesta_seguridad_hash, is_approved, fecha_registro)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
                    [nombres.trim(), apellidos.trim(), cLimpio, uLimpio, passHash, pregunta_seguridad.trim(), ansHash]
                );
                if (result && result.insertId) {
                    nuevoId = result.insertId;
                }
            } catch (sqlErr) {
                console.error('[MySQL Guardar Registro Docente]', sqlErr.message);
            }
        }

        const nuevoDocente = {
            id: nuevoId,
            nombres: nombres.trim(),
            apellidos: apellidos.trim(),
            correo: cLimpio,
            usuario: uLimpio,
            password_hash: passHash,
            pregunta_seguridad: pregunta_seguridad.trim(),
            respuesta_seguridad_hash: ansHash,
            is_approved: 0, // Pendiente de autorización
            fecha_registro: ahora,
            fecha_aprobacion: null,
            aprobado_por: null
        };

        docentes.push(nuevoDocente);
        guardarDocentesArchivo(docentes);

        await registrarLog(
            uLimpio,
            'DOCENTE',
            'REGISTRO_DOCENTE',
            `Nueva solicitud de acceso docente radicada por ${nombres} ${apellidos} (${cLimpio}). Estado: En espera de aprobación por el Superroot.`,
            req
        );

        res.json({
            success: true,
            message: 'Solicitud enviada con éxito. Su cuenta se encuentra a la espera de autorización por parte del Administrador.'
        });
    } catch (e) {
        console.error('[POST /api/docente/registro]', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 8. Inicio de sesión del personal docente
app.post('/api/docente/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;
        if (!usuario || !password) {
            return res.status(400).json({ success: false, error: 'Debe ingresar su usuario y contraseña.' });
        }

        const uLimpio = usuario.trim().toLowerCase();
        let docenteEncontrado = null;

        // 1. Buscar en MySQL si está conectado
        if (isMySQLConnected && pool) {
            try {
                const [rows] = await pool.query(
                    `SELECT id, nombres, apellidos, correo, usuario, password_hash, is_approved FROM docentes WHERE usuario = ? OR correo = ?`,
                    [uLimpio, uLimpio]
                );
                if (rows.length > 0) {
                    docenteEncontrado = rows[0];
                }
            } catch (sqlErr) {
                console.warn('[MySQL Docente Login Error]', sqlErr.message);
            }
        }

        // 2. Si no se encontró en MySQL, buscar en archivo local
        if (!docenteEncontrado) {
            const docentes = leerDocentesArchivo();
            docenteEncontrado = docentes.find(d => d.usuario.toLowerCase() === uLimpio || d.correo.toLowerCase() === uLimpio);
        }

        if (!docenteEncontrado) {
            return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos. Por favor verifique sus datos.' });
        }

        // Verificar contraseña
        const passValida = verifyPassword(password, docenteEncontrado.password_hash);
        if (!passValida) {
            await registrarLog(uLimpio, 'DOCENTE', 'FALLO_LOGIN_DOCENTE', `Contraseña errónea para el usuario @${uLimpio}`, req);
            return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos. Por favor verifique sus datos.' });
        }

        // Validar Estado de Aprobación
        if (docenteEncontrado.is_approved === 0) {
            return res.status(403).json({
                success: false,
                isPending: true,
                error: 'Su cuenta se encuentra registrada pero aún está a la espera de autorización por parte del Administrador Maestro.'
            });
        }

        if (docenteEncontrado.is_approved === 2) {
            return res.status(403).json({
                success: false,
                isSuspended: true,
                error: 'Su cuenta docente ha sido temporalmente SUSPENDIDA por el Administrador Maestro. Comuníquese con la Coordinación del plantel.'
            });
        }

        if (docenteEncontrado.is_approved === -1) {
            return res.status(403).json({
                success: false,
                isRejected: true,
                error: 'Su solicitud de acceso docente ha sido denegada por la Coordinación del plantel.'
            });
        }

        // Acceso concedido
        await registrarLog(
            docenteEncontrado.usuario,
            'DOCENTE',
            'LOGIN_DOCENTE',
            `Inicio de sesión exitoso del docente ${docenteEncontrado.nombres} ${docenteEncontrado.apellidos} (@${docenteEncontrado.usuario}).`,
            req
        );

        res.json({
            success: true,
            message: 'Inicio de sesión exitoso.',
            docente: {
                id: docenteEncontrado.id,
                nombres: docenteEncontrado.nombres,
                apellidos: docenteEncontrado.apellidos,
                usuario: docenteEncontrado.usuario,
                correo: docenteEncontrado.correo
            }
        });
    } catch (e) {
        console.error('[POST /api/docente/login]', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 9. Consultar pregunta de seguridad para recuperación
app.post('/api/docente/recuperar/pregunta', async (req, res) => {
    try {
        const { identificador } = req.body;
        if (!identificador) {
            return res.status(400).json({ success: false, error: 'Ingrese su nombre de usuario o correo institucional.' });
        }

        const idLimpio = identificador.trim().toLowerCase();
        let docente = null;

        if (isMySQLConnected && pool) {
            try {
                const [rows] = await pool.query(
                    `SELECT id, usuario, correo, pregunta_seguridad FROM docentes WHERE usuario = ? OR correo = ?`,
                    [idLimpio, idLimpio]
                );
                if (rows.length > 0) docente = rows[0];
            } catch (e) {
                console.warn('[MySQL Recuperar Pregunta]', e.message);
            }
        }

        if (!docente) {
            const docentes = leerDocentesArchivo();
            docente = docentes.find(d => d.usuario.toLowerCase() === idLimpio || d.correo.toLowerCase() === idLimpio);
        }

        if (!docente) {
            return res.status(404).json({ success: false, error: 'No se encontró ninguna cuenta docente asociada a estos datos.' });
        }

        res.json({
            success: true,
            usuario: docente.usuario,
            correo: docente.correo,
            pregunta: docente.pregunta_seguridad
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 10. Restablecer contraseña mediante validación de pregunta de seguridad
app.post('/api/docente/recuperar/reset', async (req, res) => {
    try {
        const { identificador, respuesta, nueva_password } = req.body;
        if (!identificador || !respuesta || !nueva_password) {
            return res.status(400).json({ success: false, error: 'Todos los campos son requeridos para restablecer la contraseña.' });
        }

        const idLimpio = identificador.trim().toLowerCase();
        let docente = null;

        const docentes = leerDocentesArchivo();
        const indiceLocal = docentes.findIndex(d => d.usuario.toLowerCase() === idLimpio || d.correo.toLowerCase() === idLimpio);
        if (indiceLocal !== -1) {
            docente = docentes[indiceLocal];
        }

        if (isMySQLConnected && pool && !docente) {
            try {
                const [rows] = await pool.query(
                    `SELECT * FROM docentes WHERE usuario = ? OR correo = ?`,
                    [idLimpio, idLimpio]
                );
                if (rows.length > 0) docente = rows[0];
            } catch (e) {
                console.warn('[MySQL Fetch Docente Reset]', e.message);
            }
        }

        if (!docente) {
            return res.status(404).json({ success: false, error: 'Cuenta docente no encontrada.' });
        }

        // Verificar respuesta de seguridad
        const respuestaCorrecta = verifyRespuesta(respuesta, docente.respuesta_seguridad_hash);
        if (!respuestaCorrecta) {
            return res.status(400).json({ success: false, error: 'La respuesta de seguridad es incorrecta. Por favor intente nuevamente.' });
        }

        // Validar requisitos de la nueva contraseña
        const valPass = validarPasswordSegura(nueva_password);
        if (!valPass.valida) {
            return res.status(400).json({ success: false, error: valPass.error });
        }

        // Actualizar contraseña
        const nuevoHash = hashPassword(nueva_password);

        if (indiceLocal !== -1) {
            docentes[indiceLocal].password_hash = nuevoHash;
            guardarDocentesArchivo(docentes);
        }

        if (isMySQLConnected && pool) {
            try {
                await pool.query(
                    `UPDATE docentes SET password_hash = ? WHERE usuario = ? OR correo = ?`,
                    [nuevoHash, idLimpio, idLimpio]
                );
            } catch (sqlErr) {
                console.error('[MySQL Update Clave]', sqlErr.message);
            }
        }

        await registrarLog(
            docente.usuario,
            'DOCENTE',
            'RECUPERACION_CLAVE',
            `Contraseña restablecida satisfactoriamente para la cuenta @${docente.usuario} mediante comprobación de pregunta de seguridad.`,
            req
        );

        res.json({
            success: true,
            message: 'Contraseña actualizada con éxito. Ya puede iniciar sesión con su nueva clave.'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==============================================================================
// RUTAS DE AUDITORÍA Y REGISTRO DE ACTIVIDAD (LOGS)
// ==============================================================================

// 11. Obtener historial de logs del sistema (RESTRINGIDO ESTRICTAMENTE AL SUPERROOT)
app.get('/api/logs', authSuperrootMiddleware, async (req, res) => {
    try {
        const limite = parseInt(req.query.limit || '100', 10);

        if (isMySQLConnected && pool) {
            try {
                const [rows] = await pool.query(`
                    SELECT id, timestamp, usuario, rol, accion, descripcion, ip_address 
                    FROM system_logs 
                    ORDER BY id DESC 
                    LIMIT ?
                `, [limite]);
                return res.json({ success: true, data: rows, source: 'mysql' });
            } catch (err) {
                console.warn('[MySQL Logs Error]', err.message);
            }
        }

        const logs = leerLogsArchivo().slice(0, limite);
        res.json({ success: true, data: logs, source: 'cloud_file' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==============================================================================
// RUTAS DE LA API DE PREINSCRIPCIONES (CRUD COMPLETO EN LÍNEA)
// ==============================================================================

// 12. Estado y Salud del Backend
app.get('/api/status', async (req, res) => {
    let total = 0;
    if (isMySQLConnected && pool) {
        try {
            const [rows] = await pool.query(`SELECT COUNT(*) as count FROM preinscripciones`);
            total = rows[0]?.count || 0;
        } catch (e) {
            total = leerRegistrosArchivo().length;
        }
    } else {
        total = leerRegistrosArchivo().length;
    }

    res.json({
        success: true,
        online: true,
        storage: isMySQLConnected ? 'mysql' : 'cloud_file',
        storageLabel: isMySQLConnected ? 'Base de Datos MySQL (Cloud)' : 'Almacenamiento Cloud en Servidor',
        totalRegistros: total,
        timestamp: new Date().toISOString()
    });
});

// 13. Obtener todas las preinscripciones almacenadas en la nube
app.get('/api/preinscripciones', async (req, res) => {
    try {
        if (isMySQLConnected && pool) {
            try {
                const [rows] = await pool.query(`
                    SELECT codigo_solicitud, estado, datos_completos, fecha_solicitud 
                    FROM preinscripciones 
                    ORDER BY id DESC
                `);

                const registros = rows.map(row => {
                    if (row.datos_completos) {
                        try {
                            const parsed = JSON.parse(row.datos_completos);
                            parsed.estado = row.estado || parsed.estado;
                            return parsed;
                        } catch (e) {
                            return null;
                        }
                    }
                    return null;
                }).filter(Boolean);

                if (registros.length > 0 || rows.length === 0) {
                    guardarRegistrosArchivo(registros);
                    return res.json({
                        success: true,
                        data: registros,
                        storage: 'mysql',
                        storageLabel: 'MySQL en la Nube (Railway)'
                    });
                }
            } catch (err) {
                console.warn('[MySQL Error lectura, usando fallback]', err.message);
            }
        }

        const registros = leerRegistrosArchivo();
        res.json({
            success: true,
            data: registros,
            storage: 'cloud_file',
            storageLabel: 'Almacenamiento Cloud en Servidor'
        });
    } catch (error) {
        console.error('[GET /api/preinscripciones]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 14. Registrar o actualizar preinscripción en la nube
app.post('/api/preinscripciones', async (req, res) => {
    try {
        let registro = req.body;
        if (req.body.registro) {
            registro = req.body.registro;
        }

        const config = leerConfigSistema();

        // 1. Validar si el proceso de admisión general está cerrado
        if (config.procesoAbierto === false) {
            return res.status(403).json({
                success: false,
                procesoCerrado: true,
                error: 'El proceso de preinscripción escolar 2026-2027 se encuentra actualmente CERRADO por la Dirección del plantel. No se admiten nuevas solicitudes.'
            });
        }

        if (!registro.codigo) {
            registro.codigo = `PRE-2026-${String(Date.now()).slice(-4)}`;
        }

        const registrosCloud = leerRegistrosArchivo();
        const docClave = ((registro.alumnoDoc || '').replace(/\s+/g, '')).toUpperCase();
        const indice = registrosCloud.findIndex(r => {
            if (!r) return false;
            const rDoc = ((r.alumnoDoc || '').replace(/\s+/g, '')).toUpperCase();
            return (rDoc && rDoc === docClave) || r.codigo === registro.codigo;
        });

        // 2. Validar cupos disponibles si es un aspirante nuevo (no actualización)
        let gradoIdStr = String(registro.gradoId || '1');
        if (!registro.gradoId && registro.grado) {
            for (let i = 1; i <= 6; i++) {
                if (registro.grado.includes(`${i}er`) || registro.grado.includes(`${i}do`) || registro.grado.includes(`${i}to`) || registro.grado.includes(`${i}mo`) || registro.grado.startsWith(String(i))) {
                    gradoIdStr = String(i);
                    break;
                }
            }
        }
        const limiteCupo = (config.cuposPorGrado && config.cuposPorGrado[gradoIdStr]) ? config.cuposPorGrado[gradoIdStr] : 35;
        let ocupadosGrado = 0;
        registrosCloud.forEach(r => {
            if (r) {
                const rGid = String(r.gradoId || '');
                if (rGid === gradoIdStr) ocupadosGrado++;
                else if (r.grado && (r.grado.includes(`${gradoIdStr}er`) || r.grado.includes(`${gradoIdStr}do`) || r.grado.includes(`${gradoIdStr}to`) || r.grado.includes(`${gradoIdStr}mo`) || r.grado.startsWith(gradoIdStr))) ocupadosGrado++;
            }
        });

        if (indice === -1 && ocupadosGrado >= limiteCupo) {
            return res.status(400).json({
                success: false,
                cupoAgotado: true,
                error: `Capacidad máxima de cupos agotada para ${registro.grado || gradoIdStr + '° Grado'} (${limiteCupo} aspirantes registrados). Comuníquese con la Dirección.`
            });
        }

        if (indice !== -1) {
            registro.codigo = registrosCloud[indice].codigo || registro.codigo;
            registrosCloud[indice] = registro;
        } else {
            registrosCloud.unshift(registro);
        }
        guardarRegistrosArchivo(registrosCloud);

        if (isMySQLConnected && pool) {
            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();
                await insertarRegistroEnMySQL(conn, registro);
                await conn.commit();
            } catch (sqlErr) {
                await conn.rollback();
                console.error('[MySQL Guardado Error]', sqlErr.message);
            } finally {
                conn.release();
            }
        }

        await registrarLog(
            registro.representante || 'Representante Legal',
            'REPRESENTANTE',
            'NUEVA_PREINSCRIPCION',
            `Preinscripción asentada: Alumno ${registro.alumno} (${registro.alumnoDoc || 'S/N'}), Grado: ${registro.grado || 'Primaria'}, Folio: ${registro.codigo}`,
            req
        );

        res.json({
            success: true,
            message: 'Preinscripción registrada en la nube satisfactoriamente',
            data: registro,
            storage: isMySQLConnected ? 'mysql' : 'cloud_file'
        });
    } catch (error) {
        console.error('[POST /api/preinscripciones]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * FUNCIÓN MODULAR MAESTRA: VACIADO DE RAÍZ EN MYSQL (PURGA REAL DE PREINSCRIPCIONES)
 * Desactiva claves foráneas, vacía preinscripciones, alumnos, representantes, procedencia y recaudos,
 * reinicia AUTO_INCREMENT = 1 y reactiva claves foráneas. Jamás toca usuarios/docentes.
 */
async function ejecutarPurgaTotalBD(usuarioEjecutor = 'Docente / Admin', req = null) {
    console.log(`[PURGA REAL BD] Iniciando rutina profunda solicitada por: ${usuarioEjecutor}`);

    // 1. Limpiar persistencia local en servidor
    guardarRegistrosArchivo([]);

    // 2. Limpiar permanentemente base de datos MySQL si está conectada
    if (isMySQLConnected && pool) {
        const conn = await pool.getConnection();
        try {
            await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

            // Vaciar tablas de preinscripciones, recaudos, alumnos, representantes e institutos
            await conn.query('TRUNCATE TABLE preinscripcion_documentos;');
            await conn.query('TRUNCATE TABLE preinscripciones;');
            await conn.query('TRUNCATE TABLE alumnos;');
            await conn.query('TRUNCATE TABLE representantes;');
            await conn.query('TRUNCATE TABLE institutos;');

            // Reiniciar contadores AUTO_INCREMENT a 1
            await conn.query('ALTER TABLE preinscripcion_documentos AUTO_INCREMENT = 1;');
            await conn.query('ALTER TABLE preinscripciones AUTO_INCREMENT = 1;');
            await conn.query('ALTER TABLE alumnos AUTO_INCREMENT = 1;');
            await conn.query('ALTER TABLE representantes AUTO_INCREMENT = 1;');
            await conn.query('ALTER TABLE institutos AUTO_INCREMENT = 1;');

            await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
            console.log('[MySQL Purga Total] Tablas preinscripciones, recaudos, alumnos, representantes e institutos purgadas y reseteadas a AUTO_INCREMENT = 1 con éxito.');
        } catch (sqlErr) {
            console.error('[MySQL Purga Error]', sqlErr.message);
            try { await conn.query('SET FOREIGN_KEY_CHECKS = 1;'); } catch (e) {}
            throw sqlErr;
        } finally {
            conn.release();
        }
    }

    const rolAudit = (usuarioEjecutor === 'superroot' || usuarioEjecutor === 'mantecosadmin') ? 'SUPERROOT' : 'DOCENTE';
    await registrarLog(
        usuarioEjecutor,
        rolAudit,
        'PURGA_TOTAL_BD',
        `Se ejecutó el vaciado de raíz y purga profunda de las tablas de preinscripciones, alumnos, representantes, recaudos y procedencia en la base de datos MySQL (AUTO_INCREMENT = 1).`,
        req
    );

    return {
        success: true,
        message: 'Purga profunda ejecutada exitosamente. Todas las tablas de preinscripciones han sido reseteadas a 0 registros con contadores AUTO_INCREMENT en 1.',
        count: 0
    };
}

// 15.1. Endpoint de eliminación profunda para Superroot y Panel Docente: DELETE /api/preinscripciones/purge
app.delete('/api/preinscripciones/purge', async (req, res) => {
    try {
        const usuarioEjecutor = req.body?.usuario || req.headers['x-user'] || 'Docente / Admin';
        const resultado = await ejecutarPurgaTotalBD(usuarioEjecutor, req);
        res.json(resultado);
    } catch (error) {
        console.error('[DELETE /api/preinscripciones/purge]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 15.2. Endpoint de eliminación profunda (POST fallback): POST /api/preinscripciones/purge
app.post('/api/preinscripciones/purge', async (req, res) => {
    try {
        const usuarioEjecutor = req.body?.usuario || req.headers['x-user'] || 'Docente / Admin';
        const resultado = await ejecutarPurgaTotalBD(usuarioEjecutor, req);
        res.json(resultado);
    } catch (error) {
        console.error('[POST /api/preinscripciones/purge]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 15.3. Mantener DELETE /api/preinscripciones conectado a la purga profunda
app.delete('/api/preinscripciones', async (req, res) => {
    try {
        const usuarioEjecutor = req.body?.usuario || req.headers['x-user'] || 'Docente / Admin';
        const resultado = await ejecutarPurgaTotalBD(usuarioEjecutor, req);
        res.json(resultado);
    } catch (error) {
        console.error('[DELETE /api/preinscripciones]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 16. Función y endpoints para eliminar un registro específico por código/folio en la nube
async function eliminarFolioNube(codigo, req) {
    const codNormalizado = String(codigo || '').trim();
    console.log(`[ELIMINAR NUBE] Eliminando folio: ${codNormalizado}`);

    let registros = leerRegistrosArchivo();
    const target = registros.find(r => (r.codigo || '').trim().toUpperCase() === codNormalizado.toUpperCase());
    registros = registros.filter(r => (r.codigo || '').trim().toUpperCase() !== codNormalizado.toUpperCase());
    guardarRegistrosArchivo(registros);

    if (isMySQLConnected && pool) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query('SELECT id, id_alumno, id_repre FROM preinscripciones WHERE UPPER(TRIM(codigo_solicitud)) = UPPER(?)', [codNormalizado]);
            if (rows.length > 0) {
                const preId = rows[0].id;
                const alId = rows[0].id_alumno;
                const repId = rows[0].id_repre;
                await conn.query('DELETE FROM preinscripcion_documentos WHERE id_pre = ?', [preId]);
                await conn.query('DELETE FROM preinscripciones WHERE id = ?', [preId]);
                if (alId) {
                    await conn.query('DELETE FROM alumnos WHERE id = ?', [alId]).catch(() => {});
                }
                if (repId) {
                    await conn.query('DELETE FROM representantes WHERE id = ?', [repId]).catch(() => {});
                }
            }
            await conn.commit();
        } catch (sqlErr) {
            await conn.rollback();
            console.error('[MySQL Eliminar Folio Error]', sqlErr.message);
        } finally {
            conn.release();
        }
    }

    const usuarioEjecutor = req.headers['x-user'] || req.body?.usuario || 'Docente / Admin';
    await registrarLog(
        usuarioEjecutor,
        'DOCENTE',
        'ELIMINAR_FOLIO',
        `Expediente con folio ${codigo} (${target?.alumno || 'Aspirante'}) eliminado permanentemente.`,
        req
    );

    return {
        success: true,
        message: `Registro ${codigo} eliminado exitosamente de la nube.`
    };
}

app.delete('/api/preinscripciones/:codigo', async (req, res) => {
    try {
        const resultado = await eliminarFolioNube(req.params.codigo, req);
        res.json(resultado);
    } catch (error) {
        console.error('[DELETE /api/preinscripciones/:codigo]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/preinscripciones/:codigo/delete', async (req, res) => {
    try {
        const resultado = await eliminarFolioNube(req.params.codigo, req);
        res.json(resultado);
    } catch (error) {
        console.error('[POST /api/preinscripciones/:codigo/delete]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 17. Actualizar estado de una preinscripción en la nube
app.put('/api/preinscripciones/:codigo/estado', async (req, res) => {
    try {
        const codigo = req.params.codigo;
        const { estado, usuario } = req.body;

        if (!estado) {
            return res.status(400).json({ success: false, error: 'Estado no especificado' });
        }

        const registros = leerRegistrosArchivo();
        const reg = registros.find(r => r.codigo === codigo);
        if (reg) {
            reg.estado = estado;
            guardarRegistrosArchivo(registros);
        }

        if (isMySQLConnected && pool) {
            const conn = await pool.getConnection();
            try {
                if (reg) {
                    await conn.query(
                        'UPDATE preinscripciones SET estado = ?, datos_completos = ? WHERE codigo_solicitud = ?',
                        [estado, JSON.stringify(reg), codigo]
                    );
                } else {
                    await conn.query(
                        'UPDATE preinscripciones SET estado = ? WHERE codigo_solicitud = ?',
                        [estado, codigo]
                    );
                }
            } catch (sqlErr) {
                console.error('[MySQL Update Estado Error]', sqlErr.message);
            } finally {
                conn.release();
            }
        }

        await registrarLog(
            usuario || 'Docente / Admin',
            'DOCENTE',
            'CAMBIO_ESTADO_ALUMNO',
            `Estado del expediente ${codigo} (${reg?.alumno || 'Alumno'}) actualizado a: ${estado}.`,
            req
        );

        res.json({
            success: true,
            message: `Estado del folio ${codigo} actualizado a ${estado} en la nube.`
        });
    } catch (error) {
        console.error('[PUT /api/preinscripciones/:codigo/estado]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 18. Actualizar verificación o subsanación de recaudo en la nube
app.put('/api/preinscripciones/:codigo/recaudo', async (req, res) => {
    try {
        const codigo = req.params.codigo;
        const { docId, nuevoEstado, motivoRechazo, rechazada, archivoBase64, nombreArchivo, usuario } = req.body;

        const registros = leerRegistrosArchivo();
        const reg = registros.find(r => r.codigo === codigo);
        if (reg) {
            if (!reg.documentos) reg.documentos = {};
            if (!reg.rechazos) reg.rechazos = {};
            if (!reg.archivos) reg.archivos = {};

            const idStr = String(docId);
            let esSubsanacion = Boolean(archivoBase64);
            let esRechazo = Boolean(rechazada || nuevoEstado === 'RECHAZADO');

            if (esRechazo) {
                reg.rechazos[idStr] = {
                    rechazada: true,
                    motivo: (motivoRechazo || 'Documento no legible o no conforme').trim(),
                    fecha: new Date().toLocaleDateString('es-VE')
                };
                reg.documentos[idStr] = 'RECHAZADO';
            } else if (esSubsanacion) {
                reg.archivos[idStr] = {
                    nombre: nombreArchivo || `recaudo_${idStr}_corregido.jpg`,
                    dataUrl: archivoBase64,
                    tipo: 'image/jpeg',
                    fecha: new Date().toLocaleDateString('es-VE')
                };
                delete reg.rechazos[idStr];
                reg.documentos[idStr] = 'CONSIGNADO';
            } else if (nuevoEstado) {
                reg.documentos[idStr] = nuevoEstado;
                if (nuevoEstado === 'APROBADO' || nuevoEstado === 'CONSIGNADO') {
                    delete reg.rechazos[idStr];
                }
            }

            // Conteo estricto de recaudos cargados
            let entregados = 0;
            for (let i = 1; i <= 4; i++) {
                const k = String(i);
                const hasArch = Boolean(reg.archivos && reg.archivos[k] && reg.archivos[k].dataUrl);
                const docSt = reg.documentos[k] || (hasArch ? 'CONSIGNADO' : 'NO_CONSIGNADO');
                if (docSt === 'APROBADO' || docSt === 'CONSIGNADO' || hasArch) {
                    entregados++;
                }
            }
            reg.recaudosCount = `${entregados}/4`;

            const totalRechazos = Object.keys(reg.rechazos || {}).length;
            const estadoAnterior = reg.estado;

            // Máquina de estados estricta:
            // Si faltan fotos (< 4) o hay al menos un rechazo activo -> DOCUMENTOS_INCOMPLETOS
            // Si 4 fotos cargadas y 0 rechazos -> EN_REVISION (o APROBADA si docente ya aprobó)
            if (entregados < 4 || totalRechazos > 0) {
                reg.estado = 'DOCUMENTOS_INCOMPLETOS';
            } else if (entregados === 4 && totalRechazos === 0) {
                if (reg.estado === 'DOCUMENTOS_INCOMPLETOS' || !reg.estado) {
                    reg.estado = 'EN_REVISION';
                }
            }

            guardarRegistrosArchivo(registros);

            if (isMySQLConnected && pool) {
                const conn = await pool.getConnection();
                try {
                    await conn.query(
                        'UPDATE preinscripciones SET estado = ?, datos_completos = ? WHERE codigo_solicitud = ?',
                        [reg.estado, JSON.stringify(reg), codigo]
                    );
                } catch (sqlErr) {
                    console.error('[MySQL Update Recaudo Error]', sqlErr.message);
                } finally {
                    conn.release();
                }
            }

            let detalleLog = '';
            let accionLog = 'VERIFICACION_RECAUDO';
            let rolLog = 'DOCENTE';
            let userLog = usuario || 'Docente / Control de Estudios';

            if (esRechazo) {
                accionLog = 'RECHAZO_RECAUDO';
                detalleLog = `Recaudo #${idStr} rechazado en expediente ${codigo}. Motivo: "${reg.rechazos[idStr]?.motivo}". Estado forzado a DOCUMENTOS_INCOMPLETOS.`;
            } else if (esSubsanacion) {
                accionLog = 'SUBSANACION_RECAUDO';
                rolLog = 'REPRESENTANTE';
                userLog = reg.representante || 'Representante Legal';
                detalleLog = `Representante subsanó la fotografía #${idStr} para el alumno ${reg.alumno} (Folio ${codigo}). Marca de rechazo retirada. Estado actual: ${reg.estado}.`;
            } else {
                detalleLog = `Recaudo #${idStr} actualizado a ${nuevoEstado} en expediente ${codigo}. Estado actual: ${reg.estado}.`;
            }

            await registrarLog(userLog, rolLog, accionLog, detalleLog, req);

            return res.json({
                success: true,
                message: esSubsanacion ? 'Recaudo subsanado exitosamente' : `Recaudo ${idStr} actualizado en la nube.`,
                data: reg
            });
        }

        res.status(404).json({ success: false, error: 'Registro de preinscripción no encontrado.' });
    } catch (error) {
        console.error('[PUT /api/preinscripciones/:codigo/recaudo]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 18.1. Consulta Pública de Solicitudes por Cédula (Representante o Alumno)
app.get('/api/preinscripciones/consulta/:identificacion', async (req, res) => {
    try {
        const rawId = (req.params.identificacion || '').trim();
        const cleanDigits = rawId.replace(/\D/g, '');
        const cleanUpper = rawId.toUpperCase().replace(/\s+/g, '');

        if (!cleanDigits && cleanUpper.length < 3) {
            return res.status(400).json({ success: false, error: 'Debe ingresar un número de cédula o código válido.' });
        }

        const registros = leerRegistrosArchivo();
        const resultados = registros.filter(r => {
            if (!r) return false;
            const rRepreDocDigits = (r.repreDoc || '').replace(/\D/g, '');
            const rAlumnoDocDigits = (r.alumnoDoc || '').replace(/\D/g, '');
            const rAlumnoDocUpper = (r.alumnoDoc || '').toUpperCase().replace(/\s+/g, '');
            const rCodigo = (r.codigo || '').toUpperCase();

            // Coincidencia con cédula del representante, cédula del alumno, Cédula Escolar o folio
            return (cleanDigits && (rRepreDocDigits === cleanDigits || rAlumnoDocDigits === cleanDigits)) ||
                   (cleanUpper && (rAlumnoDocUpper.includes(cleanUpper) || rCodigo.includes(cleanUpper)));
        });

        res.json({
            success: true,
            total: resultados.length,
            data: resultados
        });
    } catch (error) {
        console.error('[GET /api/preinscripciones/consulta/:identificacion]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 19. Restablecer registros de demostración en la nube
app.post('/api/preinscripciones/restablecer', async (req, res) => {
    try {
        guardarRegistrosArchivo(REGISTROS_DEMO);

        if (isMySQLConnected && pool) {
            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();
                await conn.query('DELETE FROM preinscripcion_documentos;');
                await conn.query('DELETE FROM preinscripciones;');
                for (const r of REGISTROS_DEMO) {
                    await insertarRegistroEnMySQL(conn, r);
                }
                await conn.commit();
            } catch (sqlErr) {
                await conn.rollback();
                console.error('[MySQL Restablecer Error]', sqlErr.message);
            } finally {
                conn.release();
            }
        }

        await registrarLog(
            'Docente / Admin',
            'DOCENTE',
            'RESTABLECER_DEMO',
            'Se restablecieron los registros de demostración iniciales en el sistema.',
            req
        );

        res.json({
            success: true,
            message: 'Registros de demostración restablecidos en la nube satisfactoriamente.',
            data: REGISTROS_DEMO
        });
    } catch (error) {
        console.error('[POST /api/preinscripciones/restablecer]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==============================================================================
// INICIALIZACIÓN Y ARRANQUE DEL SERVIDOR
// ==============================================================================
asegurarDirectorioYArchivos();
inicializarMySQL();

setInterval(() => {
    if (!isMySQLConnected) {
        inicializarMySQL();
    }
}, 30000);

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Servidor Fe y Alegría Nueva América en línea`);
    console.log(` Puerto: ${PORT} | Modo: ${process.env.NODE_ENV || 'production'}`);
    console.log(` Persistencia: Cloud Automática (MySQL / Servidor)`);
    console.log(` Superroot Activo: mantecosadmin67.html`);
    console.log(` Docente Inicial: manteca / manteca`);
    console.log(` URL Local: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
