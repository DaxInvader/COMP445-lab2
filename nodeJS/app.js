const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const multer = require('multer');
const SftpClient = require('ssh2-sftp-client');
const app = express();
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

app.use(cors());

// Configure multer for handling file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './segments/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});
const upload = multer({ storage: storage });

const config = {
    host: 'labs445-1.encs.concordia.ca',
    port: 22,
    username: 'team20',
    password: 'password20'
};

// Array to hold the individual video segment file paths
let segmentFilePaths = [];

// Handle individual video segment uploads
app.post('/upload', upload.single('segment'), async (req, res) => {
    const localFilePath = `./segments/${req.file.originalname}`;
    const localMP4FilePath = `./segments/${req.file.originalname.replace('.webm', '.mp4')}`;
    const remoteFilePath = `/home/team20/uploads/${req.file.originalname.replace('.webm', '.mp4')}`;

    // Add the file path of the MP4 segment to the array
    segmentFilePaths.push(localMP4FilePath);
    console.log(segmentFilePaths);
    // Upload the MP4 file via SSH
    const sftp = new SftpClient();

    (async () => {
        try {
            await sftp.connect(config);
            await sftp.fastPut(localFilePath, remoteFilePath);
            console.log('Segment uploaded successfully');
            res.sendStatus(200);
        } catch (error) {
            console.error('Error uploading segment:', error);
            res.status(500).send(`Error uploading segment: ${error.message}`);
        } finally {
            await sftp.end();
        }
    })();
});

app.post('/concatenate', (req, res) => {
    // Concatenate the individual segments using FFmpeg
    try {

        const concatenateCommand = `ffmpeg -y -i "concat:${segmentFilePaths.join('|')}" -c copy output.mp4`;
        console.log("Executing FFmpeg command:", concatenateCommand);
        exec(concatenateCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('Error executing FFmpeg command:', error);
                console.error('FFmpeg stderr:', stderr);
                res.status(500).send(`Error executing FFmpeg command: ${error.message}`);
                return;
            }

            console.log('FFmpeg stdout:', stdout);
            console.log('Video segments concatenated successfully');
            // Clean up the individual segment files
            segmentFilePaths.forEach((filePath) => {
                fs.unlinkSync(filePath);
            });

            const timestamp = Date.now();
            const oldFilePath = './output.mp4';
            const newFilePath = `./${timestamp}_output.mp4`;


            fs.rename(oldFilePath, newFilePath, (err) => {
                if (err) {
                    console.error('Error renaming output file:', err);
                    res.status(500).json({ success: false, error: err.message });
                }
            });

            // Upload the final output file via SFTP
            const remoteFilePath = `/home/team20/uploads/${timestamp}_output.mp4`;
            const sftp = new SftpClient();
            let errorOccurred = false; // Add a boolean flag to track if an error occurred

            (async () => {
                try {
                    await sftp.connect(config);
                    await sftp.fastPut(newFilePath, remoteFilePath); // Use newFilePath instead of a string literal
                    console.log('Final output uploaded successfully');
                } catch (error) {
                    console.error('Error uploading output:', error);
                    res.status(500).send(`Error uploading output: ${error.message}`);
                    errorOccurred = true; // Set the flag to true if an error occurred
                } finally {
                    await sftp.end();
                }

                // Send the success response only if no error occurred
                if (!errorOccurred) {
                    res.json({ success: true, message: 'Concatenation and file renaming completed' });
                }
            })();
        });
        segmentFilePaths = [];
    } catch (error) {
        console.error('Error during concatenation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/getlatestvideo', (req, res) => {
    const sftp = new SftpClient();
    (async () => {

        await sftp.connect(config).then(() => {
            // Get the latest video file from the remote server
            return sftp.list('/home/team20/uploads/');
        })
            .then((list) => {
                // Sort the list of files by modification time to get the latest file
                const latestFile = list.sort((a, b) => b.modifyTime - a.modifyTime)[0];
                const remoteFilePath = `/home/team20/uploads/${latestFile.name}`;
                const localFilePath = `../output.mp4`;

                // Download the file from the remote server and save it locally
                return sftp.fastGet(remoteFilePath, localFilePath);
            })
            .then(() => {
                // File downloaded successfully
                console.log('File downloaded successfully');
                res.sendStatus(200);
            })
            .catch((err) => {
                console.error('Error downloading file:', err);
                res.status(500).send(`Error downloading file: ${err.message}`);
            })
            .finally(() => {
                sftp.end();
            });

    })();
});

app.post('/clearsegments', (req, res) => {
    fs.readdir('./segments', (err, files) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error clearing segments');
        } else {
            for (const file of files) {
                fs.unlink(path.join('./segments', file), (err) => {
                    if (err) {
                        console.error(err);
                    }
                });
            }
            res.status(200).send('Segments cleared successfully');
        }
    });
});

app.listen(3000, () => {
    console.log('Server listening on port 3000');
});
