const https = require('https');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper'); // npm install unzipper

const repo = 'Fezalion/FezOverlay'; // Change to your GitHub repo
const exeName = 'fezoverlay.exe';     // Change to your exe name
const distZipName = 'dist.zip';       // Name of your zipped dist asset
const versionFile = path.join(__dirname, 'version.txt');

function getLatestRelease(cb) {
  https.get(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { 'User-Agent': 'node' }
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => cb(JSON.parse(data)));
  });
}

function downloadFile(url, dest, cb) {
  const file = fs.createWriteStream(dest);
  https.get(url, { headers: { 'User-Agent': 'node' } }, response => {
    response.pipe(file);
    file.on('finish', () => file.close(cb));
  });
}

function extractZip(zipPath, destDir, cb) {
  fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: destDir }))
    .on('close', cb);
}

// Read current version
function getCurrentVersion() {
  try {
    return fs.readFileSync(versionFile, 'utf8').trim();
  } catch {
    return '';
  }
}

// Write new version
function setCurrentVersion(version) {
  fs.writeFileSync(versionFile, version);
}

getLatestRelease(release => {
  const latestVersion = release.tag_name || release.name || '';
  const currentVersion = getCurrentVersion();

  if (latestVersion === currentVersion) {
    console.log('Already up to date (version:', latestVersion, ')');
    return;
  }

  // Download exe
  const exeAsset = release.assets.find(a => a.name === exeName);
  if (exeAsset) {
    console.log('Downloading new exe...');
    downloadFile(exeAsset.browser_download_url, path.join(__dirname, exeName + '.new'), () => {
      fs.renameSync(path.join(__dirname, exeName + '.new'), path.join(__dirname, exeName));
      console.log('Exe update complete!');
    });
  } else {
    console.log('No exe found in latest release.');
  }

  // Download dist.zip
  const distAsset = release.assets.find(a => a.name === distZipName);
  if (distAsset) {
    console.log('Downloading new dist.zip...');
    downloadFile(distAsset.browser_download_url, path.join(__dirname, distZipName), () => {
      console.log('Extracting dist.zip...');
      extractZip(path.join(__dirname, distZipName), path.join(__dirname, 'dist'), () => {
        fs.unlinkSync(path.join(__dirname, distZipName)); // Remove zip after extraction
        console.log('dist folder update complete!');
      });
    });
  } else {
    console.log('No dist.zip found in latest release.');
  }

  // Update version file
  setCurrentVersion(latestVersion);
});