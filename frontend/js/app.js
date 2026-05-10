let foodItems = []; // Will be fetched from API
let currentFilter = 'all'; // 'all', 'veg', 'non-veg'
let searchQuery = '';

// Initialize cart from localStorage or empty array
let cart = JSON.parse(localStorage.getItem('cravebite_cart')) || [];
const API_BASE = 'http://localhost:5000/api';
const FALLBACK_FOOD_IMAGE = 'img/burger.png';
const LOCAL_FOOD_IMAGES = [
    'img/burger.png',
    'img/pizza.png',
    'img/salad.png',
    'img/Paneer-Tikka-Featured-1.jpg',
    'img/Spaghetti-Carbonara-Plated.jpg',
    'img/download.jpg',
    'img/FZgBhWpXwAEDjBm.jpg'
];
const FOOD_IMAGE_OVERRIDES = {
    'spaghetti carbonara': 'img/Spaghetti-Carbonara-Plated.jpg',
    'panner tikka': 'img/Paneer-Tikka-Featured-1.jpg',
    'paneer tikka': 'img/Paneer-Tikka-Featured-1.jpg',
    'chicken gourmet cheeseburger': 'img/burger.png',
    'chicken pepperoni pizza': 'img/pizza.png',
    'healthy mixed salad': 'img/salad.png'
};

function getFoodImageFallback(item = {}, index = 0) {
    const title = String(item.title || '').trim().toLowerCase();
    return FOOD_IMAGE_OVERRIDES[title] || LOCAL_FOOD_IMAGES[index % LOCAL_FOOD_IMAGES.length] || FALLBACK_FOOD_IMAGE;
}

function normalizeImageUrl(image, fallback = FALLBACK_FOOD_IMAGE) {
    if (!image) return fallback;
    let url = String(image).trim().replace(/\\/g, '/');
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.endsWith('/carbonara.png') || lowerUrl === 'img/carbonara.png') {
        return fallback;
    }
    if (lowerUrl.startsWith('frontend/')) {
        url = url.slice(9);
    }
    if (lowerUrl.startsWith('file://')) {
        url = url.replace(/^file:\/\/+/, '');
    }
    if (/^[a-z]:\//i.test(url)) {
        const filename = url.split('/').pop();
        return filename ? `img/${filename}` : 'img/burger.png';
    }
    if (/^(https?:|data:|\/\/)/i.test(url)) {
        return url;
    }
    if (url.startsWith('/')) {
        url = url.slice(1);
    }
    return url || fallback;
}

function handleFoodImageError(img, fallback = FALLBACK_FOOD_IMAGE) {
    if (img.dataset.fallbackApplied === 'true') return;
    img.dataset.fallbackApplied = 'true';
    img.src = fallback;
}

document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    loadSavedTheme();
    updateCartCount();
    updateAuthUI();
    restoreLocation();

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // If on homepage, render food items
    if (document.getElementById('food-grid')) {
        fetchFoods();
    }

    // If on admin page, render admin list
    if (document.getElementById('admin-food-list')) {
        if (foodItems.length === 0) fetchFoods();
        renderAdminFoodItems();
    }

    if (document.getElementById('customer-orders-list')) {
        renderCustomerOrders();
    }
});

function updateAuthUI() {
    const userStr = localStorage.getItem('cravebite_user');
    if (!userStr) return;

    try {
        const user = JSON.parse(userStr);
        const loginLinks = document.querySelectorAll('a[href="login.html"]');
        loginLinks.forEach(link => {
            if (link.closest('nav')) {
                link.href = "#";
                link.innerHTML = `<i class="fa-solid fa-user"></i> ${user.username} <span style="font-size: 0.8rem; margin-left: 0.5rem; cursor: pointer; color: var(--primary-color);" onclick="handleLogout()">(Logout)</span>`;
            }
        });
    } catch (e) {
        console.error("Error parsing user data", e);
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('cravebite_theme', theme);
    updateThemeIcon();
}

function isDarkTheme() {
    return document.body.classList.contains('dark-theme');
}

function updateThemeIcon() {
    const themeIcon = document.querySelector('#theme-toggle i');
    if (!themeIcon) return;

    themeIcon.classList.toggle('fa-sun', !isDarkTheme());
    themeIcon.classList.toggle('fa-moon', isDarkTheme());
    themeIcon.title = isDarkTheme() ? 'Switch to light theme' : 'Switch to dark theme';
}

function toggleTheme() {
    applyTheme(isDarkTheme() ? 'light' : 'dark');
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('cravebite_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
        applyTheme(savedTheme);
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
    }
}

function fetchFoods() {
    const localFoods = localStorage.getItem('cravebite_foods');

    const defaultFoods = [
        {
            id: 1,
            title: "Chicken Gourmet Cheeseburger",
            description: "Juicy chicken breast patty with fresh lettuce, tomato, and melted cheese on a brioche bun.",
            price: 200,
            image: "img/burger.png",
            is_veg: false,
            rating: 4.8
        },
        {
            id: 2,
            title: "Chicken Pepperoni Pizza",
            description: "Hot, freshly baked pizza with loaded pepperoni and gooey mozzarella cheese.",
            price: 350,
            image: "img/pizza.png",
            is_veg: false,
            rating: 4.6
        },
        {
            id: 3,
            title: "Healthy Mixed Salad",
            description: "Fresh mixed greens with cherry tomatoes, cucumbers, and our signature vinaigrette.",
            price: 150,
            image: "img/salad.png",
            is_veg: true,
            rating: 4.4
        },
        {
            id: 4,
            title: "Panner Tikka",
            description: "A classic Indian dish made with marinated cottage cheese cooked in a tandoor.",
            price: 150,
            image: "img/Paneer-Tikka-Featured-1.jpg",
            is_veg: true,
            rating: 4.7
        },
        {
            id: 5,
            title: "Spaghetti Carbonara",
            description: "Classic Italian pasta dish with creamy sauce, pancetta, and Parmesan cheese.",
            price: 200,
            image: "img/Spaghetti-Carbonara-Plated.jpg",
            is_veg: true,
            rating: 4.5
        },
        {
            id: 6,
            title: "Hara Bhara Kabab",
            description: "A great vegetarian alternative to Paneer Tikka. These are pan-fried patties made with spinach, green peas, and potatoes, flavored with spices.",
            price: 180,
            image: "img/hara-bhara-kabab.png",
            is_veg: true,
            rating: 4.5
        },
        {
            id: 7,
            title: "Chicken 65(8pcs.)",
            description: "A spicy, deep-fried chicken dish originating from Chennai. It's a fantastic, punchy appetizer that works well for delivery or quick bites.",
            price: 170,
            image: "img/Gemini_Generated_Image_6httga6httga6htt.png",
            is_veg: false,
            rating: 4.6
        },
        {
            id: 8,
            title: "Amritsari Fish Fry(8pcs.)",
            description: "If you want to introduce seafood, these chickpea-flour battered fish fillets are crispy, tangy, and very popular.",
            price: 250,
            image: "img/Gemini_Generated_Image_jn9tm2jn9tm2jn9t.png",
            is_veg: false,
            rating: 4.7
        },
        {
            id: 9,
            title: "Butter Chicken (Murgh Makhani)",
            description: "This is a global favorite. Its creamy, tomato-based gravy is the perfect counterpoint to the spicier Mutton Biryani.",
            price: 320,
            image: "img/butter-chicken.png",
            is_veg: false,
            rating: 4.8
        },
        {
            id: 10,
            title: "Dal Makhani",
            description: "A premium vegetarian main. Slow-cooked black lentils and kidney beans with plenty of butter and cream.",
            price: 140,
            image: "img/dal-makhani.png",
            is_veg: true,
            rating: 4.9
        },
        {
            id: 11,
            title: "Goan Prawn Curry",
            description: "For a coastal touch, this coconut-milk-based curry offers a different flavor profile (tangy and tropical) compared to North Indian dishes.",
            price: 250,
            image: "img/goan-prawn-curry.png",
            is_veg: false,
            rating: 4.6
        },
        {
            id: 12,
            title: "Garlic Naan / Butter Naan",
            description: "Essential for the curries.",
            price: 60,
            image: "img/garlic-naan.png",
            is_veg: true,
            rating: 4.8
        },
        {
            id: 13,
            title: "Burani Raita",
            description: "Since you are adding Biryani, a garlic-infused yogurt (Burani Raita) is a classic pairing that elevates the dish for the customer.",
            price: 80,
            image: "img/burani-raita.png",
            is_veg: true,
            rating: 4.5
        },
        {
            id: 14,
            title: "Gulab Jamun",
            description: "Small, deep-fried dumplings soaked in saffron-scented sugar syrup. They are easy to store and serve.",
            price: 120,
            image: "img/gulab-jamun.png",
            is_veg: true,
            rating: 4.9
        },
        {
            id: 15,
            title: "Mango Lassi",
            description: "A refreshing drink that acts as both a beverage and a light dessert, perfect for cutting through the heat of Indian spices.",
            price: 140,
            image: "img/mango-lassi.png",
            is_veg: true,
            rating: 4.8
        }
    ];

    if (localFoods) {
        foodItems = JSON.parse(localFoods);
        let needsSave = false;

        foodItems = foodItems.map(item => {
            const defItem = defaultFoods.find(d => d.title === item.title);
            if (defItem && defItem.image !== item.image) {
                item.image = defItem.image;
                needsSave = true;
            }
            return item;
        });

        foodItems = foodItems.map((item, index) => {
            const fallbackImage = getFoodImageFallback(item, index);
            const normalizedImage = normalizeImageUrl(item.image, fallbackImage);
            if (item.image !== normalizedImage) {
                needsSave = true;
            }
            if (item.rating === undefined || item.rating === null) {
                needsSave = true;
                return { ...item, image: normalizedImage, rating: 4.5 };
            }
            return { ...item, image: normalizedImage };
        });

        // Merge missing defaults
        defaultFoods.forEach(defItem => {
            if (!foodItems.find(f => f.title === defItem.title)) {
                const newId = foodItems.length > 0 ? Math.max(...foodItems.map(f => f.id)) + 1 : 1;
                foodItems.push({ ...defItem, id: newId });
                needsSave = true;
            }
        });

        if (needsSave) {
            localStorage.setItem('cravebite_foods', JSON.stringify(foodItems));
        }
    } else {
        foodItems = defaultFoods;
        localStorage.setItem('cravebite_foods', JSON.stringify(foodItems));
    }
    renderFoodItems();
}

function addFood(data) {
    if (foodItems.length === 0) fetchFoods(); // ensure loaded
    const newId = foodItems.length > 0 ? Math.max(...foodItems.map(f => f.id)) + 1 : 1;
    const newItem = { id: newId, is_available: true, rating: 4.5, ...data };

    const updatedFoods = [...foodItems, newItem];

    try {
        localStorage.setItem('cravebite_foods', JSON.stringify(updatedFoods));
        foodItems.push(newItem);
    } catch (e) {
        console.error("Storage error:", e);
        return { error: 'Storage limit reached! Please delete old items or use smaller images.' };
    }

    if (document.getElementById('admin-food-list')) {
        renderAdminFoodItems();
    }

    return { message: 'Food item added successfully' };
}

function renderAdminFoodItems() {
    const list = document.getElementById('admin-food-list');
    if (!list) return;

    if (foodItems.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary);">No items found in the menu.</p>';
        return;
    }

    let html = '';
    foodItems.forEach((item, index) => {
        const isUnavailable = item.is_available === false;
        html += `
            <div class="animate-fade-in" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: var(--bg-color); border-radius: 8px; border: 1px solid #ddd;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <img src="${normalizeImageUrl(item.image, getFoodImageFallback(item, index))}" alt="${item.title}" onerror="handleFoodImageError(this, '${getFoodImageFallback(item, index)}')" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; ${isUnavailable ? 'opacity: 0.5;' : ''}">
                    <div>
                        <h4 style="margin: 0; ${isUnavailable ? 'color: #999; text-decoration: line-through;' : ''}">${item.title}</h4>
                        <span style="font-size: 0.9rem; color: var(--text-secondary);">₹${item.price.toFixed(2)}</span>
                        ${isUnavailable ? '<span style="color: red; font-size: 0.8rem; margin-left: 0.5rem; font-weight: bold;">(Out of Stock)</span>' : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
                    <button onclick="toggleFoodAvailability(${item.id})" class="btn" style="padding: 0.5rem 1rem; background: ${isUnavailable ? '#4CAF50' : '#f0ad4e'}; border: none;">
                        ${isUnavailable ? '<i class="fa-solid fa-check"></i> Make Available' : '<i class="fa-solid fa-ban"></i> Make Unavailable'}
                    </button>
                    <button onclick="deleteFood(${item.id})" class="btn" style="padding: 0.5rem 1rem; background: #dc3545; border: none;">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function deleteFood(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    foodItems = foodItems.filter(f => f.id !== id);
    localStorage.setItem('cravebite_foods', JSON.stringify(foodItems));

    // Also remove from cart if it's there
    cart = cart.filter(c => c.id !== id);
    saveCart();

    renderAdminFoodItems();

    // If we are somehow also rendering the grid (e.g. single page view), update it
    if (document.getElementById('food-grid')) renderFoodItems();

    showToast('Item deleted successfully');
}

function toggleFoodAvailability(id) {
    const item = foodItems.find(f => f.id === id);
    if (item) {
        item.is_available = item.is_available === false ? true : false;
        localStorage.setItem('cravebite_foods', JSON.stringify(foodItems));

        // If made unavailable, remove from cart
        if (!item.is_available) {
            cart = cart.filter(c => c.id !== id);
            saveCart();
        }

        renderAdminFoodItems();
        if (document.getElementById('food-grid')) renderFoodItems();

        showToast(item.is_available ? 'Item marked as available' : 'Item marked as unavailable');
    }
}

function getRatingStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    let html = '';

    for (let i = 0; i < fullStars; i++) {
        html += '<i class="fa-solid fa-star"></i>';
    }
    if (halfStar) {
        html += '<i class="fa-solid fa-star-half-stroke"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        html += '<i class="fa-regular fa-star"></i>';
    }

    return html;
}

function renderFoodItems() {
    const grid = document.getElementById('food-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filteredItems = foodItems.filter(item => {
        let dietaryMatch = true;
        if (currentFilter === 'veg') dietaryMatch = item.is_veg === true;
        if (currentFilter === 'non-veg') dietaryMatch = item.is_veg === false || item.is_veg === undefined;

        let searchMatch = true;
        if (searchQuery && searchQuery.trim() !== '') {
            const query = searchQuery.trim().toLowerCase();
            searchMatch = item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);
        }

        return dietaryMatch && searchMatch;
    });

    if (filteredItems.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: var(--text-secondary);">No items match this filter or search.</p>';
        return;
    }

    filteredItems.forEach((item, index) => {
        // Add a slight delay for animation effect
        const animationDelay = index * 0.1;
        const isUnavailable = item.is_available === false;

        const card = document.createElement('div');
        card.className = 'food-card animate-fade-in';
        card.style.animationDelay = `${animationDelay}s`;
        if (isUnavailable) {
            card.style.opacity = '0.6';
            card.style.position = 'relative';
        }

        const badgeHtml = isUnavailable ? '<div style="position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; z-index: 10; font-size: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Out of Stock</div>' : '';
        const ratingHtml = item.rating ? `
                <div class="food-rating">
                    <span class="rating-score">${item.rating.toFixed(1)}</span>
                    <span class="rating-stars">${getRatingStars(item.rating)}</span>
                </div>
            ` : '';

        card.innerHTML = `
            <div class="food-img-container">
                ${badgeHtml}
                <img src="${normalizeImageUrl(item.image, getFoodImageFallback(item, index))}" alt="${item.title}" onerror="handleFoodImageError(this, '${getFoodImageFallback(item, index)}')">
                <div class="food-price-tag">₹${item.price.toFixed(2)}</div>
            </div>
            <div class="food-info">
                <h3 class="food-title">${item.title}</h3>
                ${ratingHtml}
                <p class="food-desc">${item.description}</p>
                <button class="btn btn-add" ${isUnavailable ? 'disabled style="background: #ccc; cursor: not-allowed; color: #666; transform: none; box-shadow: none;"' : `onclick="addToCart(${item.id})"`}>
                    <i class="fa-solid ${isUnavailable ? 'fa-ban' : 'fa-plus'}"></i> ${isUnavailable ? 'Unavailable' : 'Add to Cart'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function setDietaryFilter(filter) {
    currentFilter = filter;

    // Update active button styling
    const buttons = document.querySelectorAll('.dietary-filter .filter-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${filter}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderFoodItems();
}

function handleSearch(event) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchQuery = searchInput.value;
        renderFoodItems();

        if (event && event.type === 'keyup' && event.key === 'Enter') {
            document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
        }
    }
}

function addToCart(id) {
    const item = foodItems.find(f => f.id === id);
    if (!item) return;

    const existingItem = cart.find(c => c.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }

    saveCart();
    showToast(`Added ${item.title} to cart!`);
}

function updateQuantity(id, change) {
    const item = cart.find(c => c.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(id);
        } else {
            saveCart();
            if (document.getElementById('cart-container')) {
                renderCartPage();
            }
        }
    }
}

function removeFromCart(id) {
    cart = cart.filter(c => c.id !== id);
    saveCart();
    if (document.getElementById('cart-container')) {
        renderCartPage();
    }
    showToast('Item removed from cart');
}

function saveCart() {
    localStorage.setItem('cravebite_cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const counts = document.querySelectorAll('.cart-count');
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    counts.forEach(count => {
        count.textContent = totalCount;

        count.style.transform = 'scale(1.2)';
        setTimeout(() => { count.style.transform = 'scale(1)'; }, 200);
    });
}

function loadDeliveryAddress() {
    return localStorage.getItem('cravebite_delivery_address') || '';
}

function saveDeliveryAddress() {
    const input = document.getElementById('delivery-address');
    if (!input) return;

    const address = input.value.trim();
    if (address.length < 10) {
        showToast('Please enter a valid delivery address.');
        return;
    }

    localStorage.setItem('cravebite_delivery_address', address);
    showToast('Delivery address saved!');
}

async function detectDeliveryAddress() {
    const input = document.getElementById('delivery-address');
    if (!input) return;

    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.');
        return;
    }

    input.disabled = true;
    input.placeholder = 'Detecting your location...';

    navigator.geolocation.getCurrentPosition(async (position) => {
        try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
            const data = await response.json();

            const addressText = data.display_name || 'Latitude: ' + lat.toFixed(5) + ', Longitude: ' + lon.toFixed(5);
            input.value = addressText;
            localStorage.setItem('cravebite_delivery_address', addressText);
            showToast('Delivery address detected and saved.');
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
            showToast('Unable to detect address. Please enter it manually.');
        } finally {
            input.disabled = false;
            input.placeholder = 'Street, landmark, city, postal code...';
        }
    }, (error) => {
        console.error('Geolocation error:', error);
        showToast('Location access denied or unavailable. Please enter address manually.');
        input.disabled = false;
        input.placeholder = 'Street, landmark, city, postal code...';
    }, {
        timeout: 10000,
        enableHighAccuracy: false
    });
}

function renderCartPage() {
    const container = document.getElementById('cart-container');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-cart-arrow-down"></i>
                <h3>Your cart is empty</h3>
                <p>Looks like you haven't added any delicious food yet.</p>
                <a href="index.html" class="btn" style="margin-top: 1.5rem;">Browse Menu</a>
            </div>
        `;
        return;
    }

    const savedAddress = loadDeliveryAddress();
    let html = '';
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        html += `
            <div class="cart-item animate-fade-in">
                <img src="${normalizeImageUrl(item.image, getFoodImageFallback(item, index))}" alt="${item.title}" class="cart-item-img" onerror="handleFoodImageError(this, '${getFoodImageFallback(item, index)}')">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.title}</div>
                    <div class="cart-item-price">₹${item.price.toFixed(2)}</div>
                </div>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                    <span class="cart-item-qty">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                    <button class="cart-item-remove" onclick="removeFromCart(${item.id})" title="Remove item">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    html += `
        <div class="checkout-grid animate-fade-in" style="animation-delay: 0.2s">
            <div class="cart-summary">
                <div class="cart-total">Total: ₹${total.toFixed(2)}</div>
                <p class="checkout-note"><i class="fa-solid fa-truck-fast"></i> Fast delivery within 45 mins</p>
                <button class="btn btn-large" onclick="checkout()">
                    Proceed to Checkout <i class="fa-solid fa-arrow-right" style="margin-left: 0.5rem;"></i>
                </button>
            </div>

            <div class="checkout-address">
                <div class="address-header">
                    <h3><i class="fa-solid fa-location-dot"></i> Delivery Address</h3>
                    <p class="address-subtext">Enter the delivery address for this order.</p>
                </div>
                <textarea id="delivery-address" class="address-input" placeholder="Street, landmark, city, postal code..." rows="4"></textarea>
                <div class="address-actions">
                    <button class="btn btn-outline" onclick="detectDeliveryAddress()">
                        <i class="fa-solid fa-location-crosshairs"></i> Detect my location
                    </button>
                    <button class="btn address-save-btn" onclick="saveDeliveryAddress()">
                        <i class="fa-solid fa-save"></i> Save Address
                    </button>
                </div>
                ${savedAddress ? `<div class="address-preview"><span>Saved address</span><p>${savedAddress}</p></div>` : ''}
            </div>
        </div>
    `;

    container.innerHTML = html;
    const addressTextarea = document.getElementById('delivery-address');
    if (addressTextarea && savedAddress) {
        addressTextarea.value = savedAddress;
    }
}

async function checkout() {
    if (cart.length === 0) return;

    const userStr = localStorage.getItem('cravebite_user');
    if (!userStr) {
        showToast('Please login to place an order');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }

    const address = loadDeliveryAddress().trim();
    if (address.length < 10) {
        showToast('Enter a valid delivery address before checkout.');
        return;
    }

    localStorage.setItem('cravebite_delivery_address', address);

    showPaymentModal();
}

function showPaymentModal() {
    let modal = document.getElementById('payment-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'payment-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="payment-modal-content animate-fade-in">
                <div class="payment-header">
                    <h3><i class="fa-solid fa-lock"></i> Secure Payment</h3>
                    <button class="close-modal" onclick="closePaymentModal()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="payment-body">
                    <div class="payment-methods">
                        <label class="payment-method selected">
                            <input type="radio" name="payment_method" value="card" checked onchange="togglePaymentDetails()">
                            <i class="fa-regular fa-credit-card"></i> Credit / Debit Card
                        </label>
                        <label class="payment-method">
                            <input type="radio" name="payment_method" value="upi" onchange="togglePaymentDetails()">
                            <i class="fa-brands fa-google-pay"></i>
                            <i class="fa-brands fa-amazon-pay"></i>
                            <i class="fa-brands fa-paypal"></i>UPI
                        </label>
                        <label class="payment-method">
                            <input type="radio" name="payment_method" value="cod" onchange="togglePaymentDetails()">
                            <i class="fa-solid fa-money-bill-1-wave"></i> Cash on Delivery
                        </label>
                    </div>
                    
                    <div id="card-details" class="payment-details active">
                        <div class="form-group">
                            <label>Card Number</label>
                            <input type="text" placeholder="0000 0000 0000 0000" maxlength="19" class="form-control">
                        </div>
                        <div class="form-row">
                            <div class="form-group" style="flex: 1;">
                                <label>Expiry Date</label>
                                <input type="text" placeholder="MM/YY" maxlength="5" class="form-control">
                            </div>
                            <div class="form-group" style="flex: 1;">
                                <label>CVV</label>
                                <input type="password" placeholder="123" maxlength="3" class="form-control">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Cardholder Name</label>
                            <input type="text" placeholder="John Doe" class="form-control">
                        </div>
                    </div>
                    
                    <div id="upi-details" class="payment-details">
                        <div class="form-group" style="display: flex; gap: 0.5rem; align-items: flex-end; margin-bottom: 0.5rem;">
                            <div style="flex: 1;">
                                <label>UPI ID</label>
                                <input type="text" id="upi-id-input" placeholder="username@upi" class="form-control">
                            </div>
                            <button type="button" class="btn btn-outline" onclick="verifyUPI(this)" style="padding: 0.75rem 1.5rem; border-radius: 10px;">Verify</button>
                        </div>
                        <div id="upi-verify-msg" style="font-size: 0.85rem; margin-bottom: 1.5rem; min-height: 20px;"></div>
                        
                        <div style="text-align: center; margin: 1.5rem 0; position: relative;">
                            <hr style="border: none; border-top: 1px solid rgba(0,0,0,0.1); position: absolute; top: 50%; width: 100%; z-index: 0;">
                            <span style="background: var(--bg-color); padding: 0 15px; color: var(--text-secondary); position: relative; z-index: 1; font-weight: 600; font-size: 0.9rem;">OR</span>
                        </div>
                        
                        <div style="text-align: center;">
                            <p style="margin-bottom: 1rem; font-weight: 600; color: var(--text-primary);">Scan QR Code to Pay</p>
                            <div style="display: inline-block; padding: 0.5rem; background: white; border-radius: 12px; box-shadow: var(--shadow-sm); margin-bottom: 1rem;">
                                <img src="img/upi-qr.jpeg" alt="QR Code" style="width: 160px; height: 150px; display: block;">
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.85rem; max-width: 80%; margin: 0 auto;">UPI payment will be processed instantly. Please wait for the confirmation.</p>
                        </div>
                    </div>
                    
                    <div id="cod-details" class="payment-details">
                        <p style="color: var(--text-secondary); text-align: center; padding: 1rem 0;">Pay with cash when your food arrives.</p>
                    </div>
                </div>
                
                <div class="payment-footer">
                    <button class="btn btn-large" style="width: 100%;" onclick="processPayment()">
                        Pay ₹${cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        const payBtn = modal.querySelector('.payment-footer .btn');
        if (payBtn) payBtn.innerHTML = `Pay ₹${cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}`;
        modal.style.display = 'flex';
        const payBtnState = modal.querySelector('.payment-footer .btn');
        if (payBtnState) payBtnState.disabled = false;
    }
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}


function togglePaymentDetails() {
    const selected = document.querySelector('input[name="payment_method"]:checked').value;

    document.querySelectorAll('.payment-method').forEach(label => {
        label.classList.remove('selected');
        if (label.querySelector('input').checked) {
            label.classList.add('selected');
        }
    });


    document.querySelectorAll('.payment-details').forEach(el => {
        el.classList.remove('active');
    });


    if (selected === 'card') document.getElementById('card-details').classList.add('active');
    else if (selected === 'upi') document.getElementById('upi-details').classList.add('active');
    else if (selected === 'cod') document.getElementById('cod-details').classList.add('active');
}

function verifyUPI(btn) {
    const input = document.getElementById('upi-id-input');
    const msg = document.getElementById('upi-verify-msg');
    const upiPattern = /^[\w.-]+@[\w.-]+$/;
    if (!upiPattern.test(input.value.trim())) {
        msg.innerHTML = '<span style="color: #dc3545;"><i class="fa-solid fa-circle-xmark"></i> Please enter a valid UPI ID (e.g., name@bank)</span>';
        return;
    }

    msg.innerHTML = '<span style="color: var(--primary-color);"><i class="fa-solid fa-spinner fa-spin"></i> Verifying...</span>';

    // Disable input and button while verifying
    input.disabled = true;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

    setTimeout(() => {
        const domain = input.value.split('@')[1].toLowerCase();
        const username = input.value.split('@')[0].toLowerCase();
        if (domain === 'gmail.com') {
            msg.innerHTML = '<span style="color: #dc3545;"><i class="fa-solid fa-circle-xmark"></i> Not verified: Gmail UPI not supported</span>';
        } else {
            msg.innerHTML = '<span style="color: #28a745; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Verified: ' + username + '</span>';
        }
        input.disabled = false;
        btn.disabled = false;
        btn.innerHTML = originalText;
    }, 1500);
}

function processPayment() {
    const selected = document.querySelector('input[name="payment_method"]:checked').value;

    const payBtn = document.querySelector('.payment-footer .btn');
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    payBtn.disabled = true;

    setTimeout(() => {
        // Save order to localStorage before clearing the cart
        const orders = JSON.parse(localStorage.getItem('cravebite_orders') || '[]');
        const currentUser = JSON.parse(localStorage.getItem('cravebite_user') || '{"username": "Guest"}');
        const newOrder = {
            id: 'ORD-' + Math.floor(Math.random() * 1000000),
            date: new Date().toISOString(),
            items: [...cart],
            total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
            paymentMethod: selected,
            address: localStorage.getItem('cravebite_delivery_address') || 'Not specified',
            user: currentUser.username,
            userId: currentUser.id,
            status: 'Pending',
            updatedAt: new Date().toISOString(),
            statusHistory: [
                { status: 'Pending', date: new Date().toISOString() }
            ]
        };
        orders.unshift(newOrder); // Add to beginning of array
        localStorage.setItem('cravebite_orders', JSON.stringify(orders));

        closePaymentModal();
        cart = [];
        saveCart();
        renderCartPage();

        let msg = selected === 'cod' ? 'Order placed successfully! Pay on delivery.' : 'Payment successful! Order placed.';
        showToast(msg);
        showToast('Thank you for ordering with CraveBite! Your food will be delivered to your address.');

        const modal = document.getElementById('payment-modal');
        if (modal) modal.remove();
        setTimeout(() => window.location.href = 'view-orders.html', 1200);

    }, 1500);
}

// --- Customer Order Tracking ---
const ORDER_STATUS_STEPS = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function getOrderStatusMeta(status) {
    const statusMap = {
        'Pending': {
            color: '#f0ad4e',
            icon: 'fa-clock',
            message: 'Your order is waiting for kitchen confirmation.'
        },
        'Preparing': {
            color: '#17a2b8',
            icon: 'fa-kitchen-set',
            message: 'The kitchen is preparing your food.'
        },
        'Out for Delivery': {
            color: '#007bff',
            icon: 'fa-motorcycle',
            message: 'Your order is on the way.'
        },
        'Delivered': {
            color: '#28a745',
            icon: 'fa-circle-check',
            message: 'Your food has been delivered.'
        },
        'Cancelled': {
            color: '#dc3545',
            icon: 'fa-circle-xmark',
            message: 'This order has been cancelled.'
        }
    };

    return statusMap[status] || statusMap.Pending;
}

function getCurrentCustomer() {
    try {
        return JSON.parse(localStorage.getItem('cravebite_user') || 'null');
    } catch (error) {
        return null;
    }
}

function getCustomerOrders() {
    const user = getCurrentCustomer();
    if (!user) return [];

    const orders = JSON.parse(localStorage.getItem('cravebite_orders') || '[]');
    return orders.filter(order => {
        return order.user === user.username || (!order.user && order.userId && order.userId === user.id);
    });
}

function buildOrderTimeline(status) {
    if (status === 'Cancelled') {
        return `
            <div class="order-timeline cancelled">
                <div class="timeline-step completed">
                    <span><i class="fa-solid fa-circle-xmark"></i></span>
                    <p>Cancelled</p>
                </div>
            </div>
        `;
    }

    const currentIndex = Math.max(0, ORDER_STATUS_STEPS.indexOf(status));
    const stepsHtml = ORDER_STATUS_STEPS.map((step, index) => {
        const stepClass = index <= currentIndex ? 'completed' : '';
        const icon = index < currentIndex ? 'fa-check' : getOrderStatusMeta(step).icon;
        return `
            <div class="timeline-step ${stepClass}">
                <span><i class="fa-solid ${icon}"></i></span>
                <p>${step}</p>
            </div>
        `;
    }).join('');

    return `<div class="order-timeline">${stepsHtml}</div>`;
}

function formatPaymentMethod(method) {
    const labels = {
        card: 'Credit / Debit Card',
        upi: 'UPI',
        cod: 'Cash on Delivery'
    };

    return labels[method] || String(method || 'Not specified').toUpperCase();
}

function getEstimatedDeliveryText(order) {
    if (order.status === 'Delivered') return 'Delivered';
    if (order.status === 'Cancelled') return 'Cancelled';

    const placedAt = new Date(order.date);
    if (Number.isNaN(placedAt.getTime())) return 'Within 45 mins';

    const eta = new Date(placedAt.getTime() + 45 * 60 * 1000);
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderCustomerOrders() {
    const container = document.getElementById('customer-orders-list');
    if (!container) return;

    const user = getCurrentCustomer();
    if (!user) {
        container.innerHTML = `
            <div class="orders-empty-state">
                <i class="fa-solid fa-user-lock"></i>
                <h2>Please login to view orders</h2>
                <p>Your order status is connected with your CraveBite account.</p>
                <a href="login.html" class="btn">Login</a>
            </div>
        `;
        return;
    }

    const orders = getCustomerOrders();
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="orders-empty-state">
                <i class="fa-solid fa-receipt"></i>
                <h2>No orders yet</h2>
                <p>Once you place an order, every update will appear here.</p>
                <a href="index.html#menu" class="btn">Order Food</a>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map((order, orderIndex) => {
        const orderDate = new Date(order.date).toLocaleString();
        const statusMeta = getOrderStatusMeta(order.status);
        const orderItems = Array.isArray(order.items) ? order.items : [];
        const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const itemsHtml = orderItems.map((item, index) => {
            const imageFallback = getFoodImageFallback(item, orderIndex + index);
            return `
                <div class="customer-order-item">
                    <img src="${normalizeImageUrl(item.image, imageFallback)}" alt="${escapeHTML(item.title)}" onerror="handleFoodImageError(this, '${imageFallback}')">
                    <div>
                        <strong>${escapeHTML(item.title)}</strong>
                        <p>${item.quantity} x ₹${Number(item.price).toFixed(2)}</p>
                    </div>
                    <span>₹${(Number(item.price) * item.quantity).toFixed(2)}</span>
                </div>
            `;
        }).join('');
        const canCancel = order.status === 'Pending';

        return `
            <article class="customer-order-card">
                <div class="customer-order-head">
                    <div>
                        <h2>Order #${escapeHTML(order.id)}</h2>
                        <p><i class="fa-regular fa-clock"></i> ${orderDate}</p>
                    </div>
                    <span class="order-status-badge" style="background: ${statusMeta.color};">
                        <i class="fa-solid ${statusMeta.icon}"></i> ${escapeHTML(order.status)}
                    </span>
                </div>

                <div class="order-status-summary">
                    <strong>${escapeHTML(statusMeta.message)}</strong>
                    <span>ETA: ${getEstimatedDeliveryText(order)}</span>
                </div>

                ${buildOrderTimeline(order.status)}

                <div class="customer-order-details">
                    <div>
                        <h3><i class="fa-solid fa-burger"></i> Items (${itemCount})</h3>
                        <div class="customer-order-items">${itemsHtml}</div>
                    </div>
                    <div class="customer-order-meta">
                        <h3><i class="fa-solid fa-circle-info"></i> Order Details</h3>
                        <p><strong>Total:</strong> ₹${Number(order.total).toFixed(2)}</p>
                        <p><strong>Payment:</strong> ${formatPaymentMethod(order.paymentMethod)}</p>
                        <p><strong>Address:</strong> ${escapeHTML(order.address || 'Not specified')}</p>
                        <p><strong>Last updated:</strong> ${new Date(order.updatedAt || order.date).toLocaleString()}</p>
                        ${canCancel ? `<button type="button" class="btn cancel-order-btn" onclick="cancelCustomerOrder('${escapeHTML(order.id)}')"><i class="fa-solid fa-ban"></i> Cancel Order</button>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function cancelCustomerOrder(orderId) {
    const user = getCurrentCustomer();
    if (!user) {
        showToast('Please login to cancel an order');
        return;
    }

    const orders = JSON.parse(localStorage.getItem('cravebite_orders') || '[]');
    const orderIndex = orders.findIndex(order => order.id === orderId && order.user === user.username);
    if (orderIndex === -1) {
        showToast('Order not found');
        return;
    }

    if (orders[orderIndex].status !== 'Pending') {
        showToast('Only pending orders can be cancelled');
        renderCustomerOrders();
        return;
    }

    orders[orderIndex].status = 'Cancelled';
    orders[orderIndex].updatedAt = new Date().toISOString();
    orders[orderIndex].statusHistory = orders[orderIndex].statusHistory || [];
    orders[orderIndex].statusHistory.push({ status: 'Cancelled', date: orders[orderIndex].updatedAt });
    localStorage.setItem('cravebite_orders', JSON.stringify(orders));
    showToast(`Order #${orderId} cancelled`);
    renderCustomerOrders();
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i class="fa-solid fa-circle-check"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Auth Handling ---
async function handleLogin(username, password) {
    // Mock login without backend
    const user = { id: username.trim().toLowerCase(), username: username, role: 'user' };
    localStorage.setItem('cravebite_user', JSON.stringify(user));
    showToast('Logged in successfully!');

    // Auto-detect location on login
    detectLocation();

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

async function handleAdminLogin(username, password) {
    // Mock admin login
    const user = { id: 2, username: username, role: 'admin' };
    localStorage.setItem('cravebite_admin', JSON.stringify(user));
    showToast('Admin logged in successfully!');

    setTimeout(() => {
        window.location.href = 'admin.html';
    }, 1000);
}

async function handleRegister(username, password) {
    // Mock register without backend
    showToast('Registered successfully! Please login.');
    setTimeout(() => window.location.href = 'login.html', 1500);
}

async function handleAdminRegister(username, password) {
    // Mock admin register
    showToast('Admin registered successfully! Please login.');
    setTimeout(() => window.location.href = 'admin-login.html', 1500);
}

async function handleLogout() {
    localStorage.removeItem('cravebite_user');
    localStorage.removeItem('cravebite_location');
    window.location.href = 'login.html';
}

async function handleAdminLogout(e) {
    if (e) e.preventDefault();
    localStorage.removeItem('cravebite_admin');
    window.location.href = 'admin-login.html';
}

// --- Location Services ---
function detectLocation() {
    const locText = document.getElementById('location-text');

    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser');
        return;
    }

    // Check if in secure context (required for geolocation)
    if (!window.isSecureContext) {
        showToast('Location access requires HTTPS. Please serve the site over HTTPS or use localhost.');
        return;
    }

    if (locText) locText.textContent = 'Detecting...';

    navigator.geolocation.getCurrentPosition(async (position) => {
        try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Reverse geocoding using free OpenStreetMap API
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await response.json();

            let locationName = "Unknown Location";
            if (data.address) {
                locationName = data.address.city || data.address.town || data.address.village || data.address.suburb || "Your Location";
            }

            if (locText) locText.textContent = locationName;
            localStorage.setItem('cravebite_location', locationName);
            showToast(`Location set to ${locationName}`);

        } catch (error) {
            console.error('Error fetching location details:', error);
            if (locText) locText.textContent = 'Location Found';
            localStorage.setItem('cravebite_location', 'Location Found');
        }
    }, (error) => {
        console.error('Geolocation error:', error);
        let message = 'Failed to get location.';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied. Please allow location access in your browser settings.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information is unavailable.';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out.';
                break;
            default:
                message = 'An unknown error occurred.';
                break;
        }
        showToast(message);
        if (locText) locText.textContent = 'Set Location';
    });
}

function restoreLocation() {
    const locText = document.getElementById('location-text');
    if (!locText) return;

    const savedLocation = localStorage.getItem('cravebite_location');
    if (savedLocation) {
        locText.textContent = savedLocation;
    }
}

// --- Admin Order Management ---
function renderAdminOrders() {
    const container = document.getElementById('admin-orders-list');
    if (!container) return;

    const orders = JSON.parse(localStorage.getItem('cravebite_orders') || '[]');

    if (orders.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No orders have been placed yet.</p>';
        return;
    }

    let html = '';
    orders.forEach(order => {
        const orderDate = new Date(order.date).toLocaleString();

        // Format items list
        let itemsHtml = '<ul style="margin: 0.5rem 0; padding-left: 1.2rem; color: var(--text-secondary); font-size: 0.9rem;">';
        order.items.forEach(item => {
            itemsHtml += `<li>${item.quantity}x ${item.title} - ₹${(item.price * item.quantity).toFixed(2)}</li>`;
        });
        itemsHtml += '</ul>';

        // Status badge color
        let statusColor = '#f0ad4e'; // Pending
        if (order.status === 'Preparing') statusColor = '#17a2b8';
        if (order.status === 'Out for Delivery') statusColor = '#007bff';
        if (order.status === 'Delivered') statusColor = '#28a745';
        if (order.status === 'Cancelled') statusColor = '#dc3545';

        html += `
            <div class="animate-fade-in" style="background: var(--surface-color); border: 1px solid var(--glass-border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 1rem; margin-bottom: 1rem;">
                    <div>
                        <h3 style="margin: 0; color: var(--primary-color);">Order #${order.id}</h3>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            <i class="fa-regular fa-clock"></i> ${orderDate}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: bold; display: inline-block; margin-bottom: 0.5rem;">
                            ${order.status}
                        </span>
                        <h4 style="margin: 0;">Total: ₹${order.total.toFixed(2)}</h4>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                    <div>
                        <h4 style="margin-bottom: 0.5rem; font-size: 1rem;"><i class="fa-solid fa-user"></i> Customer Details</h4>
                        <p style="margin: 0; font-size: 0.9rem;"><strong>Name:</strong> ${order.user}</p>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem;"><strong>Address:</strong> ${order.address}</p>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem;"><strong>Payment:</strong> ${order.paymentMethod.toUpperCase()}</p>
                    </div>
                    
                    <div>
                        <h4 style="margin-bottom: 0.5rem; font-size: 1rem;"><i class="fa-solid fa-burger"></i> Order Items</h4>
                        ${itemsHtml}
                    </div>
                </div>
                
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(0,0,0,0.1); display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <label style="font-weight: 600;">Update Status:</label>
                    <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding: 0.5rem; border-radius: 8px; border: 1px solid #ccc; background: var(--bg-color); color: var(--text-primary);">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>Preparing...</option>
                        <option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function updateOrderStatus(orderId, newStatus) {
    const orders = JSON.parse(localStorage.getItem('cravebite_orders') || '[]');
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex !== -1) {
        orders[orderIndex].status = newStatus;
        orders[orderIndex].updatedAt = new Date().toISOString();
        orders[orderIndex].statusHistory = orders[orderIndex].statusHistory || [];
        orders[orderIndex].statusHistory.push({ status: newStatus, date: orders[orderIndex].updatedAt });
        localStorage.setItem('cravebite_orders', JSON.stringify(orders));
        showToast(`Order #${orderId} marked as ${newStatus}`);
        renderAdminOrders();
    }
}
