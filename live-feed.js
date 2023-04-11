const video = document.getElementById('videoFeed');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');

let intervalId;



startButton.addEventListener('click', () => {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
        console.error('WebCodecs API is not supported in your browser.');
    } else {
        console.log('WebCodecs API is supported.');
    }
    
    navigator.mediaDevices.getUserMedia({
        video: {
            width: 1280,
            height: 720,
            frameRate: { ideal: 30, max: 30 }
        }
    })
    .then(stream => {
        video.srcObject = stream;
        startEncoding();
    })
    .catch(error => {
        console.error('Error accessing camera:', error);
    });
});

stopButton.addEventListener('click', () => {
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    clearInterval(intervalId);
});

async function startEncoding() {
    const [videoTrack] = video.srcObject.getVideoTracks();
    const videoSettings = videoTrack.getSettings();

    const encoder = new VideoEncoder({
        output: async (encodedChunk) => {
            //upload ici.
        },
        error: (error) => {
            console.error('VideoEncoder error:', error);
        }
    });

    encoder.configure({
        codec: 'avc1.640028', // H.264 encoding
        width: videoSettings.width,
        height: videoSettings.height,
        bitrate: 5000000, // 5 Mbps
        framerate: videoSettings.frameRate
    });

    const canvas = new OffscreenCanvas(videoSettings.width, videoSettings.height);
    const ctx = canvas.getContext('2d');

    intervalId = setInterval(async () => {
        ctx.drawImage(video, 0, 0);
        const timestamp = performance.now(); 
        const frame = new VideoFrame(canvas, { timestamp }); 
        await encoder.encode(frame, { keyFrame: false });
        frame.close();
    }, 1000 / 30); // 30 fps
}
