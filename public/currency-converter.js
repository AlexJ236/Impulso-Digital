// Objeto principal para manejar la conversión de moneda
const currencyService = {
    userCurrency: 'USD', // Moneda por defecto
    exchangeRates: null, // Aquí guardaremos las tasas de cambio

    // Símbolos comunes para mostrar precios de forma más amigable
    symbols: {
        CLP: '$', PEN: 'S/', MXN: '$', ARS: '$', COP: '$', USD: '$', EUR: '€'
    },

    // Función principal que se ejecuta al cargar la página
    async init() {
        // Para no hacer llamadas repetidas, guardamos los datos en la sesión del navegador
        if (sessionStorage.getItem('userCurrency') && sessionStorage.getItem('exchangeRates')) {
            this.userCurrency = sessionStorage.getItem('userCurrency');
            this.exchangeRates = JSON.parse(sessionStorage.getItem('exchangeRates'));
            return;
        }

        try {
            // 1. Detectamos la moneda del usuario a través de su IP
            const geoResponse = await fetch('http://ip-api.com/json/?fields=status,currency');
            const geoData = await geoResponse.json();
            if (geoData.status === 'success' && geoData.currency) {
                this.userCurrency = geoData.currency;
            }

            // 2. Obtenemos las últimas tasas de cambio desde USD
            const ratesResponse = await fetch('https://api.frankfurter.app/latest?from=USD');
            const ratesData = await ratesResponse.json();
            this.exchangeRates = ratesData.rates;

            // 3. Guardamos los datos en la sesión para usarlos en otras páginas
            sessionStorage.setItem('userCurrency', this.userCurrency);
            sessionStorage.setItem('exchangeRates', JSON.stringify(this.exchangeRates));

        } catch (error) {
            console.error("Error al inicializar el conversor de moneda:", error);
            // Si algo falla, la página seguirá funcionando mostrando solo USD.
        }
    },

    // Función que convierte un precio y lo formatea para mostrarlo
    convertAndFormat(usdPrice) {
        const originalPrice = `$${usdPrice.toFixed(2)} USD`;

        // Si la moneda del usuario es USD o no tenemos datos, mostramos solo el precio original
        if (this.userCurrency === 'USD' || !this.exchangeRates || !this.exchangeRates[this.userCurrency]) {
            return originalPrice;
        }

        const localRate = this.exchangeRates[this.userCurrency];
        const convertedAmount = usdPrice * localRate;
        const symbol = this.symbols[this.userCurrency] || this.userCurrency;

        // Formateamos el número para que se vea bien (ej: 10000 -> 10.000)
        const formattedAmount = Math.round(convertedAmount).toLocaleString('es-CL');

        // Devolvemos el HTML con ambos precios
        return `${originalPrice} <span class="local-price">(aprox. ${symbol}${formattedAmount} ${this.userCurrency})</span>`;
    }
};