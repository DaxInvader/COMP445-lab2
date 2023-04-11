const video = document.getElementById('videoFeed');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');

let mediaRecorder;
let segmentNumber = 1;
let chunks = [];
let uploadCounter = 0;

window.addEventListener('load', () => {

    // When a new video segment is ready
    fetch('http://localhost:3000/getlatestvideo', {
        method: 'GET',
    })
        .then((response) => response.text())
        .then((result) => {
            console.log('Download result:', result);
        })
        .catch((error) => {
            console.error('Error downloading latest video segment:', error);
        });
});



startButton.addEventListener('click', () => {
    // Call the /concatenate route here
    fetch('http://localhost:3000/clearsegments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then((result) => {
            console.log('Clear segments result:', result);
        })
        .catch((error) => {
            console.error('Error concat video segment:', error);
        });

    navigator.mediaDevices.getUserMedia({
        video: {
            width: 1280,
            height: 720,
            frameRate: { ideal: 30, max: 30 }
        },
        audio: true
    })
        .then(stream => {
            video.srcObject = stream;
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            mediaRecorder.onstop = () => {
                const waitForUploads = setInterval(() => {
                    if (uploadCounter === 0) {
                        clearInterval(waitForUploads);
                        // Call the /concatenate route here
                        fetch('http://localhost:3000/concatenate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({}),
                        })
                            .then((response) => {
                                if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                return response.text();
                            })
                            .then((result) => {
                                console.log('concat result:', result);
                                compareList();
                                getLatestVideo();
                            })
                            .catch((error) => {
                                console.error('Error concat video segment:', error);
                            });
                    }
                }, 100);

            };
            mediaRecorder.ondataavailable = async (event) => {
                const blob = new Blob([event.data], { type: 'video/mp4' });
                const formData = new FormData();
                formData.append('segment', blob, `segment${segmentNumber}.mp4`);

                // Increment the upload counter
                uploadCounter++

                // When a new video segment is ready
                fetch('http://localhost:3000/upload', {
                    method: 'POST',
                    body: formData
                })
                    .then((response) => response.text())
                    .then((result) => {
                        console.log('Upload result:', result);
                        // Decrement the upload counter
                        uploadCounter--;
                    })
                    .catch((error) => {
                        console.error('Error uploading video segment:', error);
                        // Decrement the upload counter
                        uploadCounter--;
                    });
                //Upload data to mysql
                fetch('upload.php', {
                    method: 'POST',
                    body: formData
                })
                    .then(response => response.text())
                    .then(result => {
                        console.log('Upload result to MYSQL:', result);
                    })
                    .catch(error => {
                        console.error('Error uploading video segment to MYSQL:', error);
                    });
                segmentNumber++;
            };
            mediaRecorder.start(3000);

        })
        .catch(error => {
            console.error('Error accessing camera:', error);
        });

});


stopButton.addEventListener('click', () => {
    if (mediaRecorder) {
        mediaRecorder.stop();
        chunks = [];
    }

    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }

});

//function to fetch the latest video
async function getLatestVideo() {
    try {
        const response = await fetch('http://localhost:3000/getlatestvideo', { method: 'GET' });
        const result = await response.text();
        console.log('Download result:', result);
        if (typeof onNewVideoUploaded === 'function') {
            onNewVideoUploaded();
        }
    } catch (error) {
        console.error('Error downloading latest video segment:', error);
    }
}


//function to fetch the latest video
async function compareList() {

}


