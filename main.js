let data; // global data

// Create thumbnail versions of images to reduce file size
function createThumbnail(imageSrc, size = 64, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => {
            reject(new Error('Image load timeout'));
        }, 5000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }

                canvas.width = size;
                canvas.height = size;

                // Draw image scaled down to thumbnail size with smooth scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, size, size);

                // Convert to blob and create URL
                canvas.toBlob((blob) => {
                    if (blob) {
                        const thumbnailUrl = URL.createObjectURL(blob);
                        resolve(thumbnailUrl);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                }, 'image/webp', quality);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Image failed to load'));
        };

        // Enable CORS for external images
        img.crossOrigin = 'anonymous';
        img.src = originalSrc;
    });
}

// Cache for thumbnail URLs with cleanup
const thumbnailCache = new Map();
const MAX_CACHE_SIZE = 50;

function cleanupOldThumbnails() {
    if (thumbnailCache.size > MAX_CACHE_SIZE) {
        const oldestEntries = Array.from(thumbnailCache.entries()).slice(0, thumbnailCache.size - MAX_CACHE_SIZE);
        oldestEntries.forEach(([key, url]) => {
            URL.revokeObjectURL(url);
            thumbnailCache.delete(key);
        });
    }
}

async function getOptimizedImageUrl(originalSrc) {
    if (thumbnailCache.has(originalSrc)) {
        return thumbnailCache.get(originalSrc);
    }

    // Skip optimization for SVG files - they're already optimized and can't be canvased easily
    if (originalSrc.toLowerCase().endsWith('.svg')) {
        thumbnailCache.set(originalSrc, originalSrc);
        return originalSrc;
    }

    try {
        const thumbnailUrl = await createThumbnail(originalSrc, 64, 0.85);
        thumbnailCache.set(originalSrc, thumbnailUrl);
        cleanupOldThumbnails();
        return thumbnailUrl;
    } catch (error) {
        console.warn('Failed to create thumbnail for:', originalSrc, error.message);
        thumbnailCache.set(originalSrc, originalSrc); // Cache the failure to avoid retrying
        return originalSrc; // fallback to original
    }
}

function formatDateEuropean(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function getTurkishWeekday(dateString) {
    const date = new Date(dateString);
    const weekdays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return weekdays[date.getDay()];
}

function getScoreColorClass(resultColor) {
    if (resultColor.includes("green")) return "match-score-win";
    if (resultColor.includes("red")) return "match-score-loss";
    if (resultColor.includes("slate")) return "match-score-draw";
    return "match-score-pending";
}

function getPredictionClasses(isCompleted, prediction, isCorrect) {
    let classes = "prediction-badge";
    if (isCompleted && prediction) {
        classes += isCorrect ? " prediction-badge-correct" : " prediction-badge-incorrect";
    }
    return classes;
}

function getPredictionValueClass(isCompleted, prediction, isCorrect) {
    if (!isCompleted || !prediction) return "prediction-value-pending";
    return isCorrect ? "prediction-value-correct" : "prediction-value-incorrect";
}

document.addEventListener("DOMContentLoaded", function() {
    loadData();
    initializeTheme();
});

async function loadData() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        data = await res.json(); // Store globally

        displayLeaderboard(data.matches, data.guesses);

        // display all matches in merged view with optimized images
        await displayAllMatches();

        // fixed loading time
        setTimeout(hideLoadingOverlay, 500);
    } catch (error) {
        console.error("Error loading data:", error);
        setTimeout(hideLoadingOverlay, 500);
    }
}

function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById("loading-overlay");
    if (loadingOverlay) {
        loadingOverlay.classList.add("hidden");
        // remove from DOM after animation completes
        setTimeout(() => {
            if (loadingOverlay.parentNode) {
                loadingOverlay.parentNode.removeChild(loadingOverlay);
            }
        }, 300);
    }
}




function isPredictionCorrect(prediction, result, isHome) {
    if (!prediction || !result) return false;

    // extract scores
    const resultMatch = result.match(/(\d+)-(\d+)/);
    if (!resultMatch) return false;

    const homeScore = parseInt(resultMatch[1]); // home team score
    const awayScore = parseInt(resultMatch[2]); // away team score

    // determine team score and opponent score based on home/away
    const teamScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;

    // actual outcome
    let actualOutcome;
    if (teamScore > opponentScore) {
        actualOutcome = 'W'; // win
    } else if (teamScore < opponentScore) {
        actualOutcome = 'L'; // loss
    } else {
        actualOutcome = 'D'; // draw
    }

    // compare with prediction
    return prediction === actualOutcome;
}

function displayLeaderboard(matches, guesses) {
    const stats = calculateStats(matches, guesses);

    // sort by points (points descending, name ascending)
    const sortedByPoints = [...stats].sort((a, b) => {
        if (b.points !== a.points) {
            return b.points - a.points;
        }
        return a.name.localeCompare(b.name);
    });

    displayPointsLeaderboard(sortedByPoints);
}

function calculateStats(matches, guesses) {
    return guesses.map(person => {
        let correct = 0;
        let total = 0;

        matches.forEach(match => {
            if (match.result && match.result !== "null") {
                const prediction = person.predictions[match.id];
                if (prediction) {
                    total++;
                    if (isPredictionCorrect(prediction, match.result, match.home)) {
                        correct++;
                    }
                }
            }
        });

        return {
            name: person.name,
            points: correct * 3,
            correct: correct,
            total: total,
            accuracy: total > 0 ? ((correct / total) * 100) : 0
        };
    });
}

function displayPointsLeaderboard(sortedStats) {
    const topContainer = document.getElementById("top-players");
    const restContainer = document.getElementById("remaining-players");

    topContainer.innerHTML = '';
    restContainer.innerHTML = '';

    sortedStats.forEach((player, index) => {
        const position = index + 1;
        let positionEmoji = "";

        if (position === 1) {
            positionEmoji = "🥇";
        } else if (position === 2) {
            positionEmoji = "🥈";
        } else if (position === 3) {
            positionEmoji = "🥉";
        } else if (position === 4) {
            positionEmoji = "🫃";
        } else if (position === 5) {
            positionEmoji = "🫏";
        } else {
            positionEmoji = "♿";
        }

        const playerDiv = document.createElement("div");
        let cardClasses = "player-card";
        if (position === 1) cardClasses += " player-card-winner";
        playerDiv.className = cardClasses;

        playerDiv.innerHTML = `
            <div class="player-info">
                <span class="player-emoji">${positionEmoji}</span>
                <div>
                    <div class="player-name">${player.name}</div>
                    <div class="player-position">#${position}</div>
                </div>
            </div>
            <div class="player-stats">
                <div>
                    <div class="player-points">${player.points}</div>
                    <div class="player-points-label">puan</div>
                </div>
                <div>
                    <div class="player-accuracy ${player.accuracy >= 50 ? 'player-accuracy-good' : 'player-accuracy-poor'}">
                        ${player.accuracy.toFixed(1)}%
                    </div>
                    <div class="player-accuracy-details">${player.correct}/${player.total} doğru</div>
                </div>
            </div>
        `;

        // show top 1 player
        if (index === 0) {
            topContainer.appendChild(playerDiv);
        } else {
            restContainer.appendChild(playerDiv);
        }
    });
}


function toggleLeaderboard() {
    const restBoard = document.getElementById("remaining-players");
    const button = document.getElementById("show-more-players-btn");

    if (restBoard.classList.contains("hidden")) {
        restBoard.classList.remove("hidden");
        button.textContent = "futbol cahillerini     gizle";
    } else {
        restBoard.classList.add("hidden");
        button.textContent = "diğerleri";
    }
}


async function displayAllMatches() {
    const container = document.getElementById("all-matches");
    container.innerHTML = "";

    // get all matches
    const allMatches = [...data.matches].sort((a, b) => {
        const dateA = new Date(a.date + ' ' + (a.time || '00:00'));
        const dateB = new Date(b.date + ' ' + (b.time || '00:00'));
        return dateA - dateB;
    });

    // group by date
    const matchesByDate = {};
    allMatches.forEach(match => {
        if (!matchesByDate[match.date]) {
            matchesByDate[match.date] = { galatasaray: [], fenerbahce: [] };
        }
        if (match.team === "Galatasaray") {
            matchesByDate[match.date].galatasaray.push(match);
        } else {
            matchesByDate[match.date].fenerbahce.push(match);
        }
    });

    const sortedDates = Object.keys(matchesByDate).sort((a, b) => a.localeCompare(b));

    // First pass: Render matches immediately with original images for instant UI
    const fragment = document.createDocumentFragment();
    const matchElements = [];

    for (const date of sortedDates) {
        const dayMatches = matchesByDate[date];
        const maxMatches = Math.max(dayMatches.galatasaray.length, dayMatches.fenerbahce.length);

        for (let i = 0; i < maxMatches; i++) {
            if (dayMatches.galatasaray[i]) {
                const matchEl = await renderMatchCardInstant(dayMatches.galatasaray[i], fragment);
                matchElements.push({ match: dayMatches.galatasaray[i], element: matchEl });
            }
            if (dayMatches.fenerbahce[i]) {
                const matchEl = await renderMatchCardInstant(dayMatches.fenerbahce[i], fragment);
                matchElements.push({ match: dayMatches.fenerbahce[i], element: matchEl });
            }
        }
    }

    container.appendChild(fragment);

    // Second pass: Progressively optimize images in background
    optimizeImagesProgressively(matchElements);
}

function getResultColor(match) {
    if (match.result === null || match.result === "null") {
        return "match-score-pending";
    }
    
    const scores = match.result.split('-');
    const homeScore = parseInt(scores[0]);
    const awayScore = parseInt(scores[1]);

    if (homeScore === awayScore) {
        return "text-slate-400";
    }
    
    const teamWon = match.home ? homeScore > awayScore : awayScore > homeScore;
    return teamWon ? "text-green-800" : "text-red-800";
}

function getCardClasses(isCompleted, resultColor) {
    let cardClasses = "match-card";
    if (isCompleted) {
        if (resultColor.includes("green")) cardClasses += " match-card-completed-win";
        else if (resultColor.includes("red")) cardClasses += " match-card-completed-loss";
        else if (resultColor.includes("slate")) cardClasses += " match-card-completed-draw";
    }
    return cardClasses;
}

// Instant header generation - uses original images for immediate display
function generateMatchHeaderInstant(match, leftTeam, rightTeam, resultColor) {
    const isCompleted = match.result !== null;

    return `
        <div class="match-header">
            <div class="team-info team-info-left">
                <div class="team-logo-container">
                    <img src="${leftTeam.logo}" alt="${leftTeam.name}" class="team-logo" loading="lazy" width="32" height="32" decoding="async">
                </div>
                <div class="team-name-container">
                    <span class="team-name">${leftTeam.name}</span>
                </div>
            </div>
            <div class="match-score-container">
                <div class="match-score ${getScoreColorClass(resultColor)}">
                    ${isCompleted ? `${match.result}` : "vs"}
                </div>
                <div class="match-date">
                    ${formatDateEuropean(match.date)}
                </div>
                <div class="match-time">
                    ${getTurkishWeekday(match.date)} ${match.time || "TBD"}
                </div>
            </div>
            <div class="team-info team-info-right">
                <div class="team-logo-container">
                    <img src="${rightTeam.logo}" alt="${rightTeam.name}" class="team-logo" loading="lazy" width="32" height="32" decoding="async">
                </div>
                <div class="team-name-container">
                    <span class="team-name">${rightTeam.name}</span>
                </div>
            </div>
        </div>
    `;
}

async function generateMatchHeader(match, leftTeam, rightTeam, resultColor) {
    const isCompleted = match.result !== null;

    // Get optimized image URLs
    const leftTeamLogo = await getOptimizedImageUrl(leftTeam.logo);
    const rightTeamLogo = await getOptimizedImageUrl(rightTeam.logo);

    return `
        <div class="match-header">
            <div class="team-info team-info-left">
                <div class="team-logo-container">
                    <img src="${leftTeamLogo}" alt="${leftTeam.name}" class="team-logo" loading="lazy" width="32" height="32" decoding="async">
                </div>
                <div class="team-name-container">
                    <span class="team-name">${leftTeam.name}</span>
                </div>
            </div>
            <div class="match-score-container">
                <div class="match-score ${getScoreColorClass(resultColor)}">
                    ${isCompleted ? `${match.result}` : "vs"}
                </div>
                <div class="match-date">
                    ${formatDateEuropean(match.date)}
                </div>
                <div class="match-time">
                    ${getTurkishWeekday(match.date)} ${match.time || "TBD"}
                </div>
            </div>
            <div class="team-info team-info-right">
                <div class="team-logo-container">
                    <img src="${rightTeamLogo}" alt="${rightTeam.name}" class="team-logo" loading="lazy" width="32" height="32" decoding="async">
                </div>
                <div class="team-name-container">
                    <span class="team-name">${rightTeam.name}</span>
                </div>
            </div>
        </div>
    `;
}

function generatePredictions(match) {
    const isCompleted = match.result !== null;
    let html = `<div class="predictions-grid">`;
    
    data.guesses.forEach(person => {
        const prediction = person.predictions[match.id];
        const isCorrect = isCompleted && prediction ? isPredictionCorrect(prediction, match.result, match.home) : false;

        const badgeClasses = getPredictionClasses(isCompleted, prediction, isCorrect);
        const valueClasses = getPredictionValueClass(isCompleted, prediction, isCorrect);

        html += `<div class="${badgeClasses}">
                    <div class="prediction-name">${person.name}</div>
                    <div class="prediction-value ${valueClasses}">${prediction || "-"}</div>
                </div>`;
    });
    
    html += `</div>`;
    return html;
}

// Instant render with original images - no optimization delay
function renderMatchCardInstant(match, container) {
    const teamInfo = data.teams[match.team];
    const opponentInfo = data.teams[match.opponent];
    const isCompleted = match.result !== null;

    const resultColor = getResultColor(match);
    const homeTeam = { name: match.team, logo: teamInfo.logo };
    const awayTeam = { name: match.opponent, logo: opponentInfo.logo };
    const leftTeam = match.home ? homeTeam : awayTeam;
    const rightTeam = match.home ? awayTeam : homeTeam;

    const matchDiv = document.createElement("div");
    matchDiv.className = getCardClasses(isCompleted, resultColor);

    const matchHeader = generateMatchHeaderInstant(match, leftTeam, rightTeam, resultColor);
    const predictions = generatePredictions(match);

    matchDiv.innerHTML = matchHeader + predictions;

    if (container.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        container.appendChild(matchDiv);
    } else {
        container.appendChild(matchDiv);
    }

    return matchDiv;
}

// Progressive image optimization in background
async function optimizeImagesProgressively(matchElements) {
    for (const { match, element } of matchElements) {
        try {
            // Use requestIdleCallback to optimize during idle time
            if (window.requestIdleCallback) {
                requestIdleCallback(() => optimizeMatchImages(match, element));
            } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(() => optimizeMatchImages(match, element), 0);
            }
        } catch (error) {
            console.warn('Failed to optimize images for match:', match.id, error);
        }
    }
}

async function optimizeMatchImages(match, element) {
    try {
        const teamInfo = data.teams[match.team];
        const opponentInfo = data.teams[match.opponent];
        const homeTeam = { name: match.team, logo: teamInfo.logo };
        const awayTeam = { name: match.opponent, logo: opponentInfo.logo };
        const leftTeam = match.home ? homeTeam : awayTeam;
        const rightTeam = match.home ? awayTeam : homeTeam;

        // Get optimized images
        const leftOptimized = await getOptimizedImageUrl(leftTeam.logo);
        const rightOptimized = await getOptimizedImageUrl(rightTeam.logo);

        // Update images in place
        const leftImg = element.querySelector('.team-info-left img');
        const rightImg = element.querySelector('.team-info-right img');

        if (leftImg && leftOptimized !== leftTeam.logo) {
            leftImg.src = leftOptimized;
        }
        if (rightImg && rightOptimized !== rightTeam.logo) {
            rightImg.src = rightOptimized;
        }
    } catch (error) {
        console.warn('Failed to optimize match images:', error);
    }
}

async function renderMatchCard(match, container) {
    const teamInfo = data.teams[match.team];
    const opponentInfo = data.teams[match.opponent];
    const isCompleted = match.result !== null;

    const resultColor = getResultColor(match);
    const homeTeam = { name: match.team, logo: teamInfo.logo };
    const awayTeam = { name: match.opponent, logo: opponentInfo.logo };
    const leftTeam = match.home ? homeTeam : awayTeam;
    const rightTeam = match.home ? awayTeam : homeTeam;

    const matchDiv = document.createElement("div");
    matchDiv.className = getCardClasses(isCompleted, resultColor);

    const matchHeader = await generateMatchHeader(match, leftTeam, rightTeam, resultColor);
    const predictions = generatePredictions(match);

    matchDiv.innerHTML = matchHeader + predictions;

    if (container.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        container.appendChild(matchDiv);
    } else {
        container.appendChild(matchDiv);
    }
}

// Theme functionality
function initializeTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';

    // Apply saved theme
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Add click event listener
    themeToggle.addEventListener('click', toggleTheme);

    // Add keyboard support
    themeToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTheme();
        }
    });

    // Add global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Shift + D for dark mode toggle
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggleTheme();
        }
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    // Announce theme change to screen readers
    const announcement = `Theme switched to ${newTheme} mode`;
    announceToScreenReader(announcement);
}

function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    announcement.textContent = message;

    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

