// --- LLM API Configuration ---
const GEMINI_API_KEY = "AIzaSyApFAw9dso0FEFblkjkLIYBhBUXIujWKX4";
const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025';

// --- Local Storage Auth Simulation ---
let users = JSON.parse(localStorage.getItem('users') || '{}');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// --- Application State ---
let user = null;
let isAuthReady = false;
let showModal = false;
let modalMode = 'login'; 
let scannerState = {
    selectedFile: null,
    base64Image: '',
    result: null,
    isLoading: false
};

const appRoot = document.getElementById('app');

// --- Utility Functions ---

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const fetchWithRetry = async (url, options, maxRetries = 5) => {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        const delay = Math.pow(2, i) * 1000;
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}. Details: ${errorText}`);
            }
            return response;
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error(`Fetch failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
};

// --- State Management and Rendering ---

const rerender = () => {
    if (!isAuthReady) {
        appRoot.innerHTML = renderLoading();
    } else if (user && user.isAnonymous === false) {
        appRoot.innerHTML = renderScanner();
        attachScannerListeners();
    } else {
        appRoot.innerHTML = renderHome();
        attachHomeListeners();
    }
    appRoot.insertAdjacentHTML('beforeend', renderModal());
    attachModalListeners();
};

// --- View Rendering Functions ---

const renderLoading = () => `
    <div class="flex-grow flex items-center justify-center bg-gray-50">
        <div class="text-green-600 text-xl font-medium flex items-center p-4 rounded-xl shadow-lg bg-white">
            <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading Authentication...
        </div>
    </div>
`;

const renderHome = () => `
    <div class="flex-grow flex flex-col justify-center items-center p-4 home-bg text-white relative">
        <header class="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
            <img src="static/dmma.png" alt="DMMA Logo" class="absolute top-4 left-2 w-14 h-14 rounded-full shadow-md">
            <h1 class="text-.3xl font-extrabold tracking-wider drop-shadow-md ml-12"><t> DMMA college of Southern Philippines</h1>
            <div class="space-x-4">
                <button id="loginBtn" class="px-6 py-2 bg-white text-green-600 font-semibold rounded-full shadow-lg hover:bg-gray-100 transition duration-300">
                    Log In
                </button>
                <button id="signupHeaderBtn" class="px-6 py-2 bg-green-800 text-white font-semibold rounded-full shadow-lg ring-2 ring-white hover:bg-green-700 transition duration-300 hidden sm:inline-block">
                    Create Account
                </button>
            </div>
        </header>

        <main class="text-center max-w-4xl pt-24 pb-12">
            <h2 class="text-6xl font-black mb-6 leading-tight drop-shadow-xl">
                SCAN TRASH, SAVE EARTH.
            </h2>
            <p class="text-xl md:text-2xl font-light mb-12 opacity-90">
                ScanCycle is your AI-powered recycling partner. Simply upload a picture of any waste—plastic, metal, glass, paper, or food—and we'll instantly identify the material and provide personalized, creative recycling and reuse suggestions.
            </p>

            <div class="space-x-4">
                <button id="signupMainBtn" class="px-10 py-4 text-lg font-bold bg-yellow-400 text-green-900 rounded-xl shadow-xl hover:bg-yellow-300 transform hover:scale-105 transition duration-300">
                    Start Your Cycle Journey
                </button>
            </div>
        </main>

        <footer class="absolute bottom-0 p-4 text-sm opacity-80">
            Committed to a greener future.
        </footer>
    </div>
`;

const renderScanner = () => {
    const userId = user?.uid || 'anonymous';
    const username = user?.email || 'Guest User';
    const resultHtml = scannerState.result ? formatResultHtml(scannerState.result) : `
        <div class="h-full flex items-center justify-center text-center text-gray-500 p-8">
            <p class="text-lg">Results will appear here after scanning. Upload an image to start!</p>
        </div>
    `;
    const imagePreview = scannerState.base64Image ? `
        <img
            src="data:${scannerState.selectedFile.type};base64,${scannerState.base64Image}"
            alt="Trash preview"
            class="max-h-full max-w-full object-contain"
        />
    ` : `<p class="text-gray-500">Image Preview Area</p>`;

    const scanButtonContent = scannerState.isLoading ? `
        <svg class="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Scanning...
    ` : `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        2. Scan Trash
    `;

    return `
        <div class="flex-grow scanner-bg p-4 sm:p-8">
            <header class="flex justify-between items-center pb-4 border-b border-green-200">
                <img src="static/logo.jpg" alt="App Logo" class="absolute top-4 left-4 w-14 h-14 rounded-full shadow-md">
                <h1 class="text-3xl font-extrabold text-green-700 ml-12">ScanCycle 🌿</h1>
                    <div class="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4">
                        <span class="text-xs text-gray-600">Logged in as: <span class="font-semibold">${username}</span></span>
                        <span class="text-xs text-gray-400 truncate max-w-24 sm:max-w-none">ID: ${userId}</span>
                        <button id="logoutBtn" class="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-red-600 transition duration-200">
                            Log Out
                        </button>
                    </div>
                </header>

            <main class="max-w-6xl mx-auto mt-8">
                <div class="text-center mb-10">
                    <h2 class="text-4xl font-bold text-green-800 mb-2">Trash Identification Scanner</h2>
                    <p class="text-xl text-gray-600">Upload an image of your waste and discover its eco-friendly destiny.</p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    <!-- Image Upload/Preview -->
                    <div class="scanner-upload-container bg-gray-50 p-6 rounded-xl shadow-lg border border-green-200">
                        <h3 class="text-2xl font-semibold text-green-700 mb-4">1. Upload Image</h3>
                        <input type="file" id="fileInput" accept="image/*" class="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200" />

                        <div class="mt-6 border-2 border-dashed border-green-300 h-64 flex items-center justify-center bg-white rounded-lg overflow-hidden">
                            ${imagePreview}
                        </div>

                        <button id="scanBtn" ${!scannerState.base64Image || scannerState.isLoading ? 'disabled' : ''} class="w-full mt-6 py-3 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 flex items-center justify-center">
                            ${scanButtonContent}
                        </button>
                    </div>

                    <!-- Results Area -->
                    <div class="scanner-results-container bg-white p-6 rounded-xl shadow-2xl border-4 border-green-600 min-h-[500px] flex flex-col">
                        <h3 class="text-2xl font-semibold text-green-700 mb-4">3. Eco-Friendly Suggestions</h3>
                        <div id="resultsContent" class="flex-grow overflow-y-auto">
                            ${resultHtml}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;
};

const formatResultHtml = (result) => {
    let html = '';
    const lines = result.text.split('\n').map(line => line.trim()).filter(line => line !== '');
    let inSuggestions = false;
    let suggestions = [];

    lines.forEach(line => {
        if (line.startsWith("Material Identified:")) {
            html += `<p class="text-lg font-bold mt-4 mb-4 text-green-800 bg-green-100 p-3 rounded-md">${line}</p>`;
            inSuggestions = false;
        } else if (line.startsWith("Suggestions:")) {
            html += `<h3 class="text-lg font-bold mt-6 mb-3 text-green-700">${line}</h3>`;
            inSuggestions = true;
        } else if (inSuggestions) {
            suggestions.push(line);
        } else {
            html += `<p class="mb-2 text-gray-700">${line}</p>`;
        }
    });

    if (suggestions.length > 0) {
        html += `<ol class="list-decimal list-inside space-y-2 text-gray-700 mt-2">`;
        suggestions.forEach(suggestion => {
            html += `<li class="mb-2">${suggestion}</li>`;
        });
        html += `</ol>`;
    }

    if (result.sources && result.sources.length > 0) {
        html += `
            <div class="mt-6 pt-4 border-t border-gray-200">
                <p class="text-sm font-semibold text-gray-600 mb-2">Sources for Grounded Advice:</p>
                <ul class="space-y-1">
                    ${result.sources.map((source, index) => `
                        <li class="text-xs text-gray-500">
                            <a href="${source.uri}" target="_blank" rel="noopener noreferrer" class="text-green-500 hover:underline">
                                ${source.title || source.uri}
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    return html;
};

const renderModal = () => {
    const isLogin = modalMode === 'login';
    const title = isLogin ? "User Login" : "Create New Account";
    const buttonText = isLogin ? 'Log In' : 'Create Account';

    if (!showModal) return '';

    return `
        <div id="authModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all overflow-hidden">
                <div class="p-6">
                    <h2 class="text-2xl font-bold text-green-700 mb-4 border-b pb-2">${title}</h2>

                    <form id="authForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" id="authEmail" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Password</label>
                            <input type="password" id="authPassword" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500" />
                        </div>

                        <p id="authError" class="text-sm text-red-600 font-medium p-2 bg-red-50 rounded-lg hidden"></p>

                        <button type="submit" id="authSubmitBtn" class="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 transition duration-200 disabled:opacity-50 flex items-center justify-center">
                            ${buttonText}
                        </button>
                    </form>

                    <div class="mt-4 text-center">
                        <button id="switchModeBtn" class="text-sm text-green-600 hover:text-green-800 transition duration-150">
                            ${isLogin ? 'Need an account? Sign Up' : 'Already have an account? Log In'}
                        </button>
                    </div>

                    <div class="mt-6 flex justify-end">
                        <button id="closeModalBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition duration-150">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// --- Authentication Handlers ---

const handleAuthAction = (mode) => {
    modalMode = mode;
    showModal = true;
    rerender();
};

const handleFormSubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorElement = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmitBtn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Processing...`;
    errorElement.classList.add('hidden');

    try {
        if (modalMode === 'signup') {
            if (users[email]) throw new Error('User already exists');
            users[email] = { password, email, uid: Date.now().toString(), createdAt: new Date().toISOString() };
            localStorage.setItem('users', JSON.stringify(users));
            currentUser = { uid: users[email].uid, email, isAnonymous: false };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            user = currentUser;
        } else {
            if (!users[email] || users[email].password !== password) throw new Error('Invalid credentials');
            currentUser = { uid: users[email].uid, email, isAnonymous: false };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            user = currentUser;
        }
        showModal = false;
        rerender();
    } catch (err) {
        console.error("Auth Error:", err);
        const errorMessage = err.message || 'AN UNEXPECTED ERROR OCCURRED.';
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = modalMode === 'login' ? 'Log In' : 'Create Account';
    }
};

const handleLogout = async () => {
    currentUser = null;
    localStorage.setItem('currentUser', JSON.stringify(null));
    user = { isAnonymous: true, uid: 'anonymous', email: 'Guest User' };
    rerender();
};

// --- Scanner Logic ---

const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const b64 = await fileToBase64(file);
        scannerState.selectedFile = file;
        scannerState.base64Image = b64;
        scannerState.result = null;
    } else {
        showTemporaryMessage('Please select a valid image file.', 'bg-red-500');
        scannerState.selectedFile = null;
        scannerState.base64Image = '';
    }
    rerender();
};

const scanTrash = async () => {
    if (!scannerState.base64Image) {
        showTemporaryMessage('Please select an image to scan first.', 'bg-yellow-500');
        return;
    }

    scannerState.isLoading = true;
    scannerState.result = null;
    rerender(); 

    const systemInstruction = "You are an expert waste management and sustainability consultant. Your task is to identify the material in the provided image and generate a response that is helpful, eco-friendly, and highly informative. The response MUST start with 'Material Identified:' followed by the material type, and then a section starting with 'Suggestions:' that provides three actionable, creative, and environmentally sound suggestions for its proper recycling, disposal, or reuse. Use current information from the web to ensure tips are up-to-date.";
    const userQuery = "Analyze this image of trash. First, identify the primary material type. Second, provide three actionable, creative, and environmentally sound suggestions for its proper recycling, disposal, or reuse. Use current information from the web to ensure tips are up-to-date.";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{
            role: "user",
            parts: [
                { text: userQuery },
                {
                    inlineData: {
                        mimeType: scannerState.selectedFile.type,
                        data: scannerState.base64Image
                    }
                }
            ]
        }],
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
    };

    try {
        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const candidate = data.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);
            }
            scannerState.result = { text, sources };
        } else {
            scannerState.result = { text: "Error: Could not process image or generate content. Please try a different image.", sources: [] };
        }
    } catch (error) {
        console.error("Gemini API Call Failed:", error);
        scannerState.result = { text: `An API error occurred: ${error.message}`, sources: [] };
    } finally {
        scannerState.isLoading = false;
        rerender(); 
    }
};

// --- Event Listeners and Attachment ---

const attachHomeListeners = () => {
    document.getElementById('loginBtn')?.addEventListener('click', () => handleAuthAction('login'));
    document.getElementById('signupHeaderBtn')?.addEventListener('click', () => handleAuthAction('signup'));
    document.getElementById('signupMainBtn')?.addEventListener('click', () => handleAuthAction('signup'));
};

const attachScannerListeners = () => {
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('fileInput')?.addEventListener('change', handleFileChange);
    document.getElementById('scanBtn')?.addEventListener('click', scanTrash);
};

const attachModalListeners = () => {
    const modal = document.getElementById('authModal');
    if (modal) {
        document.getElementById('closeModalBtn')?.addEventListener('click', () => { showModal = false; rerender(); });
        document.getElementById('authForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('switchModeBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            modalMode = modalMode === 'login' ? 'signup' : 'login';
            rerender();
        });
    }
};

// --- Custom Message Handling (Replaces alert()) ---
const showTemporaryMessage = (message, bgColor) => {
    let msgEl = document.getElementById('tempMessage');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.id = 'tempMessage';
        msgEl.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-xl text-white z-[60] transition-opacity duration-300 opacity-0';
        document.body.appendChild(msgEl);
    }

    msgEl.className = `fixed top-4 right-4 p-4 rounded-lg shadow-xl text-white z-[60] transition-opacity duration-300 ${bgColor} opacity-100`;
    msgEl.textContent = message;

    setTimeout(() => {
        msgEl.classList.remove('opacity-100');
        msgEl.classList.add('opacity-0');
    }, 3000);
};

// --- Main Initialization ---

// Simulate auth state change
const simulateAuthStateChange = () => {
    user = currentUser || { isAnonymous: true, uid: 'anonymous', email: 'Guest User' };
    isAuthReady = true;
    rerender();
};

simulateAuthStateChange();
