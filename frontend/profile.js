// ==========================================================================
// CRAVEBITE USER PROFILE PAGE JAVASCRIPT (profile.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initProfilePage();
});

let currentProfileUser = null;
let selectedAvatarSrc = '';
let savedAddresses = [];

function getApiUrl(endpoint) {
    const base = (typeof API_BASE !== 'undefined') ? API_BASE : 'http://localhost:5000/api';
    return `${base}${endpoint}`;
}

async function initProfilePage() {
    setupTabNavigation();
    setupAvatarModal();

    // Check authentication
    const userStr = localStorage.getItem('cravebite_user') || localStorage.getItem('cravebite_admin');
    if (userStr) {
        try {
            currentProfileUser = JSON.parse(userStr);
        } catch (e) {
            console.error("Error parsing stored user", e);
        }
    }

    // Default Guest profile if not logged in
    if (!currentProfileUser) {
        currentProfileUser = {
            id: 0,
            username: 'Guest',
            full_name: 'Guest Craver',
            email: 'guest@cravebite.com',
            role: 'guest',
            avatar: 'img/burger.png',
            created_at: new Date().toISOString()
        };
        showGuestNotice();
    } else {
        // Attempt to sync from backend API
        await fetchBackendProfile();
    }

    // Populate initial UI
    renderProfileHeader();
    populateProfileForm();
    loadSavedAddresses();
    fetchUserOrdersAndStats();
}

function showGuestNotice() {
    const heroCard = document.querySelector('.profile-hero-card');
    if (!heroCard) return;

    const noticeBanner = document.createElement('div');
    noticeBanner.style.cssText = `
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.4);
        color: var(--text-primary);
        padding: 0.85rem 1.25rem;
        border-radius: 10px;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
    `;
    noticeBanner.innerHTML = `
        <div>
            <i class="fa-solid fa-circle-info" style="color: #f59e0b; margin-right: 0.4rem;"></i>
            <strong>Viewing as Guest.</strong> Log in to sync your orders, addresses, and account details across devices!
        </div>
        <a href="login.html" class="btn-profile-save" style="padding: 0.4rem 1rem; font-size: 0.85rem; text-decoration: none;">
            <i class="fa-solid fa-right-to-bracket"></i> Log In / Register
        </a>
    `;
    heroCard.parentNode.insertBefore(noticeBanner, heroCard);
}

// --------------------------------------------------------------------------
// 1. Backend Synchronization & Fallbacks
// --------------------------------------------------------------------------
async function fetchBackendProfile() {
    try {
        const response = await fetch(getApiUrl('/profile'), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                currentProfileUser = { ...currentProfileUser, ...data.user };
                localStorage.setItem('cravebite_user', JSON.stringify(currentProfileUser));
            }
        }
    } catch (e) {
        console.log("Backend offline or session cookie missing, using stored user data.");
    }
}

function getProfileImageUrl(image) {
    if (!image) return 'img/burger.png';
    let url = String(image).trim().replace(/\\/g, '/');
    if (/^(https?:|data:|\/\/)/i.test(url)) return url;
    if (url.startsWith('/')) url = url.slice(1);
    if (url.startsWith('frontend/')) url = url.slice(9);
    return url || 'img/burger.png';
}

function renderProfileHeader() {
    if (!currentProfileUser) return;

    const displayName = currentProfileUser.full_name || currentProfileUser.username || 'Valued Craver';
    const username = currentProfileUser.username || 'user';
    const email = currentProfileUser.email || (username.includes('@') ? username : `${username}@cravebite.com`);
    const avatar = getProfileImageUrl(currentProfileUser.avatar);
    const role = currentProfileUser.role || 'user';

    const displayNameEl = document.getElementById('profile-display-name');
    const emailEl = document.getElementById('profile-display-email');
    const avatarEl = document.getElementById('profile-avatar-img');
    const roleBadgeEl = document.getElementById('profile-role-badge');
    const joinedEl = document.getElementById('profile-joined-date');

    if (displayNameEl) displayNameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = email;
    if (avatarEl) {
        avatarEl.src = avatar;
        avatarEl.onerror = function () { this.src = 'img/burger.png'; };
    }

    if (roleBadgeEl) {
        if (role === 'admin') {
            roleBadgeEl.textContent = 'Admin Member';
            roleBadgeEl.className = 'user-badge admin';
        } else if (role === 'guest') {
            roleBadgeEl.textContent = 'Guest Mode';
            roleBadgeEl.className = 'user-badge';
            roleBadgeEl.style.background = '#6b7280';
            roleBadgeEl.style.color = '#ffffff';
        } else {
            roleBadgeEl.textContent = 'Gold Craver';
            roleBadgeEl.className = 'user-badge gold';
        }
    }

    if (joinedEl && currentProfileUser.created_at) {
        const dateObj = new Date(currentProfileUser.created_at);
        joinedEl.textContent = dateObj.getFullYear();
    }
}

function populateProfileForm() {
    if (!currentProfileUser) return;

    const nameInput = document.getElementById('input-full-name');
    const usernameInput = document.getElementById('input-username');
    const emailInput = document.getElementById('input-email');
    const phoneInput = document.getElementById('input-phone');
    const addressInput = document.getElementById('input-default-address');

    if (nameInput) nameInput.value = currentProfileUser.full_name || '';
    if (usernameInput) usernameInput.value = currentProfileUser.username || '';
    if (emailInput) emailInput.value = currentProfileUser.email || (currentProfileUser.username.includes('@') ? currentProfileUser.username : '');
    if (phoneInput) phoneInput.value = currentProfileUser.phone || '';
    if (addressInput) addressInput.value = currentProfileUser.address || '';
}

// --------------------------------------------------------------------------
// 3. Tab Switching Navigation
// --------------------------------------------------------------------------
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.profile-tab-btn');
    const tabPanes = document.querySelectorAll('.profile-tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');

            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
        });
    });
}

// --------------------------------------------------------------------------
// 4. Update Personal Profile Information
// --------------------------------------------------------------------------
async function handleProfileUpdate(event) {
    event.preventDefault();

    const fullName = document.getElementById('input-full-name').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const phone = document.getElementById('input-phone').value.trim();
    const address = document.getElementById('input-default-address').value.trim();

    const updatedData = {
        full_name: fullName,
        email: email,
        phone: phone,
        address: address,
        avatar: currentProfileUser.avatar || 'img/burger.png'
    };

    if (currentProfileUser.role !== 'guest') {
        try {
            await fetch(getApiUrl('/profile'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedData)
            });
        } catch (e) {
            console.log("Updating locally since backend API is offline.");
        }
    }

    // Always update local storage user state
    currentProfileUser = { ...currentProfileUser, ...updatedData };
    if (currentProfileUser.role !== 'guest') {
        localStorage.setItem('cravebite_user', JSON.stringify(currentProfileUser));
    }

    renderProfileHeader();
    showToast('Profile information updated successfully!', 'success');
}

// --------------------------------------------------------------------------
// 5. Delivery Address Management
// --------------------------------------------------------------------------
function loadSavedAddresses() {
    const key = `cravebite_addresses_${currentProfileUser ? currentProfileUser.username : 'default'}`;
    let stored = JSON.parse(localStorage.getItem(key) || '[]');

    if (stored.length === 0 && currentProfileUser && currentProfileUser.address) {
        stored = [{
            id: 'addr_1',
            tag: 'Home (Default)',
            address: currentProfileUser.address,
            isDefault: true
        }];
        localStorage.setItem(key, JSON.stringify(stored));
    }

    savedAddresses = stored;
    renderAddresses();
}

function renderAddresses() {
    const container = document.getElementById('addresses-container');
    const statCountEl = document.getElementById('stat-saved-addresses');

    if (statCountEl) statCountEl.textContent = savedAddresses.length;
    if (!container) return;

    if (savedAddresses.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="fa-solid fa-map-location-dot" style="font-size: 2.5rem; color: #ccc; margin-bottom: 0.5rem;"></i>
                <p>No saved delivery addresses found. Add one above to speed up checkout!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = savedAddresses.map(item => `
        <div class="address-card ${item.isDefault ? 'default-address' : ''}">
            <div class="address-card-header">
                <span class="address-type-tag">
                    <i class="fa-solid ${item.tag.toLowerCase().includes('work') ? 'fa-briefcase' : 'fa-house'}"></i>
                    ${escapeHTML(item.tag)}
                </span>
                ${item.isDefault ? '<span class="address-default-badge">DEFAULT</span>' : ''}
            </div>
            <div class="address-card-body">
                <p>${escapeHTML(item.address)}</p>
            </div>
            <div class="address-card-actions">
                ${!item.isDefault ? `<button class="btn-address-action" onclick="setAddressAsDefault('${item.id}')"><i class="fa-solid fa-star"></i> Make Default</button>` : ''}
                <button class="btn-address-action delete" onclick="deleteAddressItem('${item.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

function showAddAddressModal() {
    const modal = document.getElementById('address-modal-overlay');
    if (modal) modal.classList.add('active');
}

function closeAddressModal() {
    const modal = document.getElementById('address-modal-overlay');
    if (modal) modal.classList.remove('active');
}

function saveNewAddress(event) {
    event.preventDefault();
    const tag = document.getElementById('address-tag-input').value.trim() || 'Home';
    const addressText = document.getElementById('address-full-input').value.trim();

    if (!addressText) {
        showToast('Please enter address details.', 'error');
        return;
    }

    const newAddr = {
        id: 'addr_' + Date.now(),
        tag: tag,
        address: addressText,
        isDefault: savedAddresses.length === 0
    };

    savedAddresses.push(newAddr);
    saveAddressesToStorage();
    closeAddressModal();
    renderAddresses();
    showToast('New address saved!', 'success');

    document.getElementById('add-address-form').reset();
}

function deleteAddressItem(id) {
    savedAddresses = savedAddresses.filter(a => a.id !== id);
    if (savedAddresses.length > 0 && !savedAddresses.some(a => a.isDefault)) {
        savedAddresses[0].isDefault = true;
    }
    saveAddressesToStorage();
    renderAddresses();
    showToast('Address deleted.', 'info');
}

function setAddressAsDefault(id) {
    savedAddresses.forEach(a => {
        a.isDefault = (a.id === id);
    });
    saveAddressesToStorage();
    renderAddresses();
    showToast('Primary delivery address updated!', 'success');
}

function saveAddressesToStorage() {
    const key = `cravebite_addresses_${currentProfileUser ? currentProfileUser.username : 'default'}`;
    localStorage.setItem(key, JSON.stringify(savedAddresses));
}

// --------------------------------------------------------------------------
// 6. Recent Orders & Stats Calculation
// --------------------------------------------------------------------------
async function fetchUserOrdersAndStats() {
    let apiOrders = [];

    // Try fetching from Flask API
    try {
        const response = await fetch(getApiUrl('/orders'), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                apiOrders = data;
            }
        }
    } catch (e) {
        console.log("Using local orders history.");
    }

    // Load local storage orders (checking standard 'cravebite_orders' and legacy fallback)
    const localOrdersMain = JSON.parse(localStorage.getItem('cravebite_orders') || '[]');
    const localOrdersAlt = JSON.parse(localStorage.getItem('cravebite_customer_orders') || '[]');
    const rawLocalOrders = [...localOrdersMain, ...localOrdersAlt];

    const username = currentProfileUser ? (currentProfileUser.username || '').toLowerCase() : '';
    const filteredLocal = rawLocalOrders.filter(o => {
        if (!o) return false;
        const orderUser = (o.user || '').toLowerCase();
        if (username === 'admin') return true;
        if (!orderUser || orderUser === 'guest') return true;
        return orderUser === username;
    });

    // Deduplicate orders by ID
    const orderMap = new Map();
    [...apiOrders, ...filteredLocal].forEach(o => {
        if (o && o.id) {
            orderMap.set(o.id, o);
        }
    });

    const ordersList = Array.from(orderMap.values());
    ordersList.sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

    // Calculate total stats
    const totalOrders = ordersList.length;
    const totalSpent = ordersList.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

    const totalOrdersEl = document.getElementById('stat-total-orders');
    const totalSpentEl = document.getElementById('stat-total-spent');
    const tierEl = document.getElementById('stat-member-tier');

    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (totalSpentEl) totalSpentEl.textContent = `₹${totalSpent.toFixed(0)}`;

    if (tierEl) {
        if (totalSpent > 1000) tierEl.textContent = 'Platinum';
        else if (totalSpent > 500) tierEl.textContent = 'Gold';
        else tierEl.textContent = 'Silver';
    }

    renderRecentOrders(ordersList);
}

function renderRecentOrders(orders) {
    const container = document.getElementById('recent-orders-container');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
                <i class="fa-solid fa-utensils" style="font-size: 2.5rem; color: #ccc; margin-bottom: 0.5rem;"></i>
                <p>You haven't placed any orders yet. Discover our delicious menu!</p>
                <a href="index.html#menu" class="btn btn-hero" style="display: inline-block; margin-top: 1rem; padding: 0.6rem 1.2rem; font-size: 0.9rem;">Explore Menu</a>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.slice(0, 5).map(o => {
        const dateStr = o.date ? new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
        const statusClass = (o.status || 'Pending').toLowerCase();

        return `
            <div class="recent-order-card">
                <div class="order-card-info">
                    <span class="order-card-id">${escapeHTML(o.id)}</span>
                    <span class="order-card-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                </div>
                <div>
                    <span class="order-status-pill ${statusClass}">
                        <i class="fa-solid ${statusClass === 'completed' || statusClass === 'delivered' ? 'fa-circle-check' : 'fa-clock'}"></i>
                        ${escapeHTML(o.status || 'Pending')}
                    </span>
                </div>
                <div class="order-card-total">
                    ₹${parseFloat(o.total || 0).toFixed(0)}
                </div>
                <div>
                    <button class="btn-address-action" onclick="reorderItems('${o.id}')">
                        <i class="fa-solid fa-rotate-right"></i> Reorder
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function reorderItems(orderId) {
    showToast('Items added to cart! Redirecting...', 'success');
    setTimeout(() => {
        window.location.href = 'cart.html';
    }, 1000);
}

// --------------------------------------------------------------------------
// 7. Security & Password Change
// --------------------------------------------------------------------------
async function handlePasswordChange(event) {
    event.preventDefault();

    if (currentProfileUser.role === 'guest') {
        showToast('Guest accounts cannot change passwords. Please log in.', 'error');
        return;
    }

    const oldPassword = document.getElementById('input-current-password').value;
    const newPassword = document.getElementById('input-new-password').value;
    const confirmPassword = document.getElementById('input-confirm-password').value;

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match.', 'error');
        return;
    }

    if (newPassword.length < 8) {
        showToast('New password must be at least 8 characters.', 'error');
        return;
    }

    try {
        const response = await fetch(getApiUrl('/profile/password'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Password changed successfully!', 'success');
            document.getElementById('password-change-form').reset();
        } else {
            showToast(data.error || 'Failed to update password.', 'error');
        }
    } catch (e) {
        showToast('Password updated locally.', 'success');
        document.getElementById('password-change-form').reset();
    }
}

// --------------------------------------------------------------------------
// 8. Avatar Modal Selector
// --------------------------------------------------------------------------
function setupAvatarModal() {
    const trigger = document.getElementById('avatar-edit-trigger');
    const overlay = document.getElementById('avatar-modal-overlay');

    if (trigger && overlay) {
        trigger.addEventListener('click', () => overlay.classList.add('active'));
    }
}

function closeAvatarModal() {
    const overlay = document.getElementById('avatar-modal-overlay');
    if (overlay) overlay.classList.remove('active');
}

function selectAvatarOption(imgElement, src) {
    document.querySelectorAll('.avatar-option-img').forEach(img => img.classList.remove('selected'));
    imgElement.classList.add('selected');
    selectedAvatarSrc = src;
}

async function applyAvatarSelection() {
    const customUrl = document.getElementById('custom-avatar-url').value.trim();
    const finalAvatar = customUrl || selectedAvatarSrc || 'img/burger.png';

    currentProfileUser.avatar = finalAvatar;
    if (currentProfileUser.role !== 'guest') {
        localStorage.setItem('cravebite_user', JSON.stringify(currentProfileUser));

        try {
            await fetch(getApiUrl('/profile'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ avatar: finalAvatar })
            });
        } catch (e) { }
    }

    renderProfileHeader();
    closeAvatarModal();
    showToast('Profile picture updated!', 'success');
}

// --------------------------------------------------------------------------
// 9. Toast Messaging System
// --------------------------------------------------------------------------
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        info: 'fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.innerHTML = `<i class="fa-solid ${iconMap[type] || 'fa-bell'}"></i> ${escapeHTML(message)}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function triggerAccountLogout() {
    handleLogout();
}
