const audioPlayer = new Audio();
const startTimestamp = 1737572155; // Replace this with your actual global Unix timestamp
const currentSongDisplay = document.getElementById('current-song');
const timeDisplay = document.getElementById('time');
const folderPath = 'media'; // Path to the folder containing music files
let songs = [];
let durations = [];
let currentIndex = 0;

// Format time helper function
function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

// Fetch list of songs from the folder dynamically
async function fetchSongs() {
    try {
        const response = await fetch(`${folderPath}/`);
        if (!response.ok) {
            throw new Error('Failed to fetch song list');
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = Array.from(doc.querySelectorAll('a[href]'))
            .map(link => decodeURIComponent(link.getAttribute('href')))
            .filter(href => href.endsWith('.mp3'))
            .map(href => href.replace(`${folderPath}/`, '')); // Remove the folder path
        return links;
    } catch (error) {
        console.error('Error fetching songs:', error);
        return [];
    }
}

// Get the duration of each song
async function getSongDurations(songList) {
    const promises = songList.map(song => {
        return new Promise(resolve => {
            const tempAudio = new Audio(`${folderPath}/${encodeURIComponent(song)}`);
            tempAudio.addEventListener('loadedmetadata', () => {
                resolve(tempAudio.duration);
            });
            tempAudio.addEventListener('error', () => {
                resolve(0); // Handle errors gracefully
            });
        });
    });
    return Promise.all(promises);
}

// Calculate the current song and playback position
function calculateCurrentSongAndPosition(elapsedTime) {
    let cumulativeDuration = 0;
    for (let i = 0; i < durations.length; i++) {
        const duration = durations[i];
        if (cumulativeDuration + duration > elapsedTime) {
            return { index: i, position: elapsedTime - cumulativeDuration };
        }
        cumulativeDuration += duration;
    }
    // If elapsed time exceeds total duration, loop back
    return { index: 0, position: 0 };
}

// Play the specified song and position
function playSong(index, startPosition = 0) {
    const song = songs[index];
    audioPlayer.src = `${folderPath}/${encodeURIComponent(song)}`;
    audioPlayer.currentTime = startPosition;
    audioPlayer.play();

    const formattedSongName = song.replace(/\.[^/.]+$/, '');
    currentSongDisplay.textContent = `Now Playing: ${formattedSongName}`;
    document.title = `Now Playing: ${formattedSongName}`;

    // Update progress periodically
    audioPlayer.ontimeupdate = () => {
        const { currentTime, duration } = audioPlayer;
        timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration || 0)}`;
    };

    // Handle song end
    audioPlayer.onended = () => {
        currentIndex = (currentIndex + 1) % songs.length;
        playSong(currentIndex, 0);
    };
}

// Sync playback based on the global timestamp
function syncPlayback() {
    const currentTime = Math.floor(Date.now() / 1000);
    const elapsedTime = currentTime - startTimestamp;

    if (elapsedTime >= 0) {
        const { index, position } = calculateCurrentSongAndPosition(elapsedTime);
        currentIndex = index;
        playSong(currentIndex, position);
    } else {
        currentSongDisplay.textContent = 'Waiting for sync...';
        setTimeout(syncPlayback, -elapsedTime * 1000);
    }
}

// Initialize the player
async function initializePlayer() {
    songs = await fetchSongs();
    if (songs.length === 0) {
        currentSongDisplay.textContent = 'No songs available';
        return;
    }
    durations = await getSongDurations(songs);
    syncPlayback();
}

initializePlayer();
