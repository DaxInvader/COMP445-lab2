const lastVideo = document.getElementById("lastVideo");
const video = document.getElementById('videoFeed');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');

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
    mediaRecorder.start(3000);
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
            return updateLatestVideo(filename);
        }
    }, 1000);
}

async function updateLatestVideo(filename) {
    console.log('setting latest video', filename);

    lastVideo.innerHTML = `<source src="./output/${filename}" type="video/mp4">`;
    lastVideo.load();
    lastVideo.style.display = "block";
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