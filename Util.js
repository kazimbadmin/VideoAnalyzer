const sharp = require('sharp');
const { RekognitionClient, DetectFacesCommand } = require("@aws-sdk/client-rekognition");
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const REGION = "YOUR-AWS-RESOURCES-REGION";
const EXTENSION = ".png";
const ASP_16X9 = "16X9";
const ASP_5X7 = "5X7";
const ASP_1X1 = "1X1";

// Helper function to generate Thumbnail using ffmpeg
const startFrameGrabbing = async (facesArray, dir, fileUrl) => {
  let timestampArray = [];
  for (item of facesArray) {
    timestampArray.push(item.timestamp);
  }
  ffmpeg(fileUrl)
    .screenshots({
      timemarks: timestampArray,
      folder: dir,
      filename: '%s.png',
    }).on('end', function () {
      for (obj of facesArray) {
        const filePath = `${dir}${item.timestamp}`;
        cropImage(`${filePath}${EXTENSION}`, `${filePath}${ASP_16X9}${EXTENSION}`, ASP_16X9, item.boundingBox);
        cropImage(`${filePath}${EXTENSION}`, `${filePath}${ASP_5X7}${EXTENSION}`, ASP_5X7, item.boundingBox);
        cropImage(`${filePath}${EXTENSION}`, `${filePath}${ASP_1X1}${EXTENSION}`, ASP_1X1, item.boundingBox)
      }
    });
}

const cropImage = async (originialFilePath, newFilePath, cropRatio, boundingBox = null) => {
  // convert image to Sharp object
  const metadata = await sharp(originialFilePath).metadata();
  let image = metadata.orientation
    ? sharp(originialFilePath).withMetadata({ orientation: metadata.orientation })
    : sharp(originialFilePath).withMetadata();

  // crop image
  const imageBuffer = await image.toBuffer({ resolveWithObject: true });
  if (boundingBox === null) {
    boundingBox = await getBoundingBox(imageBuffer.data, 0);
  }
  const cropArea = getCropArea(boundingBox, cropRatio, imageBuffer.info);
  image.extract(cropArea);

  // save cropped image
  const modilfiedImageBuffer = await image.toBuffer();
  await sharp(modilfiedImageBuffer).toFile(newFilePath);
}

const getBoundingBox = async (imageBuffer) => {
  const rekognitionClient = new RekognitionClient({ region: REGION });
  const params = { Image: { Bytes: imageBuffer } };
  const command = new DetectFacesCommand(params);
  const response = await rekognitionClient.send(command);
  if (response.FaceDetails.length <= 0) {
    return { height: 1, left: 0, top: 0, width: 1 };
  }
  const boundingBox = new Object();
  boundingBox.Height = null;
  boundingBox.Left = null;
  boundingBox.Top = null;
  boundingBox.Width = null;
  // handle bounds > 1 and < 0
  for (const bound in response.FaceDetails[0].BoundingBox) {
    if (response.FaceDetails[0].BoundingBox[bound] < 0) boundingBox[bound] = 0;
    else if (response.FaceDetails[0].BoundingBox[bound] > 1) boundingBox[bound] = 1;
    else boundingBox[bound] = response.FaceDetails[0].BoundingBox[bound];
  }
  // handle bounds greater than the size of the image
  if (boundingBox.Left + boundingBox.Width > 1) {
    boundingBox.Width = 1 - boundingBox.Left;
  }
  if (boundingBox.Top + boundingBox.Height > 1) {
    boundingBox.Height = 1 - boundingBox.Top;
  }
  return {
    Height: boundingBox.Height,
    Left: boundingBox.Left,
    Top: boundingBox.Top,
    Width: boundingBox.Width,
  };
}

const getCropArea = (boundingBox, cropRatio, boxSize) => {
  const padding = 100;
  let left = Math.floor(boundingBox.Left * boxSize.width - padding);
  left = left < 0 ? 0 : left;
  let extractWidth = Math.floor(boundingBox.Width * boxSize.width + padding * 2);
  const maxWidth = boxSize.width;
  extractWidth = extractWidth > maxWidth ? maxWidth : extractWidth;

  const maxHeight = boxSize.height;
  let extractHeight = maxHeight;
  if (cropRatio === ASP_16X9) {
    let convertedWidth = Math.floor(extractHeight * 1.77);
    const { newExtractWidth, newLeft } = getNewDimensions(convertedWidth, maxWidth, extractWidth, left);
    extractWidth = newExtractWidth;
    left = newLeft;

  } else if (cropRatio === ASP_5X7) {
    let convertedWidth = Math.floor(extractHeight * 0.71);
    const { newExtractWidth, newLeft } = getNewDimensions(convertedWidth, maxWidth, extractWidth, left);
    extractWidth = newExtractWidth;
    left = newLeft;

  } else if (cropRatio === ASP_1X1) {
    let convertedWidth = extractHeight;
    const { newExtractWidth, newLeft } = getNewDimensions(convertedWidth, maxWidth, extractWidth, left);
    extractWidth = newExtractWidth;
    left = newLeft;
  }
  extractWidth = extractWidth > maxWidth ? maxWidth : extractWidth;
  extractHeight = extractHeight > maxHeight ? maxHeight : extractHeight;
  return {
    left,
    top: 0,
    width: extractWidth,
    height: extractHeight,
  };
}

const getNewDimensions = (convertedWidth, maxWidth, extractWidth, left) => {
  if (convertedWidth >= maxWidth) {
    extractWidth = maxWidth;
    left = 0;
  } else if (convertedWidth <= extractWidth) {
    const diff = extractWidth - convertedWidth;
    extractWidth = convertedWidth;
    let newLeft = Math.floor(left + diff / 2);
    left = (newLeft < 0) || ((extractWidth - newLeft) < 0) ? 0 : newLeft;
  } else {
    const diff = convertedWidth - extractWidth;
    extractWidth = convertedWidth;
    let newLeft = Math.floor(left - diff / 2);
    left = (newLeft < 0) || ((newLeft + extractWidth) > maxWidth) ? 0 : newLeft;
  }
  return {
    "newExtractWidth": extractWidth,
    "newLeft": left
  };
}

// Helper function to create the CSV file.
function storeResponseIntoCsv(facesArray, path) {
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

module.exports = { cropImage, startFrameGrabbing, storeResponseIntoCsv }
