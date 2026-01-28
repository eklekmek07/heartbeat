// HeartBeat - PWA Scripts

// State
let vapidPublicKey = null;
let pairId = null;
let pairCode = null;
let pushSubscription = null;
let statusPollInterval = null;
let currentScreen = 'main';
let historyOffset = 0;
let historyHasMore = true;
let isLoadingHistory = false;

// DOM Elements
const screenPairing = document.getElementById('screen-pairing');
const screenMain = document.getElementById('screen-main');
const screenHistory = document.getElementById('screen-history');
const screenSettings = document.getElementById('screen-settings');
const bottomNav = document.getElementById('bottom-nav');
const pairingChoice = document.getElementById('pairing-choice');
const pairingCreate = document.getElementById('pairing-create');
const pairingJoin = document.getElementById('pairing-join');
const pairCodeDisplay = document.getElementById('pair-code-display');
const waitingStatus = document.getElementById('waiting-status');
const joinCodeInput = document.getElementById('join-code-input');
const joinError = document.getElementById('join-error');
const connectionStatus = document.getElementById('connection-status');
const statusDot = connectionStatus.querySelector('.status-dot');
const statusText = document.getElementById('status-text');
const tapFeedback = document.getElementById('tap-feedback');
const notificationStatus = document.getElementById('notification-status');
const displayNameInput = document.getElementById('display-name-input');
const backgroundPreview = document.getElementById('background-preview');
const historyList = document.getElementById('history-list');
const historyLoading = document.getElementById('history-loading');
const imageViewer = document.getElementById('image-viewer');
const imageViewerImg = document.getElementById('image-viewer-img');

// API base URL (empty for same origin on Vercel)
const API_BASE = '';

// Initialize app
async function init() {
  console.log('[HeartBeat] init() started');

  // Check for existing pairing
  pairId = localStorage.getItem('heartbeat_pair_id');
  pairCode = localStorage.getItem('heartbeat_pair_code');
  console.log('[HeartBeat] Stored pairing:', { pairId, pairCode });

  // Fetch VAPID public key
  try {
    console.log('[HeartBeat] Fetching VAPID key...');
    const response = await fetch(`${API_BASE}/api/vapid-key`);
    const data = await response.json();
    vapidPublicKey = data.vapidPublicKey;
    console.log('[HeartBeat] VAPID key fetched:', vapidPublicKey ? 'OK' : 'MISSING');
  } catch (err) {
    console.error('[HeartBeat] Failed to fetch VAPID key:', err);
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      console.log('[HeartBeat] Registering service worker...');
      const reg = await navigator.serviceWorker.register('sw.js');
      console.log('[HeartBeat] Service worker registered:', reg.scope);
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    } catch (err) {
      console.error('[HeartBeat] Service worker registration failed:', err);
    }
  } else {
    console.log('[HeartBeat] Service workers not supported');
  }

  // Check notification support
  console.log('[HeartBeat] Notification support:', {
    supported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'N/A',
    pushManager: 'PushManager' in window
  });

  // Show appropriate screen
  if (pairId) {
    console.log('[HeartBeat] Existing pair found, showing main screen');
    showMainScreen();
    // Load preferences after showing main screen
    loadPreferences();
  } else {
    console.log('[HeartBeat] No existing pair, showing pairing screen');
    showPairingScreen();
  }

  console.log('[HeartBeat] init() completed');
}

// Screen Management
function showPairingScreen() {
  screenPairing.classList.remove('hidden');
  screenMain.classList.add('hidden');
  showPairingChoice();
}

function showMainScreen() {
  screenPairing.classList.add('hidden');
  screenMain.classList.remove('hidden');
  screenHistory.classList.add('hidden');
  screenSettings.classList.add('hidden');
  bottomNav.classList.remove('hidden');
  currentScreen = 'main';
  updateNavActiveState();

  // Check notification status
  updateNotificationStatus();

  // Subscribe to push if not already
  subscribeToPush();

  // Start polling for partner status
  checkPairStatus();
  startStatusPolling();
}

// Screen Navigation
function switchScreen(screen) {
  currentScreen = screen;
  screenMain.classList.add('hidden');
  screenHistory.classList.add('hidden');
  screenSettings.classList.add('hidden');

  switch (screen) {
    case 'main':
      screenMain.classList.remove('hidden');
      break;
    case 'history':
      screenHistory.classList.remove('hidden');
      loadHistory(true);
      break;
    case 'settings':
      screenSettings.classList.remove('hidden');
      break;
  }

  updateNavActiveState();
}

function updateNavActiveState() {
  const navItems = bottomNav.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.dataset.screen === currentScreen) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function showPairingChoice() {
  pairingChoice.classList.remove('hidden');
  pairingCreate.classList.add('hidden');
  pairingJoin.classList.add('hidden');
  stopStatusPolling();
}

async function showCreatePair() {
  pairingChoice.classList.add('hidden');
  pairingCreate.classList.remove('hidden');
  pairingJoin.classList.add('hidden');

  pairCodeDisplay.textContent = '------';
  waitingStatus.classList.remove('hidden');

  try {
    const response = await fetch(`${API_BASE}/api/create-pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (data.pairId && data.pairCode) {
      pairId = data.pairId;
      pairCode = data.pairCode;
      localStorage.setItem('heartbeat_pair_id', pairId);
      localStorage.setItem('heartbeat_pair_code', pairCode);

      pairCodeDisplay.textContent = pairCode;

      // Subscribe to push
      await subscribeToPush();

      // Start polling for partner
      startStatusPolling();
    } else {
      pairCodeDisplay.textContent = 'Error';
    }
  } catch (err) {
    console.error('Failed to create pair:', err);
    pairCodeDisplay.textContent = 'Error';
  }
}

function showJoinPair() {
  pairingChoice.classList.add('hidden');
  pairingCreate.classList.add('hidden');
  pairingJoin.classList.remove('hidden');

  joinCodeInput.value = '';
  joinError.classList.add('hidden');
  joinCodeInput.focus();
}

async function joinPair() {
  const code = joinCodeInput.value.trim();

  if (code.length !== 6) {
    showJoinError('Please enter a 6-digit code');
    return;
  }

  joinError.classList.add('hidden');

  try {
    const response = await fetch(`${API_BASE}/api/join-pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairCode: code })
    });

    const data = await response.json();

    if (response.ok && data.pairId) {
      pairId = data.pairId;
      pairCode = data.pairCode;
      localStorage.setItem('heartbeat_pair_id', pairId);
      localStorage.setItem('heartbeat_pair_code', pairCode);

      // Subscribe to push
      await subscribeToPush();

      // Go to main screen
      showMainScreen();
    } else {
      showJoinError(data.error || 'Invalid code');
    }
  } catch (err) {
    console.error('Failed to join pair:', err);
    showJoinError('Connection failed');
  }
}

function showJoinError(message) {
  joinError.textContent = message;
  joinError.classList.remove('hidden');
}

// Push Subscription
async function subscribeToPush() {
  console.log('[HeartBeat] subscribeToPush called', { vapidPublicKey: !!vapidPublicKey, pairId });

  if (!vapidPublicKey || !pairId) {
    console.log('[HeartBeat] subscribeToPush: Missing vapidPublicKey or pairId, aborting');
    return;
  }

  try {
    console.log('[HeartBeat] Requesting notification permission...');
    const permission = await requestNotificationPermission();
    console.log('[HeartBeat] Notification permission:', permission);

    if (permission !== 'granted') {
      console.log('[HeartBeat] Permission not granted, aborting subscription');
      updateNotificationStatus();
      return;
    }

    console.log('[HeartBeat] Waiting for service worker to be ready...');
    const registration = await navigator.serviceWorker.ready;
    console.log('[HeartBeat] Service worker ready', {
      active: registration.active?.state,
      waiting: registration.waiting?.state,
      installing: registration.installing?.state,
      scope: registration.scope,
      controller: navigator.serviceWorker.controller ? 'yes' : 'no'
    });

    // If no controller, the page might need a reload for SW to take control
    if (!navigator.serviceWorker.controller) {
      console.log('[HeartBeat] No controller, page may need reload. Waiting for controllerchange...');
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[HeartBeat] Controller changed!');
          resolve();
        });
        // Also resolve after 2 seconds in case controllerchange doesn't fire
        setTimeout(resolve, 2000);
      });
    }

    try {
      // Check existing subscription first
      console.log('[HeartBeat] Checking for existing subscription...');
      const existingSub = await registration.pushManager.getSubscription();
      console.log('[HeartBeat] Existing subscription:', existingSub ? 'found' : 'none');

      if (existingSub) {
        pushSubscription = existingSub;
        console.log('[HeartBeat] Using existing push subscription');
      } else {
        console.log('[HeartBeat] Creating new push subscription with VAPID key:', vapidPublicKey.substring(0, 20) + '...');

        // Convert VAPID key
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        console.log('[HeartBeat] VAPID key converted, length:', applicationServerKey.length);

        // Subscribe with timeout
        const subscribePromise = registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });

        // Add a 10 second timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Subscribe timeout after 10s')), 10000);
        });

        console.log('[HeartBeat] Calling pushManager.subscribe()...');
        pushSubscription = await Promise.race([subscribePromise, timeoutPromise]);
        console.log('[HeartBeat] New push subscription created');
      }
      console.log('[HeartBeat] Push subscription endpoint:', pushSubscription.endpoint.substring(0, 50) + '...');
    } catch (subscribeError) {
      console.error('[HeartBeat] pushManager.subscribe() failed:', subscribeError.name, subscribeError.message, subscribeError);
      throw subscribeError;
    }

    // Send to server
    console.log('[HeartBeat] Sending subscription to server...');
    const response = await fetch(`${API_BASE}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: pushSubscription.toJSON(),
        pairId: pairId
      })
    });

    const result = await response.json();
    console.log('[HeartBeat] Server response:', response.status, result);

    updateNotificationStatus();
    console.log('[HeartBeat] subscribeToPush completed successfully');
  } catch (err) {
    console.error('[HeartBeat] Failed to subscribe to push:', err);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }

  return Notification.permission;
}

function updateNotificationStatus() {
  if (!('Notification' in window)) {
    notificationStatus.classList.remove('hidden');
    return;
  }

  if (Notification.permission === 'granted') {
    notificationStatus.classList.add('hidden');
  } else {
    notificationStatus.classList.remove('hidden');
  }
}

// Status Polling
function startStatusPolling() {
  stopStatusPolling();
  statusPollInterval = setInterval(checkPairStatus, 5000);
}

function stopStatusPolling() {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
}

async function checkPairStatus() {
  if (!pairId) return;

  try {
    const response = await fetch(`${API_BASE}/api/pair-status?pairId=${pairId}`);
    const data = await response.json();

    if (data.partnerConnected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected to partner';

      // If on pairing screen, move to main screen
      if (!screenMain.classList.contains('hidden') === false) {
        showMainScreen();
      }
    } else if (data.deviceCount === 1) {
      statusDot.className = 'status-dot waiting';
      statusText.textContent = 'Waiting for partner...';
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Not connected';
    }
  } catch (err) {
    console.error('Failed to check pair status:', err);
  }
}

// Send Tap
async function sendTap(emotion) {
  if (!pairId) return;

  const button = document.querySelector(`[data-emotion="${emotion}"]`);
  button.classList.add('sending');

  try {
    const subscription = pushSubscription ? pushSubscription.toJSON() : null;

    const response = await fetch(`${API_BASE}/api/send-tap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairId: pairId,
        emotion: emotion,
        senderEndpoint: subscription?.endpoint || ''
      })
    });

    const data = await response.json();

    if (data.sent > 0) {
      showFeedback('Sent! 💕', 'success');
    } else {
      showFeedback('Partner not connected', 'error');
    }
  } catch (err) {
    console.error('Failed to send tap:', err);
    showFeedback('Failed to send', 'error');
  }

  setTimeout(() => button.classList.remove('sending'), 500);
}

function showFeedback(message, type) {
  tapFeedback.textContent = message;
  tapFeedback.className = `feedback ${type}`;

  setTimeout(() => {
    tapFeedback.classList.add('hidden');
  }, 2000);
}

// Reset Pairing
function resetPairing() {
  if (confirm('Are you sure you want to disconnect?')) {
    localStorage.removeItem('heartbeat_pair_id');
    localStorage.removeItem('heartbeat_pair_code');
    pairId = null;
    pairCode = null;
    pushSubscription = null;
    stopStatusPolling();
    // Reset background
    document.body.classList.remove('has-custom-bg');
    document.body.style.setProperty('--custom-bg', 'none');
    bottomNav.classList.add('hidden');
    showPairingScreen();
  }
}

// Service Worker Message Handler
function handleServiceWorkerMessage(event) {
  if (event.data?.message === 'notification-clicked') {
    // If it's an image notification, open the image viewer
    if (event.data.data?.type === 'image' && event.data.data?.imageUrl) {
      openImageViewer(event.data.data.imageUrl);
    }
  }
}

// Preferences
async function loadPreferences() {
  if (!pairId || !pushSubscription) return;

  try {
    const endpoint = pushSubscription.toJSON().endpoint;
    const response = await fetch(`${API_BASE}/api/preferences?pairId=${pairId}&endpoint=${encodeURIComponent(endpoint)}`);
    const data = await response.json();

    // Set display name
    if (data.displayName) {
      displayNameInput.value = data.displayName;
    }

    // Set background
    if (data.backgroundUrl) {
      applyBackground(data.backgroundUrl);
    }
  } catch (err) {
    console.error('Failed to load preferences:', err);
  }
}

async function saveDisplayName() {
  if (!pairId || !pushSubscription) {
    showFeedback('Not connected', 'error');
    return;
  }

  const displayName = displayNameInput.value.trim();
  if (!displayName) {
    showFeedback('Please enter a name', 'error');
    return;
  }

  try {
    const endpoint = pushSubscription.toJSON().endpoint;
    const response = await fetch(`${API_BASE}/api/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairId: pairId,
        endpoint: endpoint,
        displayName: displayName
      })
    });

    if (response.ok) {
      showFeedback('Name saved!', 'success');
    } else {
      showFeedback('Failed to save', 'error');
    }
  } catch (err) {
    console.error('Failed to save display name:', err);
    showFeedback('Failed to save', 'error');
  }
}

function applyBackground(url) {
  if (url) {
    document.body.style.setProperty('--custom-bg', `url(${url})`);
    document.body.classList.add('has-custom-bg');
    backgroundPreview.innerHTML = `<img src="${url}" alt="Background">`;
  } else {
    document.body.style.setProperty('--custom-bg', 'none');
    document.body.classList.remove('has-custom-bg');
    backgroundPreview.innerHTML = '<span>No background set</span>';
  }
}

async function handleBackgroundSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    showFeedback('Uploading...', 'success');

    // Compress image
    const imageData = await compressImage(file, 1200, 0.8);

    // Upload to server
    const response = await fetch(`${API_BASE}/api/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairId: pairId,
        imageData: imageData,
        type: 'background'
      })
    });

    const data = await response.json();

    if (data.url) {
      // Save background URL to preferences
      const endpoint = pushSubscription?.toJSON().endpoint || '';
      await fetch(`${API_BASE}/api/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairId: pairId,
          endpoint: endpoint,
          backgroundUrl: data.url
        })
      });

      applyBackground(data.url);
      showFeedback('Background saved!', 'success');
    } else {
      showFeedback('Upload failed', 'error');
    }
  } catch (err) {
    console.error('Failed to upload background:', err);
    showFeedback('Upload failed', 'error');
  }

  // Reset input
  event.target.value = '';
}

async function removeBackground() {
  if (!pairId) return;

  try {
    const endpoint = pushSubscription?.toJSON().endpoint || '';
    await fetch(`${API_BASE}/api/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairId: pairId,
        endpoint: endpoint,
        backgroundUrl: ''
      })
    });

    applyBackground(null);
    showFeedback('Background removed', 'success');
  } catch (err) {
    console.error('Failed to remove background:', err);
  }
}

// Photo Sending
function openPhotoPicker() {
  document.getElementById('photo-input').click();
}

async function handlePhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!pairId || !pushSubscription) {
    showFeedback('Not connected', 'error');
    return;
  }

  try {
    showFeedback('Sending photo...', 'success');

    // Compress image
    const imageData = await compressImage(file, 1200, 0.8);

    // Upload to server
    const uploadResponse = await fetch(`${API_BASE}/api/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairId: pairId,
        imageData: imageData,
        type: 'message'
      })
    });

    const uploadData = await uploadResponse.json();

    if (!uploadData.url) {
      showFeedback('Upload failed', 'error');
      return;
    }

    // Send notification to partner
    const endpoint = pushSubscription.toJSON().endpoint;
    const sendResponse = await fetch(`${API_BASE}/api/send-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairId: pairId,
        imageUrl: uploadData.url,
        senderEndpoint: endpoint
      })
    });

    const sendData = await sendResponse.json();

    if (sendData.sent > 0) {
      showFeedback('Photo sent!', 'success');
    } else {
      showFeedback('Partner not connected', 'error');
    }
  } catch (err) {
    console.error('Failed to send photo:', err);
    showFeedback('Failed to send', 'error');
  }

  // Reset input
  event.target.value = '';
}

// Image compression
function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if needed
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// History
async function loadHistory(reset = false) {
  if (isLoadingHistory) return;
  if (!pairId) return;

  if (reset) {
    historyOffset = 0;
    historyHasMore = true;
    historyList.innerHTML = '';
  }

  if (!historyHasMore) return;

  isLoadingHistory = true;
  historyLoading.classList.remove('hidden');

  try {
    const endpoint = pushSubscription?.toJSON().endpoint || '';
    const response = await fetch(
      `${API_BASE}/api/history?pairId=${pairId}&endpoint=${encodeURIComponent(endpoint)}&limit=20&offset=${historyOffset}`
    );
    const data = await response.json();

    if (data.messages && data.messages.length > 0) {
      renderHistoryMessages(data.messages);
      historyOffset += data.messages.length;
      historyHasMore = data.hasMore;
    } else if (historyOffset === 0) {
      historyList.innerHTML = '<div class="history-empty">No messages yet</div>';
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }

  isLoadingHistory = false;
  historyLoading.classList.add('hidden');
}

function renderHistoryMessages(messages) {
  const emotionEmojis = {
    love: '❤️',
    wave: '👋',
    kiss: '😘',
    fire: '🔥'
  };

  for (const msg of messages) {
    const item = document.createElement('div');
    item.className = `history-item ${msg.isMine ? 'mine' : 'theirs'}`;

    let contentHtml = '';
    if (msg.type === 'emotion') {
      contentHtml = `<span class="history-item-emoji">${emotionEmojis[msg.emotion] || '💕'}</span>`;
    } else if (msg.type === 'image' && msg.imageUrl) {
      contentHtml = `<img class="history-item-image" src="${msg.imageUrl}" alt="Photo" onclick="openImageViewer('${msg.imageUrl}')">`;
    }

    const time = new Date(msg.createdAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const sender = msg.isMine ? 'You' : (msg.senderName || 'Partner');

    item.innerHTML = `
      <div class="history-item-content">${contentHtml}</div>
      <div class="history-item-meta">
        <span class="history-item-sender">${sender}</span>
        <span class="history-item-time">${time}</span>
      </div>
    `;

    historyList.appendChild(item);
  }
}

// Image Viewer
function openImageViewer(url) {
  imageViewerImg.src = url;
  imageViewer.classList.remove('hidden');
}

function closeImageViewer() {
  imageViewer.classList.add('hidden');
  imageViewerImg.src = '';
}

// Utility Functions
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Initialize on load
init();
