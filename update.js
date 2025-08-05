const https = require('https');
const fs = require('fs');
const path = require('path');

// Check if we're in a packaged environment
const isPackaged = typeof process.pkg !== 'undefined';

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
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        if (release.message && release.message.includes('Not Found')) {
          return cb(new Error('Repository or release not found'));
        }
        cb(release);
      } catch (err) {
        cb(new Error('Failed to parse GitHub API response'));
      }
    });
  }).on('error', (err) => {
    cb(new Error(`Failed to fetch latest release: ${err.message}`));
  });
}

function downloadFile(url, dest, cb) {
  const file = fs.createWriteStream(dest);
  https.get(url, { headers: { 'User-Agent': 'node' } }, response => {
    if (response.statusCode !== 200) {
      file.close();
      fs.unlink(dest, () => {}); // Delete partial file
      return cb(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
    }
    response.pipe(file);
    file.on('finish', () => file.close(cb));
    file.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {}); // Delete partial file
      cb(err);
    });
  }).on('error', (err) => {
    file.close();
    fs.unlink(dest, () => {}); // Delete partial file
    cb(err);
  });
}

function extractZip(zipPath, destDir, cb) {
  if (isPackaged) {
    // In packaged environment, we can't extract zip files
    // The packaged exe should already have the latest version
    console.log('Running in packaged environment - skipping zip extraction');
    console.log('If you need to update, please download the latest release manually');
    cb();
  } else {
    // Since we can't easily extract zip files without external modules,
    // we'll copy the zip file to the dist folder and provide instructions
    try {
      // Create destination directory if it doesn't exist
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      // Copy the zip file to the dist folder
      const destZipPath = path.join(destDir, 'dist.zip');
      fs.copyFileSync(zipPath, destZipPath);
      
      console.log('Zip file copied to dist folder.');
      console.log('Please extract the dist.zip file manually to get the application files.');
      console.log('You can use Windows Explorer (right-click > Extract All) or any zip utility.');
      
      cb();
    } catch (err) {
      console.error('Failed to copy zip file:', err.message);
      cb(err);
    }
  }
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

getLatestRelease((err, release) => {
  if (err) {
    console.error('Error fetching latest release:', err.message);
    process.exit(1);
  }

  // If we're in a packaged environment, skip updates
  if (isPackaged) {
    console.log('Running in packaged environment - auto-updates disabled');
    console.log('Please download the latest release manually from GitHub');
    return;
  }

  const latestVersion = release.tag_name || release.name || '';
  const currentVersion = getCurrentVersion();
  const distExists = fs.existsSync(path.join(__dirname, 'dist'));

  // If dist folder doesn't exist, download regardless of version
  if (!distExists) {
    console.log('Dist folder not found. Downloading latest release...');
  } else if (latestVersion === currentVersion) {
    console.log('Already up to date (version:', latestVersion, ')');
    return;
  }

  // Download exe
  const exeAsset = release.assets.find(a => a.name === exeName);
  if (exeAsset) {
    console.log('Downloading new exe...');
    downloadFile(exeAsset.browser_download_url, path.join(__dirname, exeName + '.new'), (err) => {
      if (err) {
        console.error('Failed to download exe:', err.message);
        return;
      }
      try {
        fs.renameSync(path.join(__dirname, exeName + '.new'), path.join(__dirname, exeName));
        console.log('Exe update complete!');
      } catch (renameErr) {
        console.error('Failed to rename exe file:', renameErr.message);
      }
    });
  } else {
    console.log('No exe found in latest release.');
  }

  // Download dist.zip
  const distAsset = release.assets.find(a => a.name === distZipName);
  if (distAsset) {
    console.log('Downloading new dist.zip...');
    downloadFile(distAsset.browser_download_url, path.join(__dirname, distZipName), (err) => {
      if (err) {
        console.error('Failed to download dist.zip:', err.message);
        return;
      }
      console.log('Extracting dist.zip...');
      extractZip(path.join(__dirname, distZipName), path.join(__dirname, 'dist'), () => {
        try {
          fs.unlinkSync(path.join(__dirname, distZipName)); // Remove zip after extraction
          console.log('dist folder update complete!');
        } catch (unlinkErr) {
          console.warn('Warning: Could not remove zip file:', unlinkErr.message);
        }
      });
    });
  } else {
    console.log('No dist.zip found in latest release.');
  }

  // Update version file
  setCurrentVersion(latestVersion);
});