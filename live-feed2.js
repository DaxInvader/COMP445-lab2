const lastVideo = document.getElementById("lastVideo");
const video = document.getElementById('videoFeed');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const videoPlayer = document.getElementById('DASHVideoPlayer');
let player;

let mediaRecorder;
let segmentNumber = 1;
let chunks = [];
let uploadCounter = 0;

document.addEventListener('DOMContentLoaded', () => init());

function init() {
    window.addEventListener('load', async () => {
        const filename = await getLatestVideo();
        updateLatestVideo(filename);
    });

    player = dashjs.MediaPlayer().create();
    player.initialize(videoPlayer, './nodeJS/dash/output.mpd', true);
    
    loadVideoList();
    videoListEl.addEventListener('click', async (event) => {
        if (event.target.tagName === 'BUTTON') {
          const videoId = event.target.dataset.id;
          await loadVideo(videoId);
        }
      });
    startButton.addEventListener('click', start);
    stopButton.addEventListener('click', stop);

    

}

function createStream() {
    return navigator.mediaDevices.getUserMedia({
        video: {
            width: 1280,
            height: 720,
            frameRate: { ideal: 30, max: 30 }
        },
        audio: true
    });
}

function createMediaRecorder(stream) {
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mr.ondataavailable = mediaReceiverOnDataAvailable
    mr.onstop = mediaReceiverOnStop

    return mr;
}

async function start() {
    await clearSegments();

    const stream = await createStream();
    video.srcObject = stream;

    mediaRecorder = await createMediaRecorder(stream);
    mediaRecorder.start();
}

function stop() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        chunks = [];
    }

    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
}


async function mediaReceiverOnDataAvailable(event) {
    const blob = new Blob([event.data], { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('segment', blob, `segment${segmentNumber}.mp4`);

    // Increment the upload counter
    uploadCounter++

    // When a new video segment is ready
    await Promise.all([
        fetch('http://localhost:3000/upload', { method: 'POST', body: formData })
            .then((response) => response.text())
            .then((response) => {
                console.log(`Upload result to NodeJS: ${response}`);
                uploadCounter--;
            })
            .catch((error) => {
                console.error(`Error uploading video segment to NodeJS: ${error}`);
                uploadCounter--;
            }),

        fetch('upload.php', { method: 'POST', body: formData })
            .then((response) => response.text())
            .then((response) => console.log(`Upload result to MYSQL: ${response}`))
            .catch(error => console.error(`Error uploading video segment to MYSQL: ${error}`)),
    ])
        .catch((error) => console.error(error));

    segmentNumber++;
};

function mediaReceiverOnStop() {
    setTimeout(async () => {
        if (uploadCounter === 0) {
            const filename = await concatenate();
            const success = await uploadssh();
            return updateLatestVideo(filename);
        }
    }, 1000);
}

async function updateLatestVideo(filename) {
    console.log('setting latest video', filename);

    lastVideo.innerHTML = `<source src="./output/${filename}" type="video/mp4">`;
    lastVideo.load();
    lastVideo.style.display = "block";
    player.attachSource('./nodeJS/dash/output.mpd');
}

function getLatestVideo() {
    return fetch('http://localhost:3000/getlatestvideo', { method: 'GET' })
        .then((response) => response.text())
        .then((response) => {
            const { filename } = JSON.parse(response)
            return filename
        })
        .catch((error) => console.error('Error downloading latest video segment:', error));
}

function concatenate() {
    return fetch('http://localhost:3000/concatenate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    })
        .then((response) => response.text())
        .then((response) => {
            const { filename } = JSON.parse(response);
            return filename
        })
        .catch((error) => console.error(`Error concatenate: ${error}`));
}

function uploadssh() {
    return fetch('http://localhost:3000/uploadssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    })
        .then((response) => response.text())
        .then((responseText) => {
            return responseText;
        })
        .catch((error) => console.error(`Error uploadssh: ${error}`));
}

function clearSegments() {
    return fetch('http://localhost:3000/clearsegments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    })
        .then((response) => response.text())
        .then((response) => console.log(`Clear segments result: ${response}`))
        .catch((error) => (!response.ok) && console.error(`Error clear segments: HTTP error! status: ${response.status}`));
}

// Client-side code to retrieve video list and download playlist file
async function loadVideoList() {
    const response = await fetch('http://localhost:3000/getvideoslist');
    const videoList = await response.json();
  
    const videoListEl = document.querySelector('#video-list');
    videoList.forEach((video) => {
      const videoEl = document.createElement('div');
      videoEl.innerHTML = `
        <h3>${video.title}</h3>
        <button onclick="loadVideo('${video.id}')">Watch</button>
      `;
      videoListEl.appendChild(videoEl);
    });
  }

  async function loadVideo(videoId) {
    // Download playlist file for selected video
    const response = await fetch(`http://localhost:3000/videos/${videoId}/playlist.mpd`);
    const playlist = await response.text();
  
    // Initialize player with playlist file
    player.attachSource(playlist);
  }