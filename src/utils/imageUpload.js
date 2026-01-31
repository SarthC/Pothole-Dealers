// Firebase Storage utility for uploading pothole images
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

/**
 * Upload a pothole image to Firebase Storage
 * @param {File} file - The image file to upload
 * @param {string} userId - The user's ID (for organizing uploads)
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export async function uploadPotholeImage(file, userId = 'anonymous') {
    try {
        // Create a unique filename
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 8)
        const extension = file.name.split('.').pop() || 'jpg'
        const filename = `pothole_${timestamp}_${randomId}.${extension}`

        // Create storage reference
        const storageRef = ref(storage, `potholes/${userId}/${filename}`)

        // Upload the file
        const snapshot = await uploadBytes(storageRef, file, {
            contentType: file.type,
            customMetadata: {
                uploadedAt: new Date().toISOString(),
                originalName: file.name
            }
        })

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref)

        return downloadURL
    } catch (error) {
        console.error('Error uploading image:', error)
        throw error
    }
}

/**
 * Compress image before upload (optional, for better performance)
 * @param {File} file - The original image file
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} - Compressed image blob
 */
export async function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                // Scale down if too large
                if (width > maxWidth) {
                    height = (height * maxWidth) / width
                    width = maxWidth
                }

                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, width, height)

                canvas.toBlob(
                    (blob) => resolve(blob),
                    'image/jpeg',
                    quality
                )
            }
            img.onerror = reject
            img.src = event.target.result
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}
