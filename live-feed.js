const video = document.getElementById('videoFeed');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const videoPlayer = document.getElementById('DASHVideoPlayer');
const videoListEl = document.querySelector('#video-list');
let player;

let mediaRecorder;

function clearSegments() {
  return fetch('http://localhost:3000/clearsegments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
    .then((response) => response.text())
    .then((response) => console.log(`Clear segments result: ${response}`))
    .catch((error) => console.error(`Error clear segments: ${error}`));
}

function mediaReceiverOnDataAvailable(event) {
  const blob = new Blob([event.data], { type: 'video/mp4' });
  const formData = new FormData();
  formData.append('segment', blob, 'segment1.mp4');

  // When a new video segment is ready
  return Promise.all([
    fetch('http://localhost:3000/upload', { method: 'POST', body: formData })
      .then((response) => response.text())
      .then((response) => console.log(`Upload result to NodeJS: ${response}`))
      .catch((error) => console.error(`Error uploading video segment to NodeJS: ${error}`)),

    fetch('upload.php', { method: 'POST', body: formData })
      .then((response) => response.text())
      .then((response) => console.log(`Upload result to MYSQL: ${response}`))
      .catch((error) => console.error(`Error uploading video segment to MYSQL: ${error}`)),
  ])
    .catch((error) => console.error(error));
}

async function updateLatestVideo(filename) {
  console.log('setting latest video', filename);
}

function getLatestVideo() {
  return fetch('http://localhost:3000/getlatestvideo', { method: 'GET' })
    .then((response) => response.text())
    .then((response) => {
      const { filename } = JSON.parse(response);
      return filename;
    })
    .catch((error) => console.error('Error downloading latest video segment:', error));
}

async function playSelectedVideo(timestamp) {
  if (!player) {
    console.error('MediaPlayer not initialized!');
  }

  player.reset();
  player.attachView(videoPlayer);
  player.attachSource(`/output/${timestamp}/output.mpd`);
}

// Client-side code to retrieve video list and download playlist file
async function loadVideoList() {
  videoListEl.innerHTML = '';

  const response = await fetch('http://localhost:3000/getvideoslist');
  const { videosList } = await response.json(); // Up

  videosList.forEach((v) => {
    const videoEl = document.createElement('div');

    const titleEl = document.createElement('h3');
    titleEl.innerText = v;

    const buttonEl = document.createElement('button');
    buttonEl.innerText = 'Watch';
    buttonEl.addEventListener('click', () => playSelectedVideo(v));

    videoEl.appendChild(titleEl);
    videoEl.appendChild(buttonEl);

    videoListEl.appendChild(videoEl);
  });
}

function mediaReceiverOnStop() {
  // TODO: load video list
  // TODO: ecrase ta list first
  // TODO: set latest video (ton dernier timestamp) (playselectedvideo)
  setTimeout(
    () => getLatestVideo()
      .then((filename) => updateLatestVideo(filename)),
  );
}

function createStream() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      width: 1280,
      height: 720,
      frameRate: { ideal: 30, max: 30 },
    },
    audio: true,
  });
}

function createMediaRecorder(stream) {
  const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
  mr.ondataavailable = mediaReceiverOnDataAvailable;
  mr.onstop = mediaReceiverOnStop;

  return mr;
}

async function start() {
  await clearSegments();

  const stream = await createStream();
  video.srcObject = stream;

  mediaRecorder = createMediaRecorder(stream);
  mediaRecorder.start();
}

function stop() {
  if (mediaRecorder) {
    mediaRecorder.stop();
  }

  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
    video.srcObject = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('load', async () => {
    const filename = await getLatestVideo();
    updateLatestVideo(filename);
  });

  player = window.dashjs.MediaPlayer().create();
  player.initialize(videoPlayer, null, true);

  startButton.addEventListener('click', start);
  stopButton.addEventListener('click', stop);

  return loadVideoList();
});
