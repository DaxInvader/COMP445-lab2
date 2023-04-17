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

function populateQualitySelector() {
  const qualitySelector = document.getElementById('qualitySelector');
  const bitrates = player.getBitrateInfoListFor('video');

  // Clear the quality selector
  qualitySelector.innerHTML = '';

  bitrates.forEach((bitrate, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.text = `${bitrate.width}x${bitrate.height} - ${(bitrate.bitrate / 1000).toFixed(0)} kbps`;
    qualitySelector.add(option);
  });

  // Set the current selected quality
  qualitySelector.selectedIndex = player.getQualityFor('video');
}

async function playSelectedVideo(timestamp) {
  if (!player) {
    console.error('MediaPlayer not initialized!');
  }

  player.reset();
  player.attachView(videoPlayer);
  player.attachSource(`/output/${timestamp}/output.mpd`);

  // Populate the quality selector with the available video qualities
  setTimeout(populateQualitySelector, 1000);
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
  loadVideoList();
  // TODO: load video list
  // TODO: ecrase ta list first
  // TODO: set latest video (ton dernier timestamp) (playselectedvideo)
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

function onQualityChange() {
  const qualitySelector = document.getElementById('qualitySelector');
  const selectedQualityIndex = qualitySelector.selectedIndex;

  // Temporarily disable ABR auto switching
  player.updateSettings({
    streaming: {
      abr: {
        autoSwitchBitrate: {
          video: false,
        },
      },
    },
  });

  // Set the selected quality
  player.setQualityFor('video', selectedQualityIndex);
}

document.addEventListener('DOMContentLoaded', () => {
  player = window.dashjs.MediaPlayer().create();
  player.initialize(videoPlayer, null, true);

  // Enable ABR algorithm
  player.updateSettings({
    streaming: {
      abr: {
        autoSwitchBitrate: {
          video: true,
        },
      },
    },
  });
  startButton.addEventListener('click', start);
  stopButton.addEventListener('click', stop);
  const qualitySelector = document.getElementById('qualitySelector');
  qualitySelector.addEventListener('change', onQualityChange);

  return loadVideoList();
});
