const { Client } = require('ssh2');

const sshConfig = {
  host: 'labs445-1.encs.concordia.ca',
  port: 22,
  username: 'team20',
  password: 'password20'
};

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) {
      console.error(err);
      return conn.end();
    }
    const remotePath = '/upload';
    const writeStream = sftp.createWriteStream(remotePath);
    const readStream = fs.createReadStream('recording.mp4');
    readStream.pipe(writeStream);
    writeStream.on('close', () => {
      console.log('File transferred to remote server');
      conn.end();
    });
  });
}).connect(sshConfig);
