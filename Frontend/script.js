const API_URL = "http://127.0.0.1:8000";

// Global state
let appState = {
    token: null,
    user: null,
    userRole: null,
    backendStatus: { running: false, authReady: false, geminiReady: false },
    editingBookId: null
};

// ====================== AUTHENTICATION ======================

function saveToken(token) {
    localStorage.setItem("access_token", token);
    appState.token = token;
}

function getToken() {
    return localStorage.getItem("access_token");
}

function clearAuth() {
    localStorage.removeItem("access_token");
    appState.token = null;
    appState.user = null;
    appState.userRole = null;
}

async function login(username, password) {
    try {
        const formData = new FormData();
        formData.append("username", username);
        formData.append("password", password);

        const response = await fetch(`${API_URL}/auth/login/`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Login failed");
        }

        saveToken(data.access_token);
        appState.user = data.user;
        appState.userRole = data.user.role;

        return { success: true, user: data.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function loginAsCustomer() {
    appState.userRole = "customer";
    appState.user = { username: "Guest Customer", role: "customer" };
    return { success: true, user: appState.user };
}

async function logout() {
    clearAuth();
    showLoginPage();
}

// ====================== UI HELPERS ======================

function escapeHtml(str) {
    if (str == null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function createMessage(text, type) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `msg ${type}`;
    msgDiv.innerHTML = text;
    return msgDiv;
}

// Deterministic color for book spines based on title hash
function getSpineColor(title) {
    const colors = [
        '#8b6914', '#2d5a3d', '#1e2d50', '#8b2020', '#6b4c2a',
        '#4a3728', '#2c1f0a', '#3d5a80', '#7a3b2e', '#4a6741',
        '#5c3d2e', '#2e4057', '#6a4c93', '#1a535c', '#8b4513'
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// Availability badge text and class
function getAvailBadge(qty) {
    if (qty <= 0) return { text: 'Out', cls: 'out' };
    if (qty <= 2) return { text: `${qty} left`, cls: 'low' };
    return { text: 'Available', cls: 'available' };
}

// ====================== UI NAVIGATION ======================

function showLoginPage() {
    document.getElementById("loginContainer").style.display = "block";
    document.getElementById("appContainer").style.display = "none";
}

function showAppPage() {
    document.getElementById("loginContainer").style.display = "none";
    document.getElementById("appContainer").style.display = "flex";

    // Show/hide admin-only nav items
    const adminItems = document.querySelectorAll(".admin-only");
    adminItems.forEach(item => {
        item.style.display = appState.userRole === "admin" ? "flex" : "none";
    });

    // Update sidebar footer user info
    const username = appState.user ? appState.user.username : "User";
    const displayName = username.charAt(0).toUpperCase() + username.slice(1);
    document.getElementById("userName").textContent = displayName;
    document.getElementById("userRole").textContent = appState.userRole || "user";
    document.getElementById("userAvatar").textContent = displayName.charAt(0).toUpperCase();

    // Navigate to search by default
    navigateToSection("search-section");

    // Populate category dropdowns if admin
    if (appState.userRole === "admin") {
        populateCategoryDropdowns();
    }
}

function navigateToSection(sectionId) {
    // Hide all sections
    document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
    // Deactivate all nav items
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) section.classList.add("active");

    // Activate nav item
    const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (navItem) navItem.classList.add("active");

    // Auto-load books when navigating to Manage Books section
    if (sectionId === "manage-section") {
        loadManageBooks();
    }

    // Load category chips when navigating to Search section
    if (sectionId === "search-section") {
        loadSearchCategories();
    }

    // Close mobile sidebar
    closeSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
}

function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
}

// ====================== BACKEND STATUS ======================

async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_URL}/status/`);
        const data = await response.json();

        appState.backendStatus = {
            running: data.backend_running,
            authReady: data.auth_ready,
            geminiReady: data.gemini_api_ready
        };

        updateStatusIndicator();
    } catch (error) {
        appState.backendStatus.running = false;
        updateStatusIndicator();
    }
}

function updateStatusIndicator() {
    const statusDiv = document.getElementById("backendStatus");
    if (!statusDiv) return;

    if (!appState.backendStatus.running) {
        statusDiv.innerHTML = '<span class="status-dot"></span> Backend Offline';
        statusDiv.className = "status-pill offline";
    } else if (!appState.backendStatus.geminiReady) {
        statusDiv.innerHTML = '<span class="status-dot"></span> Initializing Gemini…';
        statusDiv.className = "status-pill initializing";
    } else {
        statusDiv.innerHTML = '<span class="status-dot"></span> Backend Ready';
        statusDiv.className = "status-pill ready";
    }
}

// ====================== API CALLS WITH AUTH ======================

function getAuthHeaders() {
    return {
        "Authorization": `Bearer ${appState.token}`
    };
}

async function uploadBook(image, quantity, shelf, bookNumber, category) {
    try {
        if (!appState.backendStatus.geminiReady) {
            throw new Error("Backend Gemini API not ready. Please wait...");
        }

        const formData = new FormData();
        formData.append("image", image);
        formData.append("quantity", quantity);
        formData.append("shelf", shelf);
        formData.append("book_number", bookNumber);
        formData.append("category", category || "");

        const response = await fetch(`${API_URL}/upload-book/`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.error || "Upload failed");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function validateImage(image) {
    try {
        const formData = new FormData();
        formData.append("image", image);

        const response = await fetch(`${API_URL}/validate-image/`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Validation failed");
        }

        return data;
    } catch (error) {
        return {
            is_valid: false,
            quality: "unknown",
            issues: ["Validation service error"],
            message: "❌ Could not validate image: " + error.message
        };
    }
}

async function searchBooks(query, category) {
    try {
        let url = `${API_URL}/search-book/?query=${encodeURIComponent(query)}`;
        if (category) {
            url += `&category=${encodeURIComponent(category)}`;
        }
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Search failed");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function debugAllBooks() {
    try {
        const response = await fetch(`${API_URL}/debug/all-books/`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to fetch books");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function resetDatabase() {
    try {
        const response = await fetch(`${API_URL}/debug/reset-database/`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Reset failed");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function listUsers() {
    try {
        const response = await fetch(`${API_URL}/debug/list-users/`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to fetch users");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ====================== CATEGORY API ======================

async function fetchCategories() {
    try {
        const response = await fetch(`${API_URL}/categories/`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Failed to fetch categories");
        return data.categories || [];
    } catch (error) {
        console.warn("Could not load categories:", error.message);
        return [];
    }
}

async function createCategory(name) {
    try {
        const response = await fetch(`${API_URL}/categories/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({ name: name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Failed to create category");
        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function populateCategoryDropdowns() {
    const categories = await fetchCategories();
    const selects = document.querySelectorAll(".category-select");
    selects.forEach(sel => {
        const currentVal = sel.value;
        // Keep first two options (placeholder + create new)
        while (sel.options.length > 2) sel.remove(2);
        // Insert category options before the last option (create new)
        categories.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat.name;
            opt.textContent = cat.name;
            sel.insertBefore(opt, sel.options[1]); // insert before "Create new"
        });
        // Restore previous value if it still exists
        if (currentVal && currentVal !== "__new__") {
            sel.value = currentVal;
        }
    });
}

function setupCategoryCombo(selectId, wrapId, inputId, btnId) {
    const sel = document.getElementById(selectId);
    const wrap = document.getElementById(wrapId);
    const inp = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!sel || !wrap || !inp || !btn) return;

    sel.addEventListener("change", () => {
        if (sel.value === "__new__") {
            wrap.style.display = "flex";
            inp.focus();
        } else {
            wrap.style.display = "none";
        }
    });

    // Prevent Enter key in category input from submitting the parent form
    inp.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            btn.click();
        }
    });

    btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = inp.value.trim();
        if (name.length < 2) { alert("Category name must be at least 2 characters"); return; }
        const result = await createCategory(name);
        if (result.success) {
            inp.value = "";
            wrap.style.display = "none";
            await populateCategoryDropdowns();
            // Select the newly created category in THIS dropdown
            sel.value = name;
        } else {
            alert(result.error);
        }
    });
}

// ====================== SEARCH CATEGORY CHIPS ======================

async function loadSearchCategories() {
    try {
        const response = await fetch(`${API_URL}/categories-public/`);
        const data = await response.json();
        const categories = data.categories || [];

        const chipsDiv = document.getElementById("categoryChips");
        if (!chipsDiv) return;

        if (categories.length === 0) {
            chipsDiv.style.display = "none";
            return;
        }

        chipsDiv.style.display = "flex";

        // Clear existing chips (rebuild fresh)
        chipsDiv.innerHTML = '<span class="chips-label">Categories:</span><button class="chip active" data-category="">All</button>';

        // Add category chips
        categories.forEach(cat => {
            const chip = document.createElement("button");
            chip.className = "chip";
            chip.dataset.category = cat;
            chip.textContent = cat;
            chipsDiv.appendChild(chip);
        });

        // Add click handlers to all chips
        chipsDiv.querySelectorAll(".chip").forEach(chip => {
            chip.addEventListener("click", () => {
                // Update active state
                chipsDiv.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");

                const selectedCategory = chip.dataset.category;
                const query = document.getElementById("searchQuery").value.trim();

                // If a category is selected with no search query, browse that category
                if (selectedCategory && !query) {
                    browseByCategory(selectedCategory);
                } else if (query) {
                    // Re-run search with the selected category filter
                    performSearch(query, selectedCategory);
                } else {
                    // "All" clicked with no query — clear results
                    document.getElementById("searchResult").innerHTML = "";
                }
            });
        });
    } catch (error) {
        console.warn("Could not load search categories:", error.message);
    }
}

async function browseByCategory(category) {
    const resultDiv = document.getElementById("searchResult");
    resultDiv.innerHTML = "";
    resultDiv.appendChild(createMessage("Loading books\u2026", "loading"));

    try {
        const response = await fetch(`${API_URL}/browse-category/?category=${encodeURIComponent(category)}`);
        const data = await response.json();

        resultDiv.innerHTML = "";

        if (data.count === 0) {
            resultDiv.innerHTML = `
                <div class="state-box">
                    <div class="s-icon">\ud83d\udced</div>
                    <div class="s-title">No books in \u201c${escapeHtml(category)}\u201d</div>
                    <div class="s-msg">This category has no books yet.</div>
                </div>
            `;
        } else {
            const countDiv = document.createElement("div");
            countDiv.className = "result-count";
            countDiv.textContent = `${data.count} book(s) in \u201c${category}\u201d`;
            resultDiv.appendChild(countDiv);

            const gridDiv = document.createElement("div");
            gridDiv.className = "books-grid";
            data.books.forEach((book, idx) => {
                gridDiv.innerHTML += renderBookCard(book, idx);
            });
            resultDiv.appendChild(gridDiv);
        }
    } catch (error) {
        resultDiv.innerHTML = "";
        resultDiv.appendChild(createMessage(`\u274c ${error.message}`, "error"));
    }
}

async function performSearch(query, category) {
    const resultDiv = document.getElementById("searchResult");
    resultDiv.innerHTML = "";
    resultDiv.appendChild(createMessage("\ud83d\udd0d Searching\u2026", "loading"));

    const result = await searchBooks(query, category || "");

    resultDiv.innerHTML = "";

    if (result.success) {
        if (result.data.count === 0) {
            resultDiv.innerHTML = `
                <div class="state-box">
                    <div class="s-icon">\ud83d\udced</div>
                    <div class="s-title">No books found</div>
                    <div class="s-msg">Try a different search term or check for typos.</div>
                </div>
            `;
        } else {
            if (result.data.did_you_mean) {
                const dymDiv = document.createElement("div");
                dymDiv.className = "did-you-mean";
                dymDiv.innerHTML = `\ud83d\udd0e Did you mean: <strong>${escapeHtml(result.data.did_you_mean)}</strong>?`;
                resultDiv.appendChild(dymDiv);
            }

            const countDiv = document.createElement("div");
            countDiv.className = "result-count";
            countDiv.textContent = `Found ${result.data.count} book(s)`;
            resultDiv.appendChild(countDiv);

            const gridDiv = document.createElement("div");
            gridDiv.className = "books-grid";
            result.data.books.forEach((book, idx) => {
                gridDiv.innerHTML += renderBookCard(book, idx);
            });
            resultDiv.appendChild(gridDiv);
        }
    } else {
        resultDiv.appendChild(createMessage(`\u274c ${result.error}`, "error"));
    }
}

// ====================== MANAGE BOOKS LOADER ======================

async function loadManageBooks() {
    const resultDiv = document.getElementById("manageBooksResult");
    const listDiv = document.getElementById("booksList");
    const tableDiv = document.getElementById("booksTable");

    resultDiv.innerHTML = "";
    resultDiv.appendChild(createMessage("\u23f3 Loading books\u2026", "loading"));
    tableDiv.innerHTML = "";

    const result = await getBooksForEdit();

    resultDiv.innerHTML = "";

    if (result.success) {
        if (result.data.books.length === 0) {
            resultDiv.appendChild(createMessage("\ud83d\udced No books in database", "info"));
            listDiv.style.display = "none";
        } else {
            listDiv.style.display = "block";
            const html = `
                <table class="books-table">
                    <thead>
                        <tr>
                            <th>Book #</th>
                            <th>Title</th>
                            <th>Author</th>
                            <th>Category</th>
                            <th>Qty</th>
                            <th>Shelf</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${result.data.books.map(book => `
                            <tr>
                                <td><span class="book-num-pill">${escapeHtml(book.book_number || '\u2014')}</span></td>
                                <td>${escapeHtml(book.title)}</td>
                                <td>${escapeHtml(book.author)}</td>
                                <td><span class="category-pill">${escapeHtml(book.category || '\u2014')}</span></td>
                                <td><span class="qty-pill">${book.quantity}</span></td>
                                <td><span class="shelf-pill">${escapeHtml(book.shelf)}</span></td>
                                <td><button class="edit-btn" data-id="${book.id}">\u270f\ufe0f Edit</button></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
            tableDiv.innerHTML = html;

            // Add event listeners to edit buttons
            tableDiv.querySelectorAll(".edit-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const bookId = btn.getAttribute("data-id");
                    const book = result.data.books.find(b => b.id === parseInt(bookId));
                    if (book) showEditModal(book);
                });
            });
        }
    } else {
        resultDiv.appendChild(createMessage(`\u274c ${result.error}`, "error"));
        listDiv.style.display = "none";
    }
}

async function addBookManually(title, author, quantity, shelf, bookNumber, category) {
    try {
        const response = await fetch(`${API_URL}/add-book-manual/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                title: title,
                author: author,
                quantity: parseInt(quantity),
                shelf: shelf,
                book_number: bookNumber,
                category: category || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to add book");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getBooksForEdit() {
    try {
        const response = await fetch(`${API_URL}/books-for-edit/`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to fetch books");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateBookDetails(bookId, title, author, quantity, shelf, bookNumber, category) {
    try {
        const response = await fetch(`${API_URL}/update-book/`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                book_id: bookId,
                title: title,
                author: author,
                quantity: parseInt(quantity),
                shelf: shelf,
                book_number: bookNumber,
                category: category || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to update book");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function saveExtractedBook(title, author, quantity, shelf, bookNumber, category) {
    try {
        const response = await fetch(`${API_URL}/save-extracted-book/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                title: title,
                author: author,
                quantity: parseInt(quantity),
                shelf: shelf,
                book_number: bookNumber,
                category: category || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to save extracted book");
        }

        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ====================== BOOK CARD RENDERING ======================

function renderBookCard(book, index) {
    const badge = getAvailBadge(book.quantity);
    const spineColor = getSpineColor(book.title || "");
    const delay = index * 0.06;

    return `
        <div class="book-card" style="animation-delay:${delay}s">
            <div class="book-cover-area">
                <div class="book-spine" style="background:${spineColor}">
                    ${escapeHtml((book.title || "").substring(0, 30))}
                </div>
                <span class="avail-badge ${badge.cls}">${badge.text}</span>
            </div>
            <div class="book-card-body">
                <div class="book-card-title">${escapeHtml(book.title)}</div>
                <div class="book-card-author">by ${escapeHtml(book.author)}</div>
                <div class="book-card-tags">
                    ${book.book_number ? `<span class="book-tag">📌 #${escapeHtml(book.book_number)}</span>` : ''}
                    ${book.category ? `<span class="book-tag shelf">🏷️ ${escapeHtml(book.category)}</span>` : ''}
                    <span class="book-tag">📦 Qty: ${book.quantity}</span>
                    <span class="book-tag shelf">📍 ${escapeHtml(book.shelf)}</span>
                </div>
            </div>
        </div>
    `;
}

// ====================== EDIT MODAL ======================

function showEditModal(book) {
    appState.editingBookId = book.id;
    document.getElementById("edit-title").value = book.title || "";
    document.getElementById("edit-author").value = book.author || "";
    document.getElementById("edit-book-number").value = book.book_number || "";
    // Set category dropdown
    const catSel = document.getElementById("edit-category");
    if (book.category) {
        // Make sure the option exists, add it if not
        let found = false;
        for (let i = 0; i < catSel.options.length; i++) {
            if (catSel.options[i].value === book.category) { found = true; break; }
        }
        if (!found) {
            const opt = document.createElement("option");
            opt.value = book.category;
            opt.textContent = book.category;
            catSel.insertBefore(opt, catSel.options[1]);
        }
        catSel.value = book.category;
    } else {
        catSel.value = "";
    }
    document.getElementById("editNewCatWrap").style.display = "none";
    document.getElementById("edit-quantity").value = book.quantity || 1;
    document.getElementById("edit-shelf").value = book.shelf || "";
    document.getElementById("editModalResult").innerHTML = "";
    document.getElementById("editModal").style.display = "flex";
}

function closeEditModal() {
    document.getElementById("editModal").style.display = "none";
    appState.editingBookId = null;
}

// ====================== PREVIEW UPDATE ======================

function updatePreview() {
    const title = document.getElementById("manualTitle").value || "Book Title";
    const author = document.getElementById("manualAuthor").value || "Author";
    const bookNum = document.getElementById("manualBookNumber").value || "—";
    const qty = document.getElementById("manualQuantity").value || "1";
    const shelf = document.getElementById("manualShelf").value || "—";
    const catSel = document.getElementById("manualCategory");
    const cat = (catSel && catSel.value && catSel.value !== "__new__") ? catSel.value : "—";

    document.getElementById("previewTitle").textContent = title;
    document.getElementById("previewAuthor").textContent = `by ${author}`;
    document.getElementById("previewBookNum").textContent = `Book#: ${bookNum}`;
    document.getElementById("previewQty").textContent = `Qty: ${qty}`;
    document.getElementById("previewShelf").textContent = `Shelf: ${shelf}`;
    document.getElementById("previewCategory").textContent = `Cat: ${cat}`;

    // Update spine preview color
    const coverInner = document.getElementById("previewCoverInner");
    if (title !== "Book Title") {
        const color = getSpineColor(title);
        coverInner.innerHTML = `<div class="book-spine" style="background:${color};width:60px;height:90px;font-size:0.6rem">${escapeHtml(title.substring(0, 20))}</div>`;
    }
}

// ====================== MANAGE TABLE FILTER ======================

function filterManageTable(query) {
    const rows = document.querySelectorAll("#booksTable .books-table tbody tr");
    const q = query.toLowerCase();
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? "" : "none";
    });
}

// ====================== EVENT LISTENERS ======================

document.addEventListener("DOMContentLoaded", () => {
    checkBackendStatus();
    setInterval(checkBackendStatus, 5000);

    // ===== CATEGORY COMBOS =====
    setupCategoryCombo("uploadCategory", "uploadNewCatWrap", "uploadNewCatInput", "uploadAddCatBtn");
    setupCategoryCombo("manualCategory", "manualNewCatWrap", "manualNewCatInput", "manualAddCatBtn");
    setupCategoryCombo("edit-category", "editNewCatWrap", "editNewCatInput", "editAddCatBtn");

    // ===== LOGIN ROLE TABS =====
    document.querySelectorAll(".role-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".role-tab").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const role = btn.dataset.role;
            document.getElementById("credentialsSection").style.display = role === "admin" ? "block" : "none";
            document.getElementById("customerLoginSection").style.display = role === "customer" ? "block" : "none";
        });
    });

    // ===== PASSWORD TOGGLE =====
    document.getElementById("passToggleBtn").addEventListener("click", () => {
        const passInput = document.getElementById("password");
        const btn = document.getElementById("passToggleBtn");
        if (passInput.type === "password") {
            passInput.type = "text";
            btn.textContent = "🙈";
        } else {
            passInput.type = "password";
            btn.textContent = "👁";
        }
    });

    // ===== LOGIN FORM =====
    document.getElementById("authForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        const result = await login(username, password);

        if (result.success) {
            showAppPage();
        } else {
            const errorDiv = document.getElementById("loginError");
            errorDiv.textContent = result.error;
            errorDiv.style.display = "block";
        }
    });

    // ===== CUSTOMER BUTTON =====
    document.getElementById("customerBtn").addEventListener("click", async () => {
        const result = await loginAsCustomer();
        if (result.success) {
            showAppPage();
        }
    });

    // ===== LOGOUT =====
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("logoutBtnMobile").addEventListener("click", logout);

    // ===== SIDEBAR NAVIGATION =====
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => {
            const sectionId = btn.dataset.section;
            if (sectionId) navigateToSection(sectionId);
        });
    });

    // ===== MOBILE HAMBURGER =====
    document.getElementById("hamburgerBtn").addEventListener("click", toggleSidebar);
    document.getElementById("sidebarOverlay").addEventListener("click", closeSidebar);



    // ===== CUSTOMER SEARCH =====
    document.getElementById("searchBtn").addEventListener("click", async () => {
        const query = document.getElementById("searchQuery").value;
        if (!query.trim()) {
            const resultDiv = document.getElementById("searchResult");
            resultDiv.innerHTML = "";
            resultDiv.appendChild(createMessage("Please enter a search query", "error"));
            return;
        }

        // Get selected category from chips
        const activeChip = document.querySelector("#categoryChips .chip.active");
        const selectedCategory = activeChip ? activeChip.dataset.category : "";

        performSearch(query, selectedCategory);
    });

    // Search on Enter key
    document.getElementById("searchQuery").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            document.getElementById("searchBtn").click();
        }
    });

    // ===== ADMIN UPLOAD =====
    document.getElementById("uploadForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const resultDiv = document.getElementById("uploadResult");
        resultDiv.innerHTML = "";

        const image = document.getElementById("image").files[0];
        const bookNumber = document.getElementById("bookNumber").value.trim();
        const quantity = document.getElementById("quantity").value;
        const shelf = document.getElementById("shelf").value;
        const uploadCatSel = document.getElementById("uploadCategory");
        const uploadCategory = (uploadCatSel && uploadCatSel.value && uploadCatSel.value !== "__new__") ? uploadCatSel.value : "";

        if (!image) {
            resultDiv.appendChild(createMessage("❌ Please select an image", "error"));
            return;
        }

        if (!bookNumber) {
            resultDiv.appendChild(createMessage("❌ Please enter a book number", "error"));
            return;
        }

        // Step 1: Validate image quality
        resultDiv.appendChild(createMessage("🔍 Validating image quality…", "loading"));

        const validation = await validateImage(image);

        resultDiv.innerHTML = "";

        if (!validation.is_valid) {
            let errorMsg = validation.message || "❌ Image validation failed";
            if (validation.issues && validation.issues.length > 0) {
                errorMsg += "<br><strong>Issues found:</strong><br>" + validation.issues.map(i => "• " + i).join("<br>");
            }
            resultDiv.appendChild(createMessage(errorMsg, "error"));
            return;
        }

        // Warning for low quality
        if (validation.quality === "low" || validation.quality === "medium") {
            const warningMsg = `⚠️ Image quality is ${validation.quality}. Text may be hard to read. Continue?`;
            if (!confirm(warningMsg)) {
                resultDiv.innerHTML = "";
                resultDiv.appendChild(createMessage("❌ Upload cancelled", "error"));
                return;
            }
        }

        // Step 2: Upload and extract
        resultDiv.appendChild(createMessage("⏳ Uploading and extracting…", "loading"));

        const result = await uploadBook(image, quantity, shelf, bookNumber, uploadCategory);

        if (result.success) {
            resultDiv.innerHTML = "";

            // Show extracted data in editable card
            const editCard = document.createElement("div");
            editCard.className = "extraction-card review-card";
            editCard.innerHTML = `
                <div class="extraction-header">
                    <span class="icon">📋</span>
                    <h3>Extracted Data — Please Review & Edit</h3>
                </div>
                <div class="edit-extraction-grid">
                    <div class="field-group">
                        <label for="extract-title">Title</label>
                        <input type="text" id="extract-title" value="${escapeHtml(result.data.title)}">
                    </div>
                    <div class="field-group">
                        <label for="extract-author">Author</label>
                        <input type="text" id="extract-author" value="${escapeHtml(result.data.author)}">
                    </div>
                    <div class="field-group">
                        <label for="extract-book-number">Book Number</label>
                        <input type="text" id="extract-book-number" value="${escapeHtml(bookNumber)}" readonly>
                    </div>
                    <div class="field-group">
                        <label for="extract-category">Category</label>
                        <input type="text" id="extract-category" value="${escapeHtml(uploadCategory)}">
                    </div>
                    <div class="field-group">
                        <label for="extract-quantity">Quantity</label>
                        <input type="number" id="extract-quantity" value="${quantity}" min="1">
                    </div>
                    <div class="field-group">
                        <label for="extract-shelf">Shelf</label>
                        <input type="text" id="extract-shelf" value="${escapeHtml(shelf)}">
                    </div>
                    <div class="edit-extraction-actions">
                        <button class="btn-secondary" id="cancelExtractedBtn">Cancel</button>
                        <button class="btn-primary" id="saveExtractedBtn">💾 Save to Database</button>
                    </div>
                </div>
            `;
            resultDiv.appendChild(editCard);

            // Save button handler
            document.getElementById("saveExtractedBtn").addEventListener("click", async () => {
                const title = document.getElementById("extract-title").value.trim();
                const author = document.getElementById("extract-author").value.trim();
                const bNum = document.getElementById("extract-book-number").value.trim();
                const eCat = document.getElementById("extract-category").value.trim();
                const qty = document.getElementById("extract-quantity").value;
                const sh = document.getElementById("extract-shelf").value.trim();

                if (title.length < 2 || author.length < 2 || qty < 1 || !sh) {
                    resultDiv.innerHTML = "";
                    resultDiv.appendChild(createMessage("❌ Please fill in all fields correctly", "error"));
                    return;
                }

                resultDiv.innerHTML = "";
                resultDiv.appendChild(createMessage("⏳ Saving to database…", "loading"));

                const saveResult = await saveExtractedBook(title, author, parseInt(qty), sh, bNum, eCat);

                resultDiv.innerHTML = "";

                if (saveResult.success) {
                    const successCard = document.createElement("div");
                    successCard.className = "extraction-card success-card";
                    successCard.innerHTML = `
                        <div class="extraction-header">
                            <span class="icon">✅</span>
                            <h3>Book Saved Successfully!</h3>
                        </div>
                        <div class="extraction-details">
                            <div class="extraction-detail">
                                <div class="extraction-detail-label">📖 Title</div>
                                <div class="extraction-detail-value">${escapeHtml(title)}</div>
                            </div>
                            <div class="extraction-detail">
                                <div class="extraction-detail-label">👤 Author</div>
                                <div class="extraction-detail-value">${escapeHtml(author)}</div>
                            </div>
                            <div class="extraction-detail">
                                <div class="extraction-detail-label">📦 Quantity</div>
                                <div class="extraction-detail-value">${qty}</div>
                            </div>
                            <div class="extraction-detail">
                                <div class="extraction-detail-label">📍 Shelf</div>
                                <div class="extraction-detail-value">${escapeHtml(sh)}</div>
                            </div>
                        </div>
                    `;
                    resultDiv.appendChild(successCard);
                    document.getElementById("uploadForm").reset();
                } else {
                    resultDiv.appendChild(createMessage(`❌ ${saveResult.error}`, "error"));
                }
            });

            // Cancel button handler
            document.getElementById("cancelExtractedBtn").addEventListener("click", () => {
                resultDiv.innerHTML = "";
                document.getElementById("uploadForm").reset();
            });
        } else {
            resultDiv.appendChild(createMessage(`❌ ${result.error}`, "error"));
        }
    });

    // Clear upload button
    document.getElementById("clearUploadBtn").addEventListener("click", () => {
        document.getElementById("uploadForm").reset();
        document.getElementById("uploadResult").innerHTML = "";
    });

    // ===== MANUAL BOOK ENTRY =====
    document.getElementById("manualBookForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const resultDiv = document.getElementById("manualBookResult");
        resultDiv.innerHTML = "";

        const title = document.getElementById("manualTitle").value.trim();
        const author = document.getElementById("manualAuthor").value.trim();
        const bookNumber = document.getElementById("manualBookNumber").value.trim();
        const quantity = document.getElementById("manualQuantity").value;
        const shelf = document.getElementById("manualShelf").value.trim();
        const manCatSel = document.getElementById("manualCategory");
        const category = (manCatSel && manCatSel.value && manCatSel.value !== "__new__") ? manCatSel.value : "";

        // Validate inputs
        if (title.length < 2) {
            resultDiv.appendChild(createMessage("❌ Title must be at least 2 characters", "error"));
            return;
        }
        if (author.length < 2) {
            resultDiv.appendChild(createMessage("❌ Author must be at least 2 characters", "error"));
            return;
        }
        if (quantity < 1) {
            resultDiv.appendChild(createMessage("❌ Quantity must be at least 1", "error"));
            return;
        }
        if (!shelf) {
            resultDiv.appendChild(createMessage("❌ Please enter a shelf location", "error"));
            return;
        }
        if (!bookNumber) {
            resultDiv.appendChild(createMessage("❌ Please enter a book number", "error"));
            return;
        }

        resultDiv.appendChild(createMessage("⏳ Adding book…", "loading"));

        const result = await addBookManually(title, author, quantity, shelf, bookNumber, category);

        if (result.success) {
            resultDiv.innerHTML = "";
            const card = document.createElement("div");
            card.className = "extraction-card success-card";
            card.innerHTML = `
                <div class="extraction-header">
                    <span class="icon">✅</span>
                    <h3>Book Added Successfully!</h3>
                </div>
                <div class="extraction-details">
                    <div class="extraction-detail">
                        <div class="extraction-detail-label">📖 Title</div>
                        <div class="extraction-detail-value">${escapeHtml(title)}</div>
                    </div>
                    <div class="extraction-detail">
                        <div class="extraction-detail-label">👤 Author</div>
                        <div class="extraction-detail-value">${escapeHtml(author)}</div>
                    </div>
                    <div class="extraction-detail">
                        <div class="extraction-detail-label">📌 Book #</div>
                        <div class="extraction-detail-value">${escapeHtml(bookNumber)}</div>
                    </div>
                    <div class="extraction-detail">
                        <div class="extraction-detail-label">🏷️ Category</div>
                        <div class="extraction-detail-value">${escapeHtml(category || '—')}</div>
                    </div>
                    <div class="extraction-detail">
                        <div class="extraction-detail-label">📦 Quantity</div>
                        <div class="extraction-detail-value">${quantity}</div>
                    </div>
                    <div class="extraction-detail">
                        <div class="extraction-detail-label">📍 Shelf</div>
                        <div class="extraction-detail-value">${escapeHtml(shelf)}</div>
                    </div>
                </div>
            `;
            resultDiv.appendChild(card);
            document.getElementById("manualBookForm").reset();
            // Reset preview
            document.getElementById("previewTitle").textContent = "Book Title";
            document.getElementById("previewAuthor").textContent = "by Author";
            document.getElementById("previewBookNum").textContent = "Book#: —";
            document.getElementById("previewQty").textContent = "Qty: 1";
            document.getElementById("previewShelf").textContent = "Shelf: —";
            document.getElementById("previewCategory").textContent = "Cat: —";
            document.getElementById("previewCoverInner").innerHTML = '<span style="font-size:1.5rem">📖</span><span>Cover Preview</span>';
        } else {
            resultDiv.appendChild(createMessage(`❌ ${result.error}`, "error"));
        }
    });

    // ===== LIVE PREVIEW for manual add =====
    ["manualTitle", "manualAuthor", "manualBookNumber", "manualQuantity", "manualShelf"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", updatePreview);
    });
    // Category dropdown also updates preview
    const manCatSelPreview = document.getElementById("manualCategory");
    if (manCatSelPreview) manCatSelPreview.addEventListener("change", updatePreview);

    // ===== MANAGE BOOKS =====
    // (loadManageBooks is now a standalone function called from navigateToSection)

    // ===== MANAGE TABLE FILTER =====
    document.getElementById("manageSearchInput").addEventListener("input", (e) => {
        filterManageTable(e.target.value);
    });

    // ===== EDIT MODAL =====
    document.getElementById("modalCloseBtn").addEventListener("click", closeEditModal);
    document.getElementById("modalCancelBtn").addEventListener("click", closeEditModal);

    document.getElementById("modalSaveBtn").addEventListener("click", async () => {
        const title = document.getElementById("edit-title").value.trim();
        const author = document.getElementById("edit-author").value.trim();
        const bookNumber = document.getElementById("edit-book-number").value.trim();
        const editCatSel = document.getElementById("edit-category");
        const editCategory = (editCatSel && editCatSel.value && editCatSel.value !== "__new__") ? editCatSel.value : "";
        const quantity = document.getElementById("edit-quantity").value;
        const shelf = document.getElementById("edit-shelf").value.trim();
        const modalResultDiv = document.getElementById("editModalResult");

        if (title.length < 2 || author.length < 2 || quantity < 1 || !shelf) {
            modalResultDiv.innerHTML = "";
            modalResultDiv.appendChild(createMessage("❌ Please fill in all fields correctly", "error"));
            return;
        }

        modalResultDiv.innerHTML = "";
        modalResultDiv.appendChild(createMessage("⏳ Updating…", "loading"));

        const result = await updateBookDetails(appState.editingBookId, title, author, quantity, shelf, bookNumber, editCategory);

        modalResultDiv.innerHTML = "";

        if (result.success) {
            modalResultDiv.appendChild(createMessage("✅ Book updated successfully!", "success"));
            // Reload the books list after short delay
            setTimeout(() => {
                closeEditModal();
                loadManageBooks();
            }, 1000);
        } else {
            modalResultDiv.appendChild(createMessage(`❌ ${result.error}`, "error"));
        }
    });

    // Close modal on overlay click
    document.getElementById("editModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("editModal")) {
            closeEditModal();
        }
    });

    // ===== ADMIN DEBUG BUTTONS =====
    document.getElementById("debugBtn").addEventListener("click", async () => {
        const resultDiv = document.getElementById("debugResult");
        resultDiv.innerHTML = "";
        resultDiv.appendChild(createMessage("⏳ Loading…", "loading"));

        const result = await debugAllBooks();

        resultDiv.innerHTML = "";

        if (result.success) {
            const html = `
                <h4 style="font-family:'Playfair Display',serif;margin-bottom:0.75rem">📚 ${result.data.total_books} Books in Database</h4>
                <table class="debug-table">
                    <tr>
                        <th>Book #</th>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Category</th>
                        <th>Qty</th>
                        <th>Shelf</th>
                    </tr>
                    ${result.data.books.map(b => `
                        <tr>
                            <td><span class="book-num-pill">${escapeHtml(b.book_number || '—')}</span></td>
                            <td>${escapeHtml(b.title)}</td>
                            <td>${escapeHtml(b.author)}</td>
                            <td><span class="category-pill">${escapeHtml(b.category || '—')}</span></td>
                            <td><span class="qty-pill">${b.quantity}</span></td>
                            <td><span class="shelf-pill">${escapeHtml(b.shelf)}</span></td>
                        </tr>
                    `).join("")}
                </table>
            `;
            resultDiv.innerHTML = html;
        } else {
            resultDiv.appendChild(createMessage(`❌ ${result.error}`, "error"));
        }
    });

    document.getElementById("resetDbBtn").addEventListener("click", async () => {
        if (confirm("⚠️ Are you sure? This will delete ALL books!")) {
            const result = await resetDatabase();

            const resultDiv = document.getElementById("debugResult");
            resultDiv.innerHTML = "";

            if (result.success) {
                resultDiv.appendChild(createMessage("✅ Database reset successfully", "success"));
            } else {
                resultDiv.appendChild(createMessage(`❌ ${result.error}`, "error"));
            }
        }
    });

    document.getElementById("listUsersBtn").addEventListener("click", async () => {
        const resultDiv = document.getElementById("debugResult");
        resultDiv.innerHTML = "";
        resultDiv.appendChild(createMessage("⏳ Loading…", "loading"));

        const result = await listUsers();

        resultDiv.innerHTML = "";

        if (result.success) {
            const html = `
                <h4 style="font-family:'Playfair Display',serif;margin-bottom:0.75rem">👥 ${result.data.total_users} Registered Users</h4>
                <table class="debug-table">
                    <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Created</th>
                    </tr>
                    ${result.data.users.map(u => `
                        <tr>
                            <td>${escapeHtml(u.username)}</td>
                            <td><span class="role-badge ${u.role}">${u.role}</span></td>
                            <td>${new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                    `).join("")}
                </table>
            `;
            resultDiv.innerHTML = html;
        } else {
            resultDiv.appendChild(createMessage(`❌ ${result.error}`, "error"));
        }
    });

    // ===== INITIALIZE =====
    const token = getToken();
    if (token) {
        appState.token = token;
        // Try to get user info from token
        fetch(`${API_URL}/auth/me/`, { headers: { "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                if (data.username) {
                    appState.user = data;
                    appState.userRole = data.role;
                    showAppPage();
                } else {
                    clearAuth();
                    showLoginPage();
                }
            })
            .catch(() => {
                clearAuth();
                showLoginPage();
            });
    } else {
        showLoginPage();
    }
});
