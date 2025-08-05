const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const repo = 'Fezalion/FezOverlay';
const exeName = 'fezoverlay.exe';
const distZipName = 'dist.zip';
const updaterName = 'updater.exe';

// Get the directory where the updater is running
const baseDir = path.dirname(process.execPath);
const versionFile = path.join(baseDir, 'version.txt');

// Check for .env file and create if missing
const envPath = path.join(baseDir, '.env');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, 'LASTFM_API_KEY=\n', 'utf8');
  console.log('.env file was missing and has been created with default LASTFM_API_KEY.');
}

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
    console.log('Command:', unzipCommand);
    
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
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
        
        // Fallback: copy zip file and provide instructions
        const destZipPath = path.join(destDir, 'dist.zip');
        fs.copyFileSync(zipPath, destZipPath);
        
        console.log('Zip file copied to dist folder.');
        console.log('Please extract the dist.zip file manually.');
        console.log('Right-click on dist.zip and select "Extract All"');
        
        cb();
      } else {
        console.log('✓ Files extracted successfully!');
        console.log('stdout:', stdout);
        if (stderr) console.log('stderr:', stderr);
        
        // Debug: List what was extracted
        console.log('Checking extracted files...');
        try {
          const files = fs.readdirSync(destDir);
          console.log('Files in dist folder:', files);
          
          // Check if index.html exists
          const indexPath = path.join(destDir, 'index.html');
          if (fs.existsSync(indexPath)) {
            console.log('✓ index.html found');
          } else {
            console.log('✗ index.html not found');
            
            // Check if there's a subfolder (common issue with zip files)
            for (const file of files) {
              const filePath = path.join(destDir, file);
              if (fs.statSync(filePath).isDirectory()) {
                console.log(`Found subfolder: ${file}`);
                const subIndexPath = path.join(filePath, 'index.html');
                if (fs.existsSync(subIndexPath)) {
                  console.log(`✓ index.html found in subfolder: ${file}/index.html`);
                  console.log('Moving files from subfolder to dist root...');
                  
                  // Move files from subfolder to dist root
                  const subFiles = fs.readdirSync(filePath);
                  for (const subFile of subFiles) {
                    const srcPath = path.join(filePath, subFile);
                    const destPath = path.join(destDir, subFile);
                    fs.renameSync(srcPath, destPath);
                  }
                  
                  // Remove the empty subfolder
                  fs.rmdirSync(filePath);
                  console.log('✓ Files moved successfully');
                }
              }
            }
          }
          
          // Check if assets folder exists
          const assetsPath = path.join(destDir, 'assets');
          if (fs.existsSync(assetsPath)) {
            console.log('✓ assets folder found');
            const assetFiles = fs.readdirSync(assetsPath);
            console.log('Asset files:', assetFiles);
          } else {
            console.log('✗ assets folder not found');
          }
        } catch (listErr) {
          console.log('Error listing files:', listErr.message);
        }
        
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
  
  // Debug: Check current state
  const distPath = path.join(baseDir, 'dist');
  console.log('Checking current dist folder...');
  if (fs.existsSync(distPath)) {
    try {
      const files = fs.readdirSync(distPath);
      console.log('Current files in dist:', files);
      
      // Check for key files
      const indexPath = path.join(distPath, 'index.html');
      const assetsPath = path.join(distPath, 'assets');
      
      if (fs.existsSync(indexPath)) {
        console.log('✓ index.html exists');
      } else {
        console.log('✗ index.html missing');
      }
      
      if (fs.existsSync(assetsPath)) {
        console.log('✓ assets folder exists');
        const assetFiles = fs.readdirSync(assetsPath);
        console.log('Asset files:', assetFiles);
      } else {
        console.log('✗ assets folder missing');
      }
    } catch (err) {
      console.log('Error reading dist folder:', err.message);
    }
  } else {
    console.log('Dist folder does not exist');
  }
  console.log('');
  
  // Clean up old .js and .css files in the dist folder
  const distDir = path.join(baseDir, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        try {
          fs.unlinkSync(path.join(distDir, file));
          console.log('Deleted old file:', file);
        } catch (err) {
          console.warn('Failed to delete file:', file, err.message);
        }
      }
    }
  }

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
     const updaterAsset = release.assets.find(a => a.name === updaterName);
     
     let downloadsCompleted = 0;
     let totalDownloads = 0;
     let hasError = false;

     // Batch script content
const batContent = `
@echo off
setlocal enabledelayedexpansion

if not exist "updater.exe.new" (
    echo [ERROR] File "updater.exe.new" not found.
    exit /b 1
)

echo Waiting for updater.exe to stop...
:wait_loop
TASKLIST | find /I "updater.exe" >nul 2>&1
if %errorlevel%==0 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

if exist "updater.exe" (
    echo Attempting to replace updater.exe...
) else (
    echo No existing updater.exe, just renaming new file...
)

set attempts=0
:move_retry
move /Y "updater.exe.new" "updater.exe" >nul 2>&1
if exist "updater.exe.new" (
    set /a attempts+=1
    if !attempts! lss 5 (
        echo [WARN] Move failed, retrying in 1 second... (!attempts!/5)
        timeout /t 1 /nobreak >nul
        goto move_retry
    ) else (
        echo [ERROR] Failed to replace updater.exe after 5 attempts.
        exit /b 2
    )
)

echo [SUCCESS] updater.exe replaced successfully.
exit /b 0
`;
     
     if (exeAsset) totalDownloads++;
     if (distAsset) totalDownloads++;
     if (updaterAsset) totalDownloads++; // Count updater.exe as a download
     
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
            
            // After all downloads and updates are successful, check if updaterAsset was downloaded and perform self-update
            if (updaterAsset) {
              const updaterNewPath = path.join(baseDir, 'updater.exe.new');
              console.log('Updater new path:', updaterNewPath);
              // If updater.new.exe exists (downloaded), create and run the batch file
              if (fs.existsSync(updaterNewPath)) {
                const batchFile = path.join(baseDir, 'replace_updater.bat');
                const updaterPath = path.join(baseDir, 'updater.exe');
                fs.writeFileSync(batchFile, batContent, 'utf8');
                console.log('Updater will now update itself...');
                require('child_process').spawn('cmd.exe', ['/c', batchFile], {
                  detached: true,
                  stdio: 'ignore',
                  cwd: baseDir
                });
                process.exit(0);
              }
            }

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

      if (updaterAsset) {
        console.log(`[1/${totalDownloads}] Updating  updater executable...`);
        downloadFile(exeAsset.browser_download_url, path.join(baseDir, updaterName + '.new'), (err) => {
          if (err) {
            console.error('✗ Failed to download updater.exe:', err.message);
            hasError = true;
          } else {
            try {              
              console.log('✓ updater.exe downloaded successfully!');
            } catch (renameErr) {             
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
          
          // Debug: Check zip file size
          try {
            const zipStats = fs.statSync(path.join(baseDir, distZipName));
            console.log(`Zip file size: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB`);
          } catch (statErr) {
            console.log('Could not get zip file stats:', statErr.message);
          }
          
          console.log('\nExtracting application files...');
          extractZip(path.join(baseDir, distZipName), path.join(baseDir, 'dist'), () => {
            console.log('✓ Application files extracted successfully!');
            checkCompletion();
          });
        });
      }

      // After all downloads and updates are successful, check if updaterAsset was downloaded and perform self-update
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