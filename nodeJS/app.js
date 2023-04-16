const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const multer = require('multer');
const app = express();
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const SftpClient = require('ssh2-sftp-client');
const glob = require('glob');
const shell = require('shelljs');


const config = {
    host: 'labs445-1.encs.concordia.ca',
    port: 22,
    username: 'team20',
    password: 'password20'
};

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
let videoList = [];

// Handle individual video segment uploads
app.post('/upload', upload.single('segment'), (req, res) => {
    const localMP4FilePath = `./segments/${req.file.originalname.replace('.webm', '.mp4')}`;

    // Add the file path of the MP4 segment to the array
    segmentFilePaths.push(localMP4FilePath);
    console.log(segmentFilePaths);

    const encodeffmpegcommand = `ffmpeg -i ${localMP4FilePath} -filter_complex "[0:v]split=4[v1][v2][v3][v4]; [v1]scale=w=426:h=240:force_original_aspect_ratio=decrease[240p]; [v2]scale=w=640:h=360:force_original_aspect_ratio=decrease[360p]; [v3]scale=w=854:h=480:force_original_aspect_ratio=increase,setsar=1,setdar=16/9[480p];[v4]scale=w=1280:h=720:force_original_aspect_ratio=decrease[720p]" -map [240p] -c:v:0 libx264 -b:v:0 700k -map 0:a -c:a:0 aac -b:a:0 64k -map [360p] -c:v:1 libx264 -b:v:1 1000k -map 0:a -c:a:1 aac -b:a:1 128k -map [480p] -c:v:2 libx264 -b:v:2 2000k -map 0:a -c:a:2 aac -b:a:2 128k -map [720p] -c:v:3 libx264 -b:v:3 4000k -map 0:a -c:a:3 aac -b:a:3 128k -f dash -min_seg_duration 4000 -use_template 1 -use_timeline 1 -adaptation_sets "id=0,streams=v id=1,streams=a" ./dash/output.mpd`;
    try {
        console.log("Executing FFmpeg command:", encodeffmpegcommand);
        exec(encodeffmpegcommand, (error, stdout, stderr) => {

            console.log('FFmpeg stdout:', stdout);
            console.log('Video segments encoded successfully');

        });
    } catch (error) {
        console.error('Error executing FFmpeg command:', error);
        console.error('FFmpeg stderr:', stderr);
        res.status(500).send(`Error executing FFmpeg command: ${error.message}`);

    } finally {
        res.send('ok');
    }



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

app.post('/uploadssh', (req, res) => {

    const sftp = new SftpClient();

    (async () => {
        try {
            await sftp.connect(config);
    
            const date = new Date();
            const dateString = date.toISOString().slice(0, 19).replace(/-/g, "").replace(/:/g, "").replace("T", "_");
            const remoteParentDir = `/home/team20/uploads/${dateString}`;
            const segmentFolder = `${remoteParentDir}/segments`;
            const dashFolder = `${remoteParentDir}/dash`;
            
            await sftp.mkdir(remoteParentDir);
            await sftp.mkdir(segmentFolder);
            await sftp.mkdir(dashFolder);

            const localFolder = path.join(__dirname, 'uploads', dateString);

            fs.mkdirSync(localFolder, { recursive: true });

            const segmentFiles = glob.sync('./segments/segment1.mp4');
            for (const file of segmentFiles) {
              const remoteFilePath = `${segmentFolder}/${file.replace('./segments/segment1', 'latest')}`;
              const localFilePath = path.join(localFolder, path.basename(file));
              await sftp.fastPut(file, remoteFilePath);
              fs.copyFileSync(file, localFilePath);
              console.log(`File ${file} uploaded successfully`);
            }
            
            const dashFiles = glob.sync('./dash/*');
            for (const file of dashFiles) {
              const remoteFilePath = `${dashFolder}/${file.replace('./dash/', '')}`;
              const localFilePath = path.join(localFolder, path.basename(file));
              await sftp.fastPut(file, remoteFilePath);
              fs.copyFileSync(file, localFilePath);
              console.log(`File ${file} uploaded successfully`);
            }
    
            console.log('All files uploaded successfully');
        } catch (error) {
            console.error('Error uploading files:', error);
            res.status(500).send(`Error uploading files: ${error.message}`);
        } finally {
            await sftp.end();
        }
    })();

    res.send('ok');
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


app.get('/getvideoslist', async (req, res) => {
    const directoryPath = path.join(__dirname, 'uploads');
    // Clear the videoList array before repopulating it
    videoList = [];
  
    try {
      // Get list of directories in /uploads
      const directories = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  
      for (const dir of directories) {
        if (dir.isDirectory()) {
          const path = `uploads/${dir.name}`;
          const files = await fs.promises.readdir(path, { withFileTypes: true });
  
          // Find .mpd files and add to video list
          for (const file of files) {
            if (file.isFile() && file.name.endsWith('.mpd')) {
              videoList.push({
                id: videoList.length + 1,
                title: file.name.replace('.mpd', ''),
                location: `${path}/${file.name}`,
              });
            }
          }
        }
      }
  
      // Return video list as JSON
      res.json(videoList);
    } catch (error) {
      console.error('Error retrieving video list:', error);
      res.status(500).send(`Error retrieving video list: ${error.message}`);
    }
  });
  

// Server-side endpoint to serve playlist file for selected video
app.get('/videos/:id/playlist.mpd', async (req, res) => {
    const videoId = req.params.id;
    const video = getVideoById(videoId);
  
    if (video) {
      const mpdFilePath = path.join(__dirname, video.location);
      console.log(mpdFilePath);
  
      try {
        const mpdContent = await fs.promises.readFile(mpdFilePath, 'utf-8');
  
        // Serve playlist file as XML
        res.set('Content-Type', 'application/xml');
        res.send(mpdContent);
      } catch (error) {
        console.error('Error retrieving mpd file:', error);
        res.status(500).send(`Error retrieving mpd file: ${error.message}`);
      }
    } else {
      res.status(404).send('Video not found');
    }
  });

  function getVideoById(videoId) {
    return videoList.find((v) => v.id == videoId);
  }

app.listen(3000, () => {
    console.log('Server listening on port 3000');
});
