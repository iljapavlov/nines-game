import * as tf from '@tensorflow/tfjs';
import { Image } from 'image-js';

let model;

export const loadModel = async () => {
  if (!model) {
    model = await tf.loadLayersModel('/models/symbol_classifier_js/model.json');
  }
  return model;
};

export const segmentAndRecognize = async (imageData, model) => {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Convert to grayscale
  const greyImage = new Image(width, height, { kind: 'GREY' });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const grey = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      greyImage.setPixel(x, y, [grey]);
    }
  }

  // Binarize (drawn pixels < 200)
  const binaryImage = new Image(width, height, { kind: 'BINARY' });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const grey = greyImage.getPixel(x, y)[0];
      binaryImage.setBitXY(x, y, grey < 200 ? 1 : 0);
    }
  }

  // Find connected components
  const roiManager = binaryImage.getRoiManager();
  roiManager.fromMask(binaryImage);
  const rois = roiManager.getRois({ minArea: 10 });

  const symbols = [];
  for (const roi of rois) {
    const { minX, minY, maxX, maxY } = roi;
    const symbolImage = binaryImage.crop({
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
    const resized = symbolImage.resize({ width: 28, height: 28 });

    // Draw on temporary canvas for tensor conversion
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 28;
    tempCanvas.height = 28;
    const tempCtx = tempCanvas.getContext('2d');
    const img = new Image();
    img.src = resized.toDataURL();
    await img.decode();
    tempCtx.drawImage(img, 0, 0, 28, 28);

    // Recognize symbol
    const tensor = tf.browser.fromPixels(tempCanvas, 1).toFloat().div(255).expandDims();
    const prediction = await model.predict(tensor).data();
    const symbolsList = ['9', '+', '-', '*', '/', '(', ')']; // Adjust based on your model
    const symbol = symbolsList[prediction.indexOf(Math.max(...prediction))];
    symbols.push({ symbol, x: minX });
  }

  // Sort symbols by x-position
  symbols.sort((a, b) => a.x - b.x);
  return symbols;
};