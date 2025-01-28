import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import os from "os";
import mongoose from "mongoose";

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// await mongoose.connect("mongodb+srv://230629:a9zkZvci3FqyQe4E@cluster.mongodb.net/API-AWI4_0-230629");

/* console.log("Conectado a MongoDB");*/

app.use(
    session({
        secret: "P4-JAAM#SesionesHTTP-VariablesDeSesion",
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 5 * 60 * 1000 }, // 5 minutos
    })
);

// Zona horaria por defecto
const TIMEZONE = "America/Mexico_City"; // Ajusta según tu región

// Sesiones almacenadas en memoria
const sessions = {};

// Función de utilidad para obtener la IP del cliente
const getClientIp = (req) => {
    return (
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket?.remoteAddress
    );
};

// Función de utilidad para obtener información de red del servidor
const getServerNetworkInfo = () => {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === `IPv4` && !iface.internal) {
                return { serverIp: iface.address, serverMac: iface.mac };
            }
        }
    }
};

// Login Endpoint
app.post("/login", (req, res) => {
    const { email, nickname, macAddress } = req.body;

    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: "Falta algún campo." });
    }

    const sessionId = uuidv4();
    const now = moment().tz(TIMEZONE);
    const { serverIp } = getServerNetworkInfo();

    sessions[sessionId] = {
        sessionId,
        email,
        nickname,
        macAddress,
        ip: serverIp,
        createdAt: now.format("YYYY-MM-DD HH:mm:ss"),
        lastAccessedAt: now,
    };

    res.status(200).json({
        message: "Inicio de sesión exitoso.",
        sessionId,
    });
});

// Logout Endpoint
app.post("/logout", (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ message: "No se ha encontrado una sesión activa." });
    }

    delete sessions[sessionId];
    req.session?.destroy((err) => {
        if (err) {
            return res.status(500).send("Error al cerrar la sesión.");
        }
    });
    res.status(200).json({ message: "Logout exitoso." });
});

// Actualización de la sesión
app.post("/update", (req, res) => {
    const { sessionId, email, nickname } = req.body;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ message: "No existe una sesión activa." });
    }

    const now = moment().tz(TIMEZONE);
    if (email) sessions[sessionId].email = email;
    if (nickname) sessions[sessionId].nickname = nickname;
    sessions[sessionId].lastAccessedAt = now;

    res.status(200).json({
        message: "Sesión actualizada correctamente.",
        session: {
            sessionId,
            email: sessions[sessionId].email,
            nickname: sessions[sessionId].nickname,
            createdAt: sessions[sessionId].createdAt,
            lastAccessedAt: sessions[sessionId].lastAccessedAt.format("YYYY-MM-DD HH:mm:ss"),
        },
    });
});

// Estado de la sesión
app.get("/status", (req, res) => {
    const sessionId = req.query.sessionId;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ message: "No hay sesión activa." });
    }

    const now = moment().tz(TIMEZONE);
    const session = sessions[sessionId];
    const lastAccessedAt = moment(session.lastAccessedAt);
    const inactivityDuration = moment.duration(now.diff(lastAccessedAt));
    const sessionDuration = moment.duration(now.diff(moment(session.createdAt)));

    res.status(200).json({
        message: "Sesión activa.",
        session: {
            ...session,
            inactivity: `${inactivityDuration.minutes()} minutos y ${inactivityDuration.seconds()} segundos`,
            totalDuration: `${sessionDuration.hours()} horas, ${sessionDuration.minutes()} minutos y ${sessionDuration.seconds()} segundos`,
        },
    });
});

// Endpoint para obtener la lista de sesiones activas
app.get("/sessions", (req, res) => {
    if (Object.keys(sessions).length === 0) {
        return res.status(200).json({ message: "No hay sesiones activas en este momento." });
    }

    // Generar un resumen de las sesiones activas
    const sessionList = Object.values(sessions).map((session) => ({
        sessionId: session.sessionId,
        email: session.email,
        nickname: session.nickname,
        ip: session.ip,
        macAddress: session.macAddress,
        createdAt: session.createdAt,
        lastAccessedAt: session.lastAccessedAt.format("YYYY-MM-DD HH:mm:ss"),
    }));

    res.status(200).json({
        message: "Lista de sesiones activas:",
        activeSessions: sessionList,
    });
});


// Ruta raíz
app.get("/", (req, res) => {
    return res.status(200).json({
        message: "Bienvenid@ al API de Control de Sesiones",
        author: "José Arturo García González",
    });
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
