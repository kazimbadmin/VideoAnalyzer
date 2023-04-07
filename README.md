#  Deep learning-based video analysis using AWS’s Amazon Rekognition and Google’s Video Intelligence API 

This application is a demostration of using AI to create cover pics from videos in a creator platform and shows you how to use Amazon Rekognition service and Google’s Video Intelligence API. The services used in this example are: 
- Amazon Rekognition Service
- Google’s Video Intelligence API
- fast-sort
- fluent-ffmpeg

## Build
To build this service example, you need the following:
* An AWS account. 
* A GCP account. 
* And a project environment to run this NodeJs example, and install the required AWS SDK and third-party modules.
You can use your AWS and GCP consoles to create the AWS and GCP resources required for this app. And then clone this repository into your preferred NodeJs IDE and execute the following command in the terninal of your IDE:
```
npm install
node GoogleVideoInteligence.js // to run Google’s Video Intelligence API 
node AwsRekognitionService.js // to run AWS’s Amazon Rekognition Service
```

**Note**: The services used in this example can incur some charges on your AWS and GCP accounts. Be sure to terminate all of the resources if you are following this example.
