// Importar dependencias
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer'); // Importamos multer
require('dotenv').config();

// Configuración inicial del servidor
const app = express();
const {
    PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET,
    GMAIL_USER,
    GMAIL_APP_PASSWORD
} = process.env;
const baseURL = "https://api-m.paypal.com"; // URL de producción

// Middleware
app.use(express.static(path.join(__dirname, '..')));
app.use(express.json());

// --- CONFIGURACIÓN DE MULTER ---
// Le decimos a Multer que guarde los archivos en la memoria temporalmente
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- CONFIGURACIÓN DE NODEMAILER ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
    },
});

// --- FUNCIONES DE PAYPAL ---
const generateAccessToken = async () => {
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
        const response = await fetch(`${baseURL}/v1/oauth2/token`, {
            method: "POST",
            body: "grant_type=client_credentials",
            headers: { Authorization: `Basic ${auth}` },
        });
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Error al generar el token de acceso:", error);
    }
};

async function handleResponse(response) {
    if (response.status === 200 || response.status === 201) {
        return response.json();
    }
    const errorMessage = await response.text();
    throw new Error(errorMessage);
}

// --- RUTAS DE LA API ---

// Ruta para crear orden de PayPal
app.post("/api/orders", async (req, res) => {
    try {
        const { courseId } = req.body;
        const courses = require('../../public/data/courses.json');
        const course = courses.find(c => c.id === courseId);

        if (!course) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }

        const accessToken = await generateAccessToken();
        const url = `${baseURL}/v2/checkout/orders`;
        const payload = {
            intent: "CAPTURE",
            purchase_units: [{
                amount: {
                    currency_code: "USD",
                    value: course.price.toString(),
                },
                description: `ID del Producto: ${course.id}`,
            }],
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify(payload),
        });

        const data = await handleResponse(response);
        res.status(200).json(data);
    } catch (error) {
        console.error("Error al crear la orden:", error);
        res.status(500).json({ error: "No se pudo crear la orden." });
    }
});

// Ruta para capturar pago de PayPal
app.post("/api/orders/:orderID/capture", async (req, res) => {
    try {
        const { orderID } = req.params;
        const { customerName, customerEmail, courseId } = req.body;
        const accessToken = await generateAccessToken();
        const url = `${baseURL}/v2/checkout/orders/${orderID}/capture`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`},
        });
        const captureData = await handleResponse(response);
        if (captureData.status === 'COMPLETED') {
            console.log("Pago completado. Enviando correo de notificación...");
            const courses = require('../data/courses.json');
            const course = courses.find(c => c.id === courseId);
            const productName = course ? course.title : 'Producto no encontrado';
            const amount = captureData.purchase_units[0].payments.captures[0].amount;
            const mailOptions = { from: GMAIL_USER, to: 'thealexj9@gmail.com', subject: `✅ Nuevo Pago Recibido: ${productName}`, html: `<h1>¡Nueva Venta!</h1><p>Se ha recibido un nuevo pago a través de PayPal.</p><hr><h3>Detalles de la Compra:</h3><ul><li><b>Producto:</b> ${productName}</li><li><b>Monto:</b> ${amount.value} ${amount.currency_code}</li><li><b>ID de Transacción PayPal:</b> ${captureData.id}</li></ul><hr><h3>Datos del Cliente:</h3><ul><li><b>Nombre:</b> ${customerName}</li><li><b>Correo Electrónico:</b> ${customerEmail}</li></ul>`, };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Error al enviar el correo:", error);
                } else {
                    console.log("Correo de notificación enviado:", info.response);
                }
            });
        }
        res.status(200).json(captureData);
    } catch (error) {
        console.error("Error al capturar el pago:", error);
        res.status(500).json({ error: "No se pudo procesar el pago." });
    }
});


// Nueva ruta para pago con criptomonedas
app.post('/api/crypto-payment', upload.single('proof'), (req, res) => {
    try {
        const { customerName, customerEmail, productName, productPrice } = req.body;
        const proofFile = req.file; // El archivo subido está en req.file gracias a multer

        if (!proofFile) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
        }
        
        console.log("Recibido comprobante de cripto. Enviando correo...");

        const mailOptions = {
            from: GMAIL_USER,
            to: 'thealexj9@gmail.com',
            subject: `🪙 Nuevo Comprobante Cripto: ${productName}`,
            html: `
                <h1>¡Nuevo Comprobante de Pago con Cripto!</h1>
                <p>Un cliente ha subido un comprobante para su validación manual.</p>
                <hr>
                <h3>Detalles de la Compra:</h3>
                <ul>
                    <li><b>Producto:</b> ${productName}</li>
                    <li><b>Monto a verificar:</b> ${productPrice} USDT</li>
                </ul>
                <hr>
                <h3>Datos del Cliente:</h3>
                <ul>
                    <li><b>Nombre:</b> ${customerName}</li>
                    <li><b>Correo Electrónico:</b> ${customerEmail}</li>
                </ul>
                <p>El comprobante de pago está adjunto en este correo.</p>
            `,
            attachments: [
                {
                    filename: proofFile.originalname,
                    content: proofFile.buffer, // El contenido del archivo
                },
            ],
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error al enviar el correo de cripto:", error);
                res.status(500).json({ error: 'Error al enviar el correo.' });
            } else {
                console.log("Correo de cripto enviado:", info.response);
                res.status(200).json({ message: 'Comprobante enviado con éxito.' });
            }
        });

    } catch (error) {
        console.error("Error en la ruta /api/crypto-payment:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

// Iniciar el servidor
const PORT = 8888;
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});