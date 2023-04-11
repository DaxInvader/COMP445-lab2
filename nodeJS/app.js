const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const multer = require('multer');
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

// Array to hold the individual video segment file paths
let segmentFilePaths = [];

// Handle individual video segment uploads
app.post('/upload', upload.single('segment'), (req, res) => {
    const localMP4FilePath = `./segments/${req.file.originalname.replace('.webm', '.mp4')}`;

    // Add the file path of the MP4 segment to the array
    segmentFilePaths.push(localMP4FilePath);
    console.log(segmentFilePaths);

    res.send('ok');
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
            const filename = `${timestamp}_output.mp4`;
            const newFilePath = `../output/${filename}`;

            fs.rename(oldFilePath, newFilePath, (err) => {
                if (err) {
                    console.error('Error renaming output file:', err);
                    res.status(500).json({ success: false, error: err.message });
                    return;
                }
            });

            res.json({ filename });
        });
    } catch (error) {
        console.error('Error during concatenation:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        segmentFilePaths = [];
    }
});


app.get('/getlatestvideo', (req, res) => {
    var files = fs.readdirSync(path.join(__dirname, '../output'));
    files.sort((a, b) => parseInt(b.split('_')[0]) - parseInt(a.split('_')[0]));

    res.json({ filename: files?.[0] })
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
