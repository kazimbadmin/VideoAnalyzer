const { CognitoIdentityClient } = require("@aws-sdk/client-cognito-identity");
const { fromCognitoIdentityPool } = require("@aws-sdk/credential-provider-cognito-identity");
const { RekognitionClient } = require("@aws-sdk/client-rekognition");
const { StartFaceDetectionCommand, GetFaceDetectionCommand } = require("@aws-sdk/client-rekognition");
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const BUCKET = "YOUR-AWS-BUCKET-NAME";
const REGION = "YOUR-AWS-RESOURCES-REGION";
const IDENTITY_POOL_ID = "YOUR-IDENTITY-POOL-ID";


const main = async (dirPath, videoName) => {
  const rekognitionClient = new RekognitionClient({
    region: REGION,
    credentials: fromCognitoIdentityPool({
      client: new CognitoIdentityClient({ region: REGION }), identityPoolId: IDENTITY_POOL_ID,
    }),
  });

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
      var timetampArray = [];
      var filteredTimetampArray = [];
      var i;
      for (i = 0; i < results.Faces.length; i++) {
        const csvRow = JSON.stringify(results.Faces[i]);
        facesArray.push(csvRow);
        const face = results.Faces[i].Face;
        const timestamp = milisecondsToTimeStamp(results.Faces[i].Timestamp);
        if (face.Confidence >= 50 && face.EyesOpen.Value === true && face.EyesOpen.Confidence >= 50 && face.Smile.Value === true && face.Smile.Confidence >= 50 && !checkVal(filteredTimetampArray, timestamp)) {
          filteredTimetampArray.push(timestamp)
        }
        if (filteredTimetampArray.length>=3){
          break;
        }
        timetampArray.push(timestamp)
      }
      timetampArray.sort();
      if (filteredTimetampArray.length < 3) {
        for (let index = timetampArray.length - 1; index >= 0; index--) {
          const item = timetampArray[index];
          if (filteredTimetampArray.length >= 3) {
            break;
          }
          if(!checkVal(filteredTimetampArray, item)){
            filteredTimetampArray.push(item);
          }
        }
      }
      filteredTimetampArray.sort();
      // Store result into CSV and generate thumbnails
      generateThumbnails(filteredTimetampArray, videoName, dirPath)
      storeApiResponse(facesArray, dirPath + 'face-data.csv');
    } catch (err) {
      console.log("Error", err);
    }
  } catch (err) {
    console.log("Error", err);
  }
};


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
const generateThumbnails = async (timestampArray, videoName, dir) => {
  const s3ObjectUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${videoName}`;
  console.log("s3ObjectUrl", s3ObjectUrl, dir, timestampArray);
  ffmpeg(s3ObjectUrl)
    .screenshots({
      timemarks: timestampArray, // number of seconds
      folder: dir
    }).on('end', function () {
      // readDirectory(dir)
    });
}

const checkVal = (arr, val) => {
  return arr.includes(val)
};

// Helper funtion to convert miliseconds into "HH:MM:SS format" 
const milisecondsToTimeStamp = milliseconds => {
  const seconds = Math.floor((milliseconds / 1000) % 60);
  const minutes = Math.floor((milliseconds / 1000 / 60) % 60);
  const hours = Math.floor((milliseconds / 1000 / 60 / 60) % 24);
  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0")
  ].join(":");
}

main("LOCAL-DIR-PATH-TO_STORE-RESULTS", "S3-OBJECT-NAME");
