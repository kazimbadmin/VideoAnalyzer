const { RekognitionClient } = require("@aws-sdk/client-rekognition");
const { StartFaceDetectionCommand, GetFaceDetectionCommand } = require("@aws-sdk/client-rekognition");
const { inPlaceSort } = require('fast-sort');
const SmartCrop = require("./Util");
const BUCKET = "YOUR-AWS-BUCKET-NAME";
const REGION = "YOUR-AWS-RESOURCES-REGION";

const main = async (dirPath, videoName) => {
  const rekognitionClient = new RekognitionClient({ region: REGION });
  try {
    const startDetectParams = {
      Video: { S3Object: { Bucket: BUCKET, Name: videoName, }, },
      notificationChannel: {
        RoleArn: "IAM_ROLE_ARN",
        SNSTopicArn: "SNS_TOPIC_ARN",
      },
      FaceAttributes: "ALL",
    };
    // Starting face detection
    const data = await rekognitionClient.send(new StartFaceDetectionCommand(startDetectParams));
    console.log("Success, face detection started. ", data);
    const jobId = data.JobId;
    const faceDetectParams = { JobId: jobId, MaxResults: 10 };
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
    for (i = 0; i < results.Faces.length; i++) {
      const face = results.Faces[i].Face;
      const timestamp = milisecondsToTimeStamp(results.Faces[i].Timestamp);
      const boundingBox = face.BoundingBox;
      let attributes = {
        "timestamp": timestamp,
        "confidenceScore": face.Confidence + (face.EyesOpen.Value === true ? face.EyesOpen.Confidence : 0) + (face.Smile.Value === true ? face.Smile.Confidence : 0),
        "boundingBox": boundingBox
      }
      facesArray.push(attributes);
    }

    inPlaceSort(facesArray).desc(attributes => attributes.confidenceScore);
    const s3ObjectUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${videoName}`;
    SmartCrop.startFrameGrabbing(facesArray.length > 3 ? facesArray.slice(0, 3) : facesArray, dirPath, s3ObjectUrl)
    SmartCrop.storeResponseIntoCsv(facesArray, dirPath + 'face-data.csv');
  } catch (err) {
    console.log("Error", err);
  }
};

// Helper funtion to convert miliseconds into seconds
const milisecondsToTimeStamp = milliseconds => {
  const seconds = milliseconds / 1000;
  return seconds;
}

main("LOCAL-DIR-PATH-TO_STORE-RESULTS", "S3-OBJECT-NAME");
