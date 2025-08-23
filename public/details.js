// Variable global para almacenar todos los cursos
let allCourses = [];

// Función para mostrar las tarjetas de los cursos (usada para "relacionados")
function displayCourses(courses, containerId) {
    const coursesContainer = document.getElementById(containerId);
    coursesContainer.innerHTML = '';

    if (courses.length === 0) {
        coursesContainer.innerHTML = '<p class="no-courses">No hay cursos relacionados en este momento.</p>';
        return;
    }

    courses.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';

        const image = document.createElement('img');
        image.src = `images/${course.id}.jpg`;
        image.alt = `Imagen del curso ${course.title}`;
        image.className = 'course-card-image';

        const content = document.createElement('div');
        content.className = 'course-card-content';

        const title = document.createElement('h3');
        title.textContent = course.title;

        const description = document.createElement('p');
        description.textContent = course.description;

        const price = document.createElement('span');
        price.className = 'price';
        // --- MODIFICACIÓN AQUÍ ---
        price.innerHTML = currencyService.convertAndFormat(course.price);
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-group';
        
        const buyBtn = document.createElement('a');
        buyBtn.href = `payment-options.html?id=${course.id}`;
        buyBtn.textContent = 'Comprar';
        buyBtn.className = 'btn btn-buy';

        const detailsBtn = document.createElement('a');
        detailsBtn.href = `details.html?id=${course.id}`;
        detailsBtn.textContent = 'Ver Detalles';
        detailsBtn.className = 'btn btn-details';
        
        buttonContainer.appendChild(buyBtn);
        buttonContainer.appendChild(detailsBtn);

        content.appendChild(title);
        content.appendChild(description);
        content.appendChild(price);
        content.appendChild(buttonContainer);
        
        card.appendChild(image);
        card.appendChild(content);

        coursesContainer.appendChild(card);
    });
}

// Función asincrónica para cargar y mostrar los detalles de un curso
async function loadCourseDetails() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');

        if (!courseId) {
            document.getElementById('course-details-container').innerHTML = '<h2>Error: No se encontró el ID del curso.</h2><p>Regresa a la <a href="index.html">página principal</a> para ver todos los cursos.</p>';
            return;
        }

        const response = await fetch('data/courses.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allCourses = await response.json();
        const course = allCourses.find(c => c.id === courseId);

        if (!course) {
            document.getElementById('course-details-container').innerHTML = '<h2>Error: Curso no encontrado.</h2><p>El curso que buscas no existe. <a href="index.html">Ver todos los cursos</a></p>';
            return;
        }

        const detailsContainer = document.getElementById('course-details-container');
        
        // --- MODIFICACIÓN AQUÍ ---
        let detailsHtml = `
            <div class="course-details-card">
                <img src="images/${course.id}.jpg" alt="Imagen del curso ${course.title}" class="details-image">
                <div class="details-content">
                    <h1>${course.title}</h1>
                    <p class="details-description">${course.fullDescription.replace(/\n/g, '<br>')}</p>
                    <p class="details-price">Precio: ${currencyService.convertAndFormat(course.price)}</p>
                    <p class="details-category">Categoría: ${course.category}</p>
                    
                    <div class="details-button-group">
                        <a href="payment-options.html?id=${course.id}" class="btn btn-buy">Comprar</a>
                        <a href="images/${course.id}.jpg" class="btn btn-full-image" target="_blank">Ver Imagen Completa</a>
                        <a href="index.html" class="btn btn-back">Volver a la lista</a>
                    </div>
                </div>
            </div>
        `;
        
        detailsContainer.innerHTML = detailsHtml;

        if (course.demoUrl) {
            const buttonGroup = detailsContainer.querySelector('.details-button-group');
            const demoBtn = document.createElement('a');
            demoBtn.href = course.demoUrl;
            demoBtn.textContent = 'Ver Demo';
            demoBtn.className = 'btn btn-demo';
            demoBtn.target = '_blank';
            
            buttonGroup.prepend(demoBtn);

            if (course.demoInfo) {
                 const demoInfoContainer = document.createElement('div');
                 demoInfoContainer.className = 'demo-info';
                 demoInfoContainer.innerHTML = `
                     <h4>Acceso a la Demo:</h4>
                     <p>Para probar el software, usa las siguientes credenciales:</p>
                     <p>${course.demoInfo}</p>
                 `;
                 detailsContainer.querySelector('.details-content').appendChild(demoInfoContainer);
            }
        }
        
        const relatedCourses = allCourses.filter(c => c.category === course.category && c.id !== course.id);
        displayCourses(relatedCourses, 'related-courses-container');

    } catch (error) {
        console.error('Error al cargar los detalles del curso:', error);
        document.getElementById('course-details-container').innerHTML = '<p class="error-message">Lo sentimos, no pudimos cargar los detalles de este curso. Inténtelo más tarde.</p>';
    }
}

// --- MODIFICACIÓN AQUÍ ---
// Inicia el conversor de moneda y luego carga los detalles del curso
document.addEventListener('DOMContentLoaded', async () => {
    await currencyService.init();
    loadCourseDetails();
});