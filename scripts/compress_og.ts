import fs from "fs";
import path from "path";
import sharp from "sharp";

const imagesDir = path.join(process.cwd(), "public/images/og");
const maxWidth = 1200;
const maxHeight = 630;

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const processImage = async (filePath: string): Promise<void> => {
  const dir = path.dirname(filePath);
  const filename = path.basename(filePath);
  const outputFilePath = path.join(dir, `compressed-${filename}`);

  try {
    await sharp(filePath)
      .resize(maxWidth, maxHeight, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .toFile(outputFilePath);
    
    fs.unlinkSync(filePath);
    fs.renameSync(outputFilePath, filePath);
    console.log(`Successfully compressed ${filename}`);
  } catch (err) {
    console.error(`Error processing file ${filename}:`, err);
  }
};

const main = async () => {
  try {
    const files = fs.readdirSync(imagesDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return SUPPORTED_EXTENSIONS.includes(ext);
      });
    
    if (files.length === 0) {
      console.log("No supported image files found");
      return;
    }

    console.log(`Found ${files.length} images to process...`);
    
    await Promise.all(
      files.map((file) => processImage(path.join(imagesDir, file)))
    );
    
    console.log("All images processed!");
  } catch (err) {
    console.error("Error reading images directory:", err);
  }
};

main();
