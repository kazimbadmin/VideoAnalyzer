const Video = require('@google-cloud/video-intelligence').v1;
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

async function main(gcsUri, dirPath, videoPath) {
  // Starting face detection 
  const video = new Video.VideoIntelligenceServiceClient();
  const request = {
    inputUri: gcsUri,
    features: ['FACE_DETECTION'],
    videoContext: {
      faceDetectionConfig: {
        // Must set includeBoundingBoxes to true to get facial attributes.
        includeBoundingBoxes: true,
        includeAttributes: true,
      }
    },
  };
  const [operation] = await video.annotateVideo(request);

  // Reading face detection response 
  const results = await operation.promise();
  console.log('Waiting for operation to complete...');
  const faceAnnotations = results[0].annotationResults[0].faceDetectionAnnotations;
  var facesArray = [];
  var timestampArray = [];
  var filteredTimetampArray = [];
  const csvRow = JSON.stringify(faceAnnotations);
  facesArray.push(csvRow);

  for (const { tracks } of faceAnnotations) {
    for (const { segment, timestampedObjects, confidence } of tracks) {
      const startTime = segment.startTimeOffset.seconds.toNumber();
      const [firstTimestapedObject] = timestampedObjects;
      var isLookingAtCamera = false;
      var isSmiling = false;
      var isEyesVisible = false;
      for (const { name, confidence } of firstTimestapedObject.attributes) {
        if (confidence >= 0.50) {
          if (name === 'eyes_visible') {
            isEyesVisible = true;
          }
          if (name === 'looking_at_camera') {
            isLookingAtCamera = true;
          }
          if (name === 'smiling') {
            isSmiling = true;
          }
        }
      }
      if (isLookingAtCamera && !checkVal(filteredTimetampArray, startTime) && filteredTimetampArray.length <3 
      || isSmiling && isEyesVisible && !checkVal(filteredTimetampArray, startTime) && filteredTimetampArray.length <3) {
        filteredTimetampArray.push(startTime);
      }
      timestampArray.push(startTime)
    }
  }
  timestampArray.sort();
  if (filteredTimetampArray.length < 3) {
    for (let index = timestampArray.length - 1; index >= 0; index--) {
      const item = timestampArray[index];
      if (filteredTimetampArray.length >=3) {
        break;
      }
      if(!checkVal(filteredTimetampArray, item)){
        filteredTimetampArray.push(item);
      }
    }
  }
  filteredTimetampArray.sort();
  // Store result into CSV and generate thumbnails
  generateThumbnails(filteredTimetampArray, dirPath, videoPath)
  storeApiResponse(facesArray, dirPath + 'response.csv');
}


// Helper function to create the CSV file.
function storeApiResponse(facesArray, path) {
  let csvContent = '';
  facesArray.forEach(function (row) {
    csvContent += row + "\r\n";
  });
  fs.writeFile(path, csvContent, 'utf8', function (err) {
    if (err) {
      console.log('Some error occured - file either not saved or corrupted file saved.');
    } else {
      console.log('It\'s saved!');
    }
  });
}

// Helper function to generate Thumbnail using ffmpeg
const generateThumbnails = async (arr, dir, videoPath) => {
  console.log(dir, arr);
  ffmpeg(videoPath)
    .screenshots({
      timemarks: arr,
      folder: dir
    }).on('end', function () {
      // readDirectory(dir)
    });
}

const checkVal = (arr, val) => {
  return arr.includes(val)
};

main("GS-OBJECT", "LOCAL-DIR-PATH-TO_STORE-RESULTS", "GS-OBJECT-PUBLIC-URL");
