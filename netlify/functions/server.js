// Importar dependencias
const express = require('express');
const serverless = require('serverless-http');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const multer = require('multer');

// Cargar variables de entorno
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

const app = express();
const router = express.Router();

// Middleware para que Express entienda JSON. Esto es crucial.
app.use(express.json());

// --- CONFIGURACIÓN ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});
const baseURL = "https://api-m.paypal.com";

// --- FUNCIÓN PARA LEER LOS CURSOS ---
function getCourses() {
    try {
        // Usar require es más robusto en entornos serverless para archivos JSON
        return require('./data/courses.json');
    } catch (error) {
        console.error("ERROR AL LEER courses.json:", error);
        return [];
    }
}

// --- FUNCIONES AUXILIARES DE PAYPAL ---
const generateAccessToken = async () => {
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
        const response = await fetch(`${baseURL}/v1/oauth2/token`, {
            method: "POST",
            body: "grant_type=client_credentials",
            headers: { Authorization: `Basic ${auth}` }
        });
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Error al generar el token de acceso:", error);
        return null;
    }
};

async function handleResponse(response) {
    if (response.ok) {
        return response.json();
    }
    const errorMessage = await response.text();
    console.error("Error en la respuesta de PayPal:", errorMessage);
    throw new Error(errorMessage);
}


// --- RUTAS DE LA API ---

// Ruta para crear orden de PayPal (con conversión de moneda)
router.post("/orders", async (req, res) => {
    try {
        const { courseId, currency } = req.body;
        const courses = getCourses();
        const course = courses.find(c => c.id === courseId);
        
        if (!course) {
            console.error(`Producto no encontrado para ID: ${courseId}`);
            return res.status(404).json({ error: "Producto no encontrado." });
        }

        let finalPrice = course.price.toString();
        let finalCurrency = "USD";

        if (currency && currency !== "USD") {
            try {
                const ratesResponse = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
                const ratesData = await ratesResponse.json();
                if (ratesData.rates && ratesData.rates[currency]) {
                    const rate = ratesData.rates[currency];
                    const convertedValue = (course.price * rate).toFixed(2);
                    finalPrice = convertedValue;
                    finalCurrency = currency;
                }
            } catch (conversionError) {
                console.error(`Error al convertir a ${currency}. Se usará USD.`, conversionError);
            }
        }

        const accessToken = await generateAccessToken();
        if(!accessToken) throw new Error("No se pudo obtener el token de acceso de PayPal");

        const url = `${baseURL}/v2/checkout/orders`;
        const payload = {
            intent: "CAPTURE",
            purchase_units: [{
                amount: {
                    currency_code: finalCurrency,
                    value: finalPrice
                },
                description: `ID del Producto: ${course.id}`,
            }],
        };

        const response = await fetch(url, { 
            method: "POST", 
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, 
            body: JSON.stringify(payload) 
        });

        const data = await handleResponse(response);
        res.status(200).json(data);
    } catch (error) {
        console.error("Error al crear la orden:", error.message);
        res.status(500).json({ error: "No se pudo crear la orden." });
    }
});

// Ruta para capturar pago de PayPal
router.post("/orders/:orderID/capture", async (req, res) => {
    try {
        const { orderID } = req.params;
        const { customerName, customerEmail, courseId } = req.body;
        
        const accessToken = await generateAccessToken();
        if(!accessToken) throw new Error("No se pudo obtener el token de acceso de PayPal para la captura");

        const url = `${baseURL}/v2/checkout/orders/${orderID}/capture`;
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`}});
        const captureData = await handleResponse(response);

        if (captureData.status === 'COMPLETED') {
            const courses = getCourses();
            const course = courses.find(c => c.id === courseId);
            const productName = course ? course.title : 'Producto no encontrado';
            const amount = captureData.purchase_units[0].payments.captures[0].amount;
            const mailOptions = { 
                from: GMAIL_USER, 
                to: GMAIL_USER, // Enviar a tu propio correo
                subject: `✅ Nuevo Pago Recibido: ${productName}`, 
                html: `<h1>¡Nueva Venta!</h1><p>Se ha recibido un nuevo pago a través de PayPal.</p><hr><h3>Detalles de la Compra:</h3><ul><li><b>Producto:</b> ${productName}</li><li><b>Monto:</b> ${amount.value} ${amount.currency_code}</li><li><b>ID de Transacción PayPal:</b> ${captureData.id}</li></ul><hr><h3>Datos del Cliente:</h3><ul><li><b>Nombre:</b> ${customerName}</li><li><b>Correo Electrónico:</b> ${customerEmail}</li></ul>` 
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.error("Error al enviar el correo:", error);
                else console.log("Correo de notificación enviado:", info.response);
            });
        }
        res.status(200).json(captureData);
    } catch (error) {
        console.error("Error al capturar el pago:", error.message);
        res.status(500).json({ error: "No se pudo procesar el pago." });
    }
});

// Ruta para pago con criptomonedas
router.post('/crypto-payment', upload.single('proof'), (req, res) => {
    try {
        const { customerName, customerEmail, productName, productPrice } = req.body;
        const proofFile = req.file;
        if (!proofFile) return res.status(400).send({ error: 'No se ha subido ningún archivo.' });

        const mailOptions = {
            from: GMAIL_USER,
            to: GMAIL_USER, // Enviar a tu propio correo
            subject: `🪙 Nuevo Comprobante Crito: ${productName}`,
            html: `<h1>¡Nuevo Comprobante de Pago con Cripto!</h1><p>Un cliente ha subido un comprobante para su validación manual.</p><hr><h3>Detalles de la Compra:</h3><ul><li><b>Producto:</b> ${productName}</li><li><b>Monto a verificar:</b> ${productPrice} USDT</li></ul><hr><h3>Datos del Cliente:</h3><ul><li><b>Nombre:</b> ${customerName}</li><li><b>Correo Electrónico:</b> ${customerEmail}</li></ul><p>El comprobante de pago está adjunto en este correo.</p>`,
            attachments: [{ filename: proofFile.originalname, content: proofFile.buffer }],
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error al enviar el correo de cripto:", error);
                return res.status(500).send({ error: 'Error al enviar el correo.' });
            }
            console.log("Correo de cripto enviado:", info.response);
            res.status(200).send({ message: 'Comprobante enviado con éxito.' });
        });
    } catch (error) {
        console.error("Error en la ruta /api/crypto-payment:", error);
        res.status(500).send({ error: 'Error interno del servidor.' });
    }
});


// --- Configuración final para Netlify ---
app.use('/api/', router);
module.exports.handler = serverless(app);