const { RekognitionClient } = require("@aws-sdk/client-rekognition");
const { StartFaceDetectionCommand, GetFaceDetectionCommand } = require("@aws-sdk/client-rekognition");
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { inPlaceSort } =  require('fast-sort');
const BUCKET = "aws-video-analyser";
const REGION = "us-east-1";

const main = async (dirPath, videoName) => {
  const rekognitionClient = new RekognitionClient({ region: REGION });
  try {
    const startDetectParams = {
      Video: {
        S3Object: { Bucket: BUCKET, Name: videoName, },
      },
      // notificationChannel: {
      //   roleARN: IAM_ROLE_ARN,
      //   SNSTopicArn: "SNSTOPIC",
      // },
      FaceAttributes: "ALL",
    };
    // Starting face detection
    const data = await rekognitionClient.send(new StartFaceDetectionCommand(startDetectParams));
    console.log("Success, face detection started. ", data);
    const jobId = data.JobId;
    const faceDetectParams = { JobId: jobId, MaxResults: 10 };
    try {

      // Reading face detection response 
      var finished = false;
      while (!finished) {
        var results = await rekognitionClient.send(new GetFaceDetectionCommand(faceDetectParams));
        if (results.JobStatus == "SUCCEEDED") {
          finished = true;
        }
      }
      var facesArray = [];
      var i;
      for (face of results.Faces) {
        facesArray.push(csvRow);
        const face = results.Faces[i].Face;
        const timestamp = milisecondsToTimeStamp(results.Faces[i].Timestamp);
        let attributes = {
          "timestamp": timestamp,
          "face-confidence": face.Confidence,
          "eyes_open_confidence": face.EyesOpen.Confidence,
          "smiling_confidence": face.Smile.Confidence
        }
        facesArray.push(attributes);
      }

      inPlaceSort(facesArray).by([
        { desc: attributes => attributes.eyes_visible_confidence },
        { desc: attributes => attributes.looking_at_camera_confidence },
        { desc: attributes => attributes.smiling_confidence }
      ]);

      var timestampArray = [];
      for (item of facesArray) {
        if (!checkVal(timestampArray, item.timestamp)) {
          timestampArray.push(item.timestamp);
        }
        if (timestampArray.length >= 3) {
          break;
        }
      }
      // Store result into CSV and generate thumbnails
      generateThumbnails(timestampArray, videoName, dirPath)
      storeAttributes(facesArray, dirPath + 'face-data.csv');
    } catch (err) {
      console.log("Error", err);
    }
  } catch (err) {
    console.log("Error", err);
  }
};


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
const generateThumbnails = async (timestampArray, videoName, dir) => {
  const s3ObjectUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${videoName}`;
  console.log("s3ObjectUrl", s3ObjectUrl, dir, timestampArray);
  ffmpeg(s3ObjectUrl)
    .screenshots({
      timemarks: timestampArray,
      folder: dir,
      filename: 'thumbnail-at-%s-seconds.png',
    }).on('end', function () {
    });
}

const checkVal = (arr, val) => {
  return arr.includes(val)
};

// Helper funtion to convert miliseconds into seconds
const milisecondsToTimeStamp = milliseconds => {
  const seconds = milliseconds / 1000;
  return seconds;
}

main("LOCAL-DIR-PATH-TO_STORE-RESULTS", "S3-OBJECT-NAME");
