let data; // global data


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

document.addEventListener("DOMContentLoaded", loadData);

async function loadData() {
    try {
        const res = await fetch("data.json");
        data = await res.json(); // Store globally

        displayLeaderboard(data.matches, data.guesses);

        // display all matches in merged view
        displayAllMatches();
        
        // fixed 1 second loading time
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

    const teamScore = parseInt(resultMatch[1]); // team score
    const opponentScore = parseInt(resultMatch[2]); // opponent score

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
            positionEmoji = "🫏";
        } else if (position === 5) {
            positionEmoji = "🫃";
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
        button.textContent = "özürlüleri gizle";
    } else {
        restBoard.classList.add("hidden");
        button.textContent = "diğerleri";
    }
}


function displayAllMatches() {
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

    // create display
    const sortedDates = Object.keys(matchesByDate).sort((a, b) => a.localeCompare(b));
    sortedDates.forEach(date => {
        const dayMatches = matchesByDate[date];
        const maxMatches = Math.max(dayMatches.galatasaray.length, dayMatches.fenerbahce.length);

        for (let i = 0; i < maxMatches; i++) {
            if (dayMatches.galatasaray[i]) {
                renderMatchCard(dayMatches.galatasaray[i], container);
            }
            if (dayMatches.fenerbahce[i]) {
                renderMatchCard(dayMatches.fenerbahce[i], container);
            }
        }
    });
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

function generateMatchHeader(match, leftTeam, rightTeam, resultColor) {
    const isCompleted = match.result !== null;
    return `
        <div class="match-header">
            <div class="team-info team-info-left">
                <div class="team-logo-container">
                    <img src="${leftTeam.logo}" alt="${leftTeam.name}" class="team-logo">
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
                    <img src="${rightTeam.logo}" alt="${rightTeam.name}" class="team-logo">
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

function renderMatchCard(match, container) {
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

    const matchHeader = generateMatchHeader(match, leftTeam, rightTeam, resultColor);
    const predictions = generatePredictions(match);
    
    matchDiv.innerHTML = matchHeader + predictions;
    container.appendChild(matchDiv);
}

