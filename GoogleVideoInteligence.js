const Video = require('@google-cloud/video-intelligence').v1;
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { inPlaceSort } =  require('fast-sort');

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
  for (const { tracks } of faceAnnotations) {
    for (const { segment, timestampedObjects } of tracks) {
      const [firstTimestapedObject] = timestampedObjects;
      let attributes = {
        "startTime": parseFloat(`${segment.startTimeOffset.seconds}.` + `${(segment.startTimeOffset.nanos / 1e6).toFixed(0)}`),
        "endTime": parseFloat(`${segment.endTimeOffset.seconds}.` + `${(segment.endTimeOffset.nanos / 1e6).toFixed(0)}`),
        "eyes_visible_confidence": 0,
        "looking_at_camera_confidence": 0,
        "smiling_confidence": 0
      }
      for (const { name, confidence } of firstTimestapedObject.attributes) {
        if (name === 'eyes_visible') {
          attributes.eyes_visible_confidence = confidence;
        }
        else if (name === 'looking_at_camera') {
          attributes.looking_at_camera_confidence = confidence;
        }
        else if (name === 'smiling') {
          attributes.smiling_confidence = confidence;
        }
      }
      facesArray.push(attributes);
    }
  }
  
  inPlaceSort(facesArray).by([
    { desc: attributes => attributes.eyes_visible_confidence },
    { desc: attributes => attributes.looking_at_camera_confidence },
    { desc: attributes => attributes.smiling_confidence }
  ]);

  var timestampArray = [];
  for (item of facesArray) {
    const avg = (item.endTime + item.startTime)/2;
    if (!checkVal(timestampArray, avg)) {
        timestampArray.push(avg);
    }
    if (timestampArray.length >=3) {
      break;
    }
  }
  // Store result into CSV and generate thumbnails
  generateThumbnails(timestampArray, dirPath, videoPath)
  storeAttributes(facesArray, dirPath + 'response.csv');
}

// Helper function to create the CSV file.
function storeAttributes(facesArray, path) {
  let csvContent = '';
  facesArray.forEach(function (row) {
    csvContent += JSON.stringify(row) + "\r\n";
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
      folder: dir,
      filename: 'thumbnail-at-%s-seconds.png',
    }).on('end', function () {
    });
}

const checkVal = (arr, val) => {
  return arr.includes(val)
};

main("GS-OBJECT", "LOCAL-DIR-PATH-TO_STORE-RESULTS", "GS-OBJECT-PUBLIC-URL");


