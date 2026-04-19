const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const awsService = require("./aws");

class FfmpegService {


    generateThumbnail = async (videoUrl) => {
        console.log('Generating thumbnail for:', videoUrl);

        return new Promise((resolve, reject) => {
            try {

                if (!videoUrl || typeof videoUrl !== 'string') {
                    return resolve(null);
                }

                // Extract filename from URL
                const urlParts = videoUrl.split('/');
                const fileName = urlParts[urlParts.length - 1];
                const baseName = path.basename(fileName, path.extname(fileName));

                // Create thumbnail directory
                const thumbnailDir = path.resolve("uploads/exercise_video_thumbnails");
                fs.mkdirSync(thumbnailDir, { recursive: true });

                const thumbnailPath = path.join(thumbnailDir, `${baseName}_thumbnail.png`);

                // Use ffmpeg to stream directly from URL with smart seeking
                // const ffmpegArgs = [
                //     '-ss', '3',                          // Seek to 3 seconds
                //     '-i', videoUrl,                      // Input from S3 URL directly
                //     '-frames:v', '1',                    // Capture only 1 frame
                //     '-vf', 'scale=320:-1',               // Scale width to 320px, maintain aspect ratio
                //     '-f', 'image2',                      // Output format
                //     thumbnailPath,
                //     '-y',                                // Overwrite output
                //     '-timeout', '30000000',              // 30 second timeout
                //     '-analyzeduration', '5000000',       // Faster analysis (5MB)
                //     '-probesize', '5000000'              // Limit initial probe size
                // ];

                const ffmpegArgs = [
                    '-timeout', '30000000',              // 30 second timeout (must come before -i)
                    '-analyzeduration', '10000000',       // increased for heavy videos
                    '-probesize', '10000000',             // increased for heavy videos
                    '-i', videoUrl,                  // Input from S3 URL directly
                    '-ss', '1.5',                      // Seek to 1.5 seconds AFTER input
                    '-frames:v', '1',                    // Capture only 1 frame
                    '-vf', 'scale=320:-1',               // Scale width to 320px, maintain aspect ratio
                    '-f', 'image2',                      // Output format
                    thumbnailPath,
                    '-y'                                 // Overwrite output
                ];

                const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

                // Collect stderr for debugging
                // let errorOutput = '';
                // ffmpegProcess.stderr.on('data', (data) => {
                //     errorOutput += data.toString();
                //     console.log('FFmpeg stderr:', data.toString());
                // });

                ffmpegProcess.on('close', async (code) => {
                    console.log(`FFmpeg exited with code ${code}`);
                    // console.log('FFmpeg error output:', errorOutput);

                    // Check if file exists and has content
                    const fileExists = fs.existsSync(thumbnailPath);
                    if (fileExists) {
                        const stats = fs.statSync(thumbnailPath);
                        console.log('Thumbnail file size:', stats.size, 'bytes');
                    }
                    
                    console.log(thumbnailPath, "========thumbnailPath");
                    console.log(fileExists, '======fileExists');
                    if (code === 0 && fileExists) {
                        console.log('Thumbnail generated successfully');

                        try {
                            // Upload thumbnail to AWS S3
                            const uploadImageOnAws = await awsService.uploadLocalFileToS3(thumbnailPath);

                            // Delete local thumbnail
                            fs.unlinkSync(thumbnailPath);

                            resolve(uploadImageOnAws);
                        } catch (uploadError) {
                            console.log('Upload error:', uploadError);
                            resolve(null);
                        }
                    } else {
                        console.log(`Thumbnail generation failed with code ${code}`);
                        resolve(null);
                    }
                });

                ffmpegProcess.on('error', (error) => {
                    console.log('FFmpeg process error:', error.message);
                    resolve(null);
                });

                // Set timeout (optional)
                setTimeout(() => {
                    if (ffmpegProcess.exitCode === null) {
                        console.log('FFmpeg timeout, killing process');
                        ffmpegProcess.kill();
                        resolve(null);
                    }
                }, 45000); // 45 second timeout

            } catch (err) {
                console.log(err, "====err");
                console.log("Thumbnail generation error:", err.message);
                resolve(null);
            }
        });
    };

}

module.exports = new FfmpegService;