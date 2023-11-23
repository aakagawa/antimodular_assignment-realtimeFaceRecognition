const video = document.getElementById('webcam');
const imageFiles = [];
const imagePaths = [ // Not the most elegant way to load images but...
    './facelib/1.jpg', './facelib/2.jpg', './facelib/3.jpg', './facelib/4.jpg', './facelib/5.jpg',
    './facelib/6.jpg', './facelib/7.jpg', './facelib/8.jpg', './facelib/9.jpg', './facelib/10.jpg',
    './facelib/11.jpg', './facelib/12.jpg', './facelib/13.jpg', './facelib/14.jpg', './facelib/15.jpg',
    './facelib/16.jpg', './facelib/17.jpg', './facelib/18.jpg', './facelib/19.jpg', './facelib/20.jpg',
    './facelib/21.jpg', './facelib/22.jpg', './facelib/23.jpg', './facelib/24.jpg', './facelib/25.jpg',
    './facelib/26.jpg', './facelib/27.jpg', './facelib/28.jpg', './facelib/29.jpg', './facelib/30.jpg',
    './facelib/31.jpg', './facelib/32.jpg', './facelib/33.jpg', './facelib/34.jpg', './facelib/35.jpg',
    './facelib/36.jpg', './facelib/37.jpg', './facelib/38.jpg', './facelib/39.jpg', './facelib/40.jpg'
]; // Paths to images 

const constraints = { 
    video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
    }
};

// Load models
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('./node_modules/face-api.js/weights'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./node_modules/face-api.js/weights'),
    faceapi.nets.faceRecognitionNet.loadFromUri('./node_modules/face-api.js/weights'),
    faceapi.nets.faceExpressionNet.loadFromUri('./node_modules/face-api.js/weights')
]).then(() => {
    console.log("Models loaded successfully");
    // Start webcam
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.onplaying = () => {
            // Load images
            Promise.all(imagePaths.map((src, index) => loadImage(src, index)))
            .then(() => {
                // Start face detection
                // Compare captured image with loaded images
                detectFaces();
            });
        };
    })
    .catch((err) => {
        console.error("Error starting webcam:", err);
    });

    function loadImage(src, index) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                console.log(`Image ${index + 1} loaded: ${src}`);
                imageFiles[index] = img; // Store the loaded image in an array
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });
    }
      
    async function detectFaces() {
        const faceCanvas = document.getElementById('canvas'); 
        const faceContext = faceCanvas.getContext('2d');
    
        const result = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
        faceapi.draw.drawDetections(faceCanvas, result);
    
        for (const { detection, descriptor } of result) {
            const faceBox = detection.box;
    
            faceContext.drawImage(
                video, faceBox.x, faceBox.y, faceBox.width, faceBox.height, 0, 0, faceCanvas.width, faceCanvas.height
            );
    
            try {
                // Find matches
                const match = await findMatches(descriptor);
                // Display results
                displayMatchResult(match);
            } catch (error) {
                console.error("Error finding match:", error);
            }
        }
        requestAnimationFrame(detectFaces);
    }
    
    function getFaceDescriptorFromImage(imageElement, index) {
        console.log(`Processing image ${index + 1}: ${imageElement.src}`);
    
        return new Promise((resolve) => {
            imageElement.onload = () => {

                faceapi.detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors()
                    .then((detections) => {
                        if (detections.length > 0) {
                            const descriptor = detections[0].descriptor;
                            resolve(descriptor);
                        } else {
                            console.warn(`No face detected in image ${index + 1}`);
                            resolve(null);
                        }
                    })
                    .catch((error) => {
                        console.error(`Error processing image ${index + 1}:`, error);
                        resolve(null);
                    });
            };
    
            imageElement.onerror = () => {
                console.error(`Error loading image ${index + 1}`);
                resolve(null);
            };
    
            imageElement.src = imageElement.src; // Force the image to reload
        });
    }
    
    async function findMatches(descriptor) {
        try {
            const peopleDescriptors = await generateDescriptors();
    
            // Compare captured image with loaded images
            const matches = peopleDescriptors.map((personDescriptor, index) => {
                const distance = faceapi.euclideanDistance(descriptor, personDescriptor);
                return { index, distance };
            });
    
            // Remove self-match 
            const filteredMatches = matches.filter(match => match.distance > 0);
    
            filteredMatches.sort((a, b) => a.distance - b.distance);
    
            console.log("Top Matches:", filteredMatches);
    
            return filteredMatches.slice(0, 5); 
        } catch (error) {
            console.error("Error finding matches:", error);
            throw error; 
        }
    }

    async function generateDescriptors() {
        try {
            // Generate descriptors
            const descriptors = await Promise.all(
                imageFiles.map(async (imageElement, index) => {
                    const descriptor = await getFaceDescriptorFromImage(imageElement, index);
                    return descriptor;
                })
            );
            return descriptors.filter(descriptor => descriptor !== null); // Remove null descriptors
        } catch (error) {
            console.error("Error generating descriptors:", error);
            throw error; 
        }
    }

    function displayMatchResult(matches) {
        const resultsContainer = document.getElementById('matches');
        resultsContainer.innerHTML = ''; // Clear existing content
    
        console.log("Matches:", matches);
    
        if (matches && matches.length > 0) {
            for (let i = 0; i < Math.min(5, matches.length); i++) {
                // Create div for each match
                const matchContainer = document.createElement('div');
                matchContainer.classList.add('match-container');
    
                // Create span for each match for stuff..
                const detailsElement = document.createElement('span');
                detailsElement.textContent = `Person ${matches[i].index + 1}: Similarity Score - ${Math.round((1 - (matches[i].distance.toFixed(2))) * 100)}`;
    
                // Create img element for each match
                const imageElement = document.createElement('img');
                imageElement.classList.add('match-image');
                imageElement.src = `./facelib/${getPersonFileName(matches[i].index)}`; // Adjust the path accordingly
                imageElement.alt = `Person ${matches[i].index + 1}`;
    
                // Append the image and info to the div 
                matchContainer.appendChild(detailsElement);
                matchContainer.appendChild(imageElement);
    
                // Append the match container to the result container
                resultsContainer.appendChild(matchContainer);
            }
        } else {
            console.warn("Invalid matches array:", matches);
        }
    }
    
    function getPersonFileName(index) {
        // Map the index to the corresponding person's file name
        const fileNames = [
            '1.jpg','2.jpg','3.jpg','4.jpg','5.jpg','6.jpg','7.jpg','8.jpg','9.jpg','10.jpg',
            '11.jpg','12.jpg','13.jpg','14.jpg','15.jpg','16.jpg','17.jpg','18.jpg','19.jpg','20.jpg',
            '21.jpg','22.jpg','23.jpg','24.jpg','25.jpg','26.jpg','27.jpg','28.jpg','29.jpg','30.jpg',
            '31.jpg','32.jpg','33.jpg','34.jpg','35.jpg','36.jpg','37.jpg','38.jpg','39.jpg','40.jpg',
        ];
        return fileNames[index] || '';
    }

}).catch(error => {
    console.error("Error loading models:", error);
});

