const FilenSDK = require("@filen/sdk").default;
const fs = require("fs");
const path = require("path");

let filenSDK = null;

async function initializeFilen() {
  if (filenSDK) return filenSDK;

  try {
    filenSDK = new FilenSDK({
      email: process.env.FILEN_EMAIL,
      password: process.env.FILEN_PASSWORD,
      masterKey: process.env.FILEN_MASTER_KEY,
    });

    console.log("Filen SDK initialized");
    return filenSDK;
  } catch (error) {
    console.error("Failed to initialize Filen SDK:", error);
    throw new Error("Failed to initialize Filen storage");
  }
}

async function ensureStorageDirectory() {
  try {
    const sdk = await initializeFilen();
    const directories = await sdk.fs.dir();

    // Check if rise-storage directory exists
    const storageDir = directories.find(
      (d) => d.name === "rise-storage" && d.type === "directory"
    );

    if (!storageDir) {
      // Create rise-storage directory
      await sdk.fs.mkdir({
        name: "rise-storage",
      });
      console.log("Created rise-storage directory");
    }

    return storageDir ? storageDir.uuid : null;
  } catch (error) {
    console.error("Failed to ensure storage directory:", error);
    throw error;
  }
}

async function uploadVideo(filePath, originalFilename) {
  try {
    const sdk = await initializeFilen();

    // Ensure storage directory exists
    const dirs = await sdk.fs.dir();
    const storageDir = dirs.find(
      (d) => d.name === "rise-storage" && d.type === "directory"
    );

    if (!storageDir) {
      await sdk.fs.mkdir({ name: "rise-storage" });
    }

    // Get the directory UUID
    const updatedDirs = await sdk.fs.dir();
    const storageDirInfo = updatedDirs.find(
      (d) => d.name === "rise-storage" && d.type === "directory"
    );

    // Upload file to Filen
    const uploadedFile = await sdk.fs.upload({
      source: filePath,
      parent: storageDirInfo.uuid,
      name: originalFilename,
    });

    // Get file info
    const fileStats = fs.statSync(filePath);

    return {
      fileId: uploadedFile.uuid,
      path: uploadedFile.name,
      size: fileStats.size,
    };
  } catch (error) {
    console.error("Failed to upload video to Filen:", error);
    throw error;
  }
}

async function deleteVideo(fileId) {
  try {
    const sdk = await initializeFilen();

    // Delete file from Filen
    await sdk.fs.trash({
      uuid: fileId,
    });

    console.log("Deleted video from Filen:", fileId);
  } catch (error) {
    console.error("Failed to delete video from Filen:", error);
    throw error;
  }
}

async function getVideoUrl(fileId) {
  try {
    const sdk = await initializeFilen();

    // Get download URL for the file
    const url = await sdk.fs.download({
      uuid: fileId,
    });

    return url;
  } catch (error) {
    console.error("Failed to get video URL from Filen:", error);
    throw error;
  }
}

module.exports = {
  initializeFilen,
  ensureStorageDirectory,
  uploadVideo,
  deleteVideo,
  getVideoUrl,
};
