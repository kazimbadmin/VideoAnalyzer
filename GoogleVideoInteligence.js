const Video = require('@google-cloud/video-intelligence').v1;
const { inPlaceSort } =  require('fast-sort');
const SmartCrop = require("./Util");

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
      const startTime = parseFloat(`${segment.startTimeOffset.seconds}.` + `${(segment.startTimeOffset.nanos / 1e6).toFixed(0)}`);
      const endTime = parseFloat(`${segment.endTimeOffset.seconds}.` + `${(segment.endTimeOffset.nanos / 1e6).toFixed(0)}`);
      let attributes = {
        "startTime": parseFloat(`${segment.startTimeOffset.seconds}.` + `${(segment.startTimeOffset.nanos / 1e6).toFixed(0)}`),
        "endTime": parseFloat(`${segment.endTimeOffset.seconds}.` + `${(segment.endTimeOffset.nanos / 1e6).toFixed(0)}`),
        "confidenceScore": 0,
        "timestamp" : (startTime + endTime)/2
      }      
      for (const { name, confidence } of firstTimestapedObject.attributes) {
        if (name === 'eyes_visible' || name === 'looking_at_camera' || name === 'smiling') {
          attributes.confidenceScore = attributes.confidenceScore+ confidence;
        }
      }
      facesArray.push(attributes);
    }
  }
  inPlaceSort(facesArray).desc(attributes => attributes.confidenceScore);
  SmartCrop.startFrameGrabbing(facesArray.length > 3 ? facesArray.slice(0, 3) : facesArray, dirPath, videoPath)
  SmartCrop.storeResponseIntoCsv(facesArray, dirPath + 'face-data.csv');
}

main("GS-OBJECT", "LOCAL-DIR-PATH-TO_STORE-RESULTS", "GS-OBJECT-PUBLIC-URL");