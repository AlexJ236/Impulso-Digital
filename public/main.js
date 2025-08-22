// Variable global para almacenar todos los cursos
let allCourses = [];

// Función para mostrar las tarjetas de los cursos
function displayCourses(courses, containerId) {
    const coursesContainer = document.getElementById(containerId);
    coursesContainer.innerHTML = '';

    if (courses.length === 0) {
        coursesContainer.innerHTML = '<p class="no-courses">No se encontraron cursos en esta categoría.</p>';
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
        price.textContent = `$${course.price}`;
        price.className = 'price';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-group';
        
        // Botón "Comprar" ahora redirige a la página de opciones de pago
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

// Función para generar los botones de filtro
function displayFilterButtons(courses) {
    const filterContainer = document.getElementById('filter-container');
    const categories = ['Todos', ...new Set(courses.map(course => course.category))];
    
    filterContainer.innerHTML = '';

    categories.forEach(category => {
        const button = document.createElement('button');
        button.textContent = category;
        button.className = 'filter-btn';
        
        if (category === 'Todos') {
            button.classList.add('active');
        }

        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            if (category === 'Todos') {
                displayCourses(allCourses, 'courses-container');
            } else {
                const filteredCourses = allCourses.filter(course => course.category === category);
                displayCourses(filteredCourses, 'courses-container');
            }
        });
        filterContainer.appendChild(button);
    });
}


// La función principal asincrónica que se ejecuta al cargar la página
async function loadCourses() {
    try {
        const response = await fetch('data/courses.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allCourses = await response.json();

        displayFilterButtons(allCourses);
        displayCourses(allCourses, 'courses-container');

    } catch (error) {
        console.error('Error al cargar los cursos:', error);
        document.getElementById('courses-container').innerHTML = '<p class="error-message">Lo sentimos, no pudimos cargar los cursos en este momento. Inténtelo más tarde.</p>';
    }
}

// Llamar a la función principal para que se ejecute al cargar la página
document.addEventListener('DOMContentLoaded', loadCourses);