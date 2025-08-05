const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const repo = 'Fezalion/FezOverlay';
const exeName = 'fezoverlay.exe';
const distZipName = 'dist.zip';

// Get the directory where the updater is running
const baseDir = path.dirname(process.execPath);
const versionFile = path.join(baseDir, 'version.txt');

function getLatestRelease(cb) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  console.log('Fetching latest release from:', url);
  
  https.get(url, {
    headers: { 'User-Agent': 'node' }
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        console.log('GitHub API response status:', res.statusCode);
        const release = JSON.parse(data);
        
        // Check for API errors
        if (release.message) {
          if (release.message.includes('Not Found')) {
            return cb(new Error('Repository or release not found'));
          }
          return cb(new Error(`GitHub API error: ${release.message}`));
        }
        
        // Check if we have a valid release
        if (!release.tag_name) {
          return cb(new Error('No tag_name found in release'));
        }
        
        console.log('Latest release found:', release.tag_name);
        cb(null, release);
      } catch (err) {
        console.error('Failed to parse response:', err.message);
        cb(new Error('Failed to parse GitHub API response'));
      }
    });
  }).on('error', (err) => {
    console.error('Network error:', err.message);
    cb(new Error(`Failed to fetch latest release: ${err.message}`));
  });
}

function downloadFile(url, dest, cb) {
  const fileName = path.basename(dest);
  console.log(`Downloading ${fileName}...`);
  
  function makeRequest(url, redirectCount = 0) {
    // Prevent infinite redirect loops
    if (redirectCount > 5) {
      return cb(new Error('Too many redirects'));
    }
    
    const file = fs.createWriteStream(dest);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let lastProgressUpdate = 0;
    
    https.get(url, { 
      headers: { 'User-Agent': 'node' }
    }, response => {
      console.log(`Response status: ${response.statusCode}`);
      
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const location = response.headers.location;
        console.log('Redirecting to:', location);
        file.close();
        fs.unlink(dest, () => {}); // Delete partial file
        return makeRequest(location, redirectCount + 1);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {}); // Delete partial file
        return cb(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
      
      // Get total file size if available
      totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      
      if (totalBytes > 0) {
        console.log(`File size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
      }
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        
        // Update progress every 500ms to avoid spam
        const now = Date.now();
        if (now - lastProgressUpdate > 500) {
          if (totalBytes > 0) {
            const progress = (downloadedBytes / totalBytes * 100).toFixed(1);
            const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
            const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
            process.stdout.write(`\rProgress: ${progress}% (${downloadedMB}MB / ${totalMB}MB)`);
          } else {
            const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
            process.stdout.write(`\rDownloaded: ${downloadedMB}MB`);
          }
          lastProgressUpdate = now;
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        // Clear the progress line and show completion
        process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
        console.log(`✓ ${fileName} downloaded successfully!`);
        file.close(cb);
      });
      
      file.on('error', (err) => {
        process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
        console.error(`✗ File write error: ${err.message}`);
        file.close();
        fs.unlink(dest, () => {}); // Delete partial file
        cb(err);
      });
    }).on('error', (err) => {
      process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
      console.error(`✗ Download error: ${err.message}`);
      file.close();
      fs.unlink(dest, () => {}); // Delete partial file
      cb(err);
    });
  }
  
  makeRequest(url);
}

function extractZip(zipPath, destDir, cb) {
  try {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Use PowerShell to extract the zip file
    const unzipCommand = `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
    
    console.log('Extracting files...');
    
    // Show a simple progress indicator
    const progressInterval = setInterval(() => {
      process.stdout.write('.');
    }, 500);
    
    exec(unzipCommand, (error, stdout, stderr) => {
      clearInterval(progressInterval);
      process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear dots
      
      if (error) {
        console.log('PowerShell extraction failed, trying alternative method...');
        console.log('Error:', error.message);
        
        // Fallback: copy zip file and provide instructions
        const destZipPath = path.join(destDir, 'dist.zip');
        fs.copyFileSync(zipPath, destZipPath);
        
        console.log('Zip file copied to dist folder.');
        console.log('Please extract the dist.zip file manually.');
        console.log('Right-click on dist.zip and select "Extract All"');
        
        cb();
      } else {
        console.log('✓ Files extracted successfully!');
        
        // Clean up the zip file
        try {
          fs.unlinkSync(zipPath);
          console.log('✓ Removed temporary zip file.');
        } catch (unlinkErr) {
          console.warn('⚠ Could not remove zip file:', unlinkErr.message);
        }
        
        cb();
      }
    });
  } catch (err) {
    console.error('✗ Failed to extract zip file:', err.message);
    cb(err);
  }
}

function getCurrentVersion() {
  try {
    return fs.readFileSync(versionFile, 'utf8').trim();
  } catch {
    return '';
  }
}

function setCurrentVersion(version) {
  fs.writeFileSync(versionFile, version);
}

function main() {
  console.log('=== FezOverlay Updater ===');
  console.log('Base directory:', baseDir);
  
  getLatestRelease((err, release) => {
    if (err) {
      console.error('Error fetching latest release:', err.message);
      console.log('Press any key to exit...');
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', process.exit.bind(process, 1));
      return;
    }

    const latestVersion = release.tag_name || release.name || '';
    const currentVersion = getCurrentVersion();
    const distExists = fs.existsSync(path.join(baseDir, 'dist'));

    console.log('Current version:', currentVersion || 'none');
    console.log('Latest version:', latestVersion);

    // If dist folder doesn't exist, download regardless of version
    if (!distExists) {
      console.log('Dist folder not found. Downloading latest release...');
    } else if (latestVersion === currentVersion) {
      console.log('Already up to date!');
      console.log('Press any key to exit...');
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', process.exit.bind(process, 0));
      return;
    } else {
      console.log('New version available. Updating...');
    }

         // Download both exe and dist.zip
     const exeAsset = release.assets.find(a => a.name === exeName);
     const distAsset = release.assets.find(a => a.name === distZipName);
     
     let downloadsCompleted = 0;
     let totalDownloads = 0;
     let hasError = false;
     
     if (exeAsset) totalDownloads++;
     if (distAsset) totalDownloads++;
     
           function checkCompletion() {
        downloadsCompleted++;
        if (downloadsCompleted === totalDownloads) {
          console.log('\n' + '='.repeat(50));
          if (hasError) {
            console.log('❌ Update completed with errors');
            console.log('Some downloads failed. Please try again.');
            console.log('='.repeat(50));
            console.log('Press any key to exit...');
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', process.exit.bind(process, 1));
          } else {
            // Update version file
            setCurrentVersion(latestVersion);
            
            console.log('✅ Update completed successfully!');
            console.log(`Updated to version: ${latestVersion}`);
            console.log('You can now run fezoverlay.exe');
            console.log('='.repeat(50));
            console.log('Press any key to exit...');
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', process.exit.bind(process, 0));
          }
        }
      }
     
           console.log(`\nStarting download of ${totalDownloads} file(s)...\n`);
      
      // Download exe if available
      if (exeAsset) {
        console.log(`[1/${totalDownloads}] Updating executable...`);
        downloadFile(exeAsset.browser_download_url, path.join(baseDir, exeName + '.new'), (err) => {
          if (err) {
            console.error('✗ Failed to download fezoverlay.exe:', err.message);
            hasError = true;
          } else {
            try {
              // Replace the old exe with the new one
              const oldExePath = path.join(baseDir, exeName);
              const newExePath = path.join(baseDir, exeName + '.new');
              
              // If old exe exists, try to remove it first
              if (fs.existsSync(oldExePath)) {
                fs.unlinkSync(oldExePath);
              }
              
              fs.renameSync(newExePath, oldExePath);
              console.log('✓ fezoverlay.exe updated successfully!');
            } catch (renameErr) {
              console.error('✗ Failed to replace fezoverlay.exe:', renameErr.message);
              hasError = true;
            }
          }
          checkCompletion();
        });
      }
      
      // Download dist.zip if available
      if (distAsset) {
        const stepNumber = exeAsset ? 2 : 1;
        console.log(`[${stepNumber}/${totalDownloads}] Updating application files...`);
        downloadFile(distAsset.browser_download_url, path.join(baseDir, distZipName), (err) => {
          if (err) {
            console.error('✗ Failed to download dist.zip:', err.message);
            hasError = true;
            checkCompletion();
            return;
          }
          
          console.log('\nExtracting application files...');
          extractZip(path.join(baseDir, distZipName), path.join(baseDir, 'dist'), () => {
            console.log('✓ Application files extracted successfully!');
            checkCompletion();
          });
        });
      }
     
     // If no downloads are needed
     if (totalDownloads === 0) {
       console.log('No files to download from the latest release.');
       console.log('Press any key to exit...');
       process.stdin.setRawMode(true);
       process.stdin.resume();
       process.stdin.on('data', process.exit.bind(process, 1));
     }
  });
}

// Run the updater
main(); 