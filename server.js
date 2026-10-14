/**
 * SERVIDOR BACKEND INSTITUCIONAL (Node.js + Express + MySQL / Cloud Storage)
 * U.E. Fe y Alegría "Nueva América" - Periodo Escolar 2026 - 2027
 * Sincronización en la nube para Railway y despliegues web
 */

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Directorio y archivo de persistencia cloud persistente en el servidor
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'preinscripciones.json');

// Semilla institucional de demostración
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

// Inicializar persistencia en archivo
function asegurarDirectorioYArchivo() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(REGISTROS_DEMO, null, 2), 'utf8');
        }
    } catch (e) {
        console.error('[Storage Local File] Error inicializando archivo:', e.message);
    }
}

function leerRegistrosArchivo() {
    try {
        asegurarDirectorioYArchivo();
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error('[Storage Local File] Error leyendo archivo:', e.message);
        return [];
    }
}

function guardarRegistrosArchivo(registros) {
    try {
        asegurarDirectorioYArchivo();
        const tmpFile = `${DATA_FILE}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(registros, null, 2), 'utf8');
        fs.renameSync(tmpFile, DATA_FILE);
        return true;
    } catch (e) {
        console.error('[Storage Local File] Error guardando archivo:', e.message);
        return false;
    }
}

// ==============================================================================
// GESTIÓN DE CONEXIÓN MYSQL (RAILWAY Y LOCAL)
// ==============================================================================
let pool = null;
let isMySQLConnected = false;

function buildMySQLConfig() {
    // Si Railway proporciona la URL completa (MYSQL_URL o DATABASE_URL)
    const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (dbUrl) {
        return dbUrl;
    }

    // Configuración por variables individuales (Railway o manuales)
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

        // Prueba de conexión inmediata
        const conn = await pool.getConnection();
        console.log('[MySQL] Conexión establecida con éxito en la nube.');
        conn.release();

        // Inicializar esquema de tablas si no existen
        await inicializarEsquemaMySQL(pool);
        isMySQLConnected = true;
    } catch (err) {
        isMySQLConnected = false;
        console.warn('[MySQL] No se pudo conectar a MySQL:', err.message);
        console.info('[Storage] Utilizando almacenamiento Cloud persistente en servidor (data/preinscripciones.json).');
        console.info('[Storage] Todos los usuarios y amigos compartirán los datos en línea.');
    }
}

async function inicializarEsquemaMySQL(poolInstance) {
    const conn = await poolInstance.getConnection();
    try {
        // Tablas requeridas
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
                INDEX idx_rpd_pre (id_pre)
            ) ENGINE=InnoDB;
        `);

        // Comprobar y asegurar columna datos_completos
        try {
            await conn.query(`ALTER TABLE preinscripciones ADD COLUMN datos_completos LONGTEXT NULL;`);
        } catch (e) {
            // Ya existe la columna, ignorar
        }

        // Semillas iniciales requeridas
        await conn.query(`
            INSERT IGNORE INTO usuarios (id, nombre_completo, nombre_usuario, correo, password_hash, rol, estado) VALUES
            (1, 'Coordinación de Control de Estudios', 'admin_nueva_america', 'control@feyalegrianuevaamerica.edu.ve', 'hash', 'ADMINISTRADOR', 'ACTIVO'),
            (2, 'Secretaría Académica', 'secretaria', 'secretaria@feyalegrianuevaamerica.edu.ve', 'hash', 'SECRETARIA', 'ACTIVO');
        `);

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

        // Si la tabla preinscripciones está vacía, cargar registros demo iniciales en MySQL
        const [countRows] = await conn.query(`SELECT COUNT(*) as total FROM preinscripciones;`);
        if (countRows && countRows[0].total === 0) {
            console.log('[MySQL] Insertando registros demo iniciales...');
            for (const r of REGISTROS_DEMO) {
                await insertarRegistroEnMySQL(conn, r);
            }
        }

        console.log('[MySQL] Tablas y catálogo inicializados correctamente.');
    } catch (err) {
        console.error('[MySQL] Error inicializando esquema:', err.message);
    } finally {
        conn.release();
    }
}

// Función auxiliar para insertar/actualizar un registro en MySQL
async function insertarRegistroEnMySQL(conn, reg) {
    const cod = reg.codigo;
    const est = reg.estado || 'EN_REVISION';
    const jsonStr = JSON.stringify(reg);

    // Separar nombres y apellidos
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

    // 1. Alumno
    let alumnoId = null;
    const [resAl] = await conn.query(
        `INSERT INTO alumnos (tipo_documento, numero_identificacion, nombres, apellidos, fecha_nacimiento, genero, lugar_nacimiento, direccion_habitacion, tipo_sangre, alergias_condiciones, vive_con)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [alTipo, alDoc, alNombres, alApellidos, reg.alumnoFechaNac || null, reg.alumnoGenero || 'MASCULINO', reg.alumnoLugarNac || '', reg.alumnoDireccion || '', reg.alumnoSangre || 'O+', reg.alumnoAlergias || '', reg.alumnoViveCon || 'Ambos Padres']
    );
    alumnoId = resAl.insertId;

    // 2. Representante
    let repreId = null;
    const [resRep] = await conn.query(
        `INSERT INTO representantes (tipo_documento, numero_identificacion, nombres, apellidos, parentesco, telefono_principal, correo, profesion_ocupacion, direccion_habitacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [repTipo, repDoc, repNombres, repApellidos, reg.repreParentesco || 'MADRE', reg.repreTelefono || '', reg.repreCorreo || '', reg.repreOcupacion || '', reg.repreDireccion || '']
    );
    repreId = resRep.insertId;

    // 3. Instituto
    let instId = null;
    if (reg.instituto && reg.instituto !== 'Primer Ingreso') {
        const [resInst] = await conn.query(
            `INSERT INTO institutos (codigo_plantel, nombre, tipo_institucion, ciudad)
             VALUES (?, ?, ?, ?)`,
            [reg.institutoCodigo || '', reg.instituto, reg.institutoTipo || 'PUBLICA', reg.institutoCiudad || 'San Francisco, Zulia']
        );
        instId = resInst.insertId;
    }

    // 4. Preinscripción
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

    // 5. Documentos
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

// Configurar Express
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(__dirname));

// ==============================================================================
// RUTAS DE LA API (CRUD COMPLETO EN LÍNEA)
// ==============================================================================

// 1. Estado y Salud del Backend
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

// 2. Obtener todas las preinscripciones almacenadas en la nube
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

                // Si MySQL devolvió registros, devolverlos y sincronizar archivo
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

        // Fallback: Archivo JSON Cloud del servidor
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

// 3. Registrar o actualizar preinscripción en la nube
app.post('/api/preinscripciones', async (req, res) => {
    try {
        let registro = req.body;

        // Si viene el objeto directo o dentro de alguna propiedad
        if (req.body.registro) {
            registro = req.body.registro;
        }

        if (!registro.codigo) {
            registro.codigo = `PRE-2026-${String(Date.now()).slice(-4)}`;
        }

        // Guardar primero en el archivo cloud del servidor
        const registrosCloud = leerRegistrosArchivo();
        const docClave = ((registro.alumnoDoc || '').replace(/\s+/g, '')).toUpperCase();
        const indice = registrosCloud.findIndex(r => {
            if (!r) return false;
            const rDoc = ((r.alumnoDoc || '').replace(/\s+/g, '')).toUpperCase();
            return (rDoc && rDoc === docClave) || r.codigo === registro.codigo;
        });

        if (indice !== -1) {
            registro.codigo = registrosCloud[indice].codigo || registro.codigo;
            registrosCloud[indice] = registro;
        } else {
            registrosCloud.unshift(registro);
        }
        guardarRegistrosArchivo(registrosCloud);

        // Guardar en MySQL si está conectado
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

// 4. LIMPIAR TODOS LOS REGISTROS EN LA NUBE (Requerimiento Crítico)
app.delete('/api/preinscripciones', async (req, res) => {
    try {
        console.log('[VACIAR NUBE] Solicitud para eliminar TODOS los registros recibida.');

        // 1. Limpiar archivo de persistencia cloud
        guardarRegistrosArchivo([]);

        // 2. Limpiar MySQL si está conectado
        if (isMySQLConnected && pool) {
            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();
                await conn.query('DELETE FROM preinscripcion_documentos;');
                await conn.query('DELETE FROM preinscripciones;');
                await conn.commit();
                console.log('[MySQL] Todas las preinscripciones han sido eliminadas.');
            } catch (sqlErr) {
                await conn.rollback();
                console.error('[MySQL Limpiar Error]', sqlErr.message);
            } finally {
                conn.release();
            }
        }

        res.json({
            success: true,
            message: 'Todos los registros han sido eliminados de la nube satisfactoriamente.',
            count: 0
        });
    } catch (error) {
        console.error('[DELETE /api/preinscripciones]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Eliminar un registro específico por código/folio en la nube
app.delete('/api/preinscripciones/:codigo', async (req, res) => {
    try {
        const codigo = req.params.codigo;
        console.log(`[ELIMINAR NUBE] Eliminando folio: ${codigo}`);

        // 1. Filtrar en archivo cloud
        let registros = leerRegistrosArchivo();
        registros = registros.filter(r => r.codigo !== codigo);
        guardarRegistrosArchivo(registros);

        // 2. Eliminar en MySQL si está conectado
        if (isMySQLConnected && pool) {
            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();
                const [rows] = await conn.query('SELECT id FROM preinscripciones WHERE codigo_solicitud = ?', [codigo]);
                if (rows.length > 0) {
                    const preId = rows[0].id;
                    await conn.query('DELETE FROM preinscripcion_documentos WHERE id_pre = ?', [preId]);
                    await conn.query('DELETE FROM preinscripciones WHERE id = ?', [preId]);
                }
                await conn.commit();
            } catch (sqlErr) {
                await conn.rollback();
                console.error('[MySQL Eliminar Folio Error]', sqlErr.message);
            } finally {
                conn.release();
            }
        }

        res.json({
            success: true,
            message: `Registro ${codigo} eliminado exitosamente de la nube.`
        });
    } catch (error) {
        console.error('[DELETE /api/preinscripciones/:codigo]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Actualizar estado de una preinscripción en la nube
app.put('/api/preinscripciones/:codigo/estado', async (req, res) => {
    try {
        const codigo = req.params.codigo;
        const { estado } = req.body;

        if (!estado) {
            return res.status(400).json({ success: false, error: 'Estado no especificado' });
        }

        // Actualizar archivo cloud
        const registros = leerRegistrosArchivo();
        const reg = registros.find(r => r.codigo === codigo);
        if (reg) {
            reg.estado = estado;
            guardarRegistrosArchivo(registros);
        }

        // Actualizar MySQL
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

        res.json({
            success: true,
            message: `Estado del folio ${codigo} actualizado a ${estado} en la nube.`
        });
    } catch (error) {
        console.error('[PUT /api/preinscripciones/:codigo/estado]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Actualizar verificación de recaudo en la nube
app.put('/api/preinscripciones/:codigo/recaudo', async (req, res) => {
    try {
        const codigo = req.params.codigo;
        const { docId, nuevoEstado } = req.body;

        const registros = leerRegistrosArchivo();
        const reg = registros.find(r => r.codigo === codigo);
        if (reg) {
            if (!reg.documentos) reg.documentos = {};
            reg.documentos[String(docId)] = nuevoEstado;

            let entregados = 0;
            for (let i = 1; i <= 5; i++) {
                const e = reg.documentos[String(i)] || (reg.archivos && reg.archivos[String(i)] ? 'CONSIGNADO' : 'NO_CONSIGNADO');
                if (e === 'APROBADO' || e === 'CONSIGNADO') entregados++;
            }
            reg.recaudosCount = `${entregados}/5`;
            if (entregados === 5 && reg.estado === 'DOCUMENTOS_INCOMPLETOS') {
                reg.estado = 'APROBADA';
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
        }

        res.json({
            success: true,
            message: `Recaudo ${docId} actualizado en la nube.`
        });
    } catch (error) {
        console.error('[PUT /api/preinscripciones/:codigo/recaudo]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. Restablecer registros de demostración en la nube
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
// INICIO DEL SERVIDOR
// ==============================================================================
asegurarDirectorioYArchivo();
inicializarMySQL();

// Intento periódico de reconexión a MySQL si Railway lo inicia más tarde
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
    console.log(` URL Local: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
