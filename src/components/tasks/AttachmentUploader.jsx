import { useState, useRef } from 'react';
import { uploadFile, deleteFile, validateFile, checkFileLimit, isImage, formatFileSize } from '../../services/attachmentService';
import { Upload, X, File, Image as ImageIcon, FileText, Download, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AttachmentUploader Component
 * Drag-and-drop file uploader with preview and management
 */
const AttachmentUploader = ({ taskId, userId, existingAttachments = [], onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const maxFiles = 5;
  const canUpload = existingAttachments.length < maxFiles;

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle file drop
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!canUpload) {
      setError(`Maximum ${maxFiles} files per task`);
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFiles(files[0]); // Upload first file only
    }
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFiles(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle file upload
  const handleFiles = async (file) => {
    setError(null);
    setUploadProgress(0);

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    // Check file limit
    const { hasReachedLimit } = await checkFileLimit(taskId);
    if (hasReachedLimit) {
      setError(`Maximum ${maxFiles} files per task reached`);
      return;
    }

    setUploading(true);

    try {
      await uploadFile(taskId, userId, file, (progress) => {
        setUploadProgress(progress);
      });

      console.log('✅ File uploaded successfully');
      setUploadProgress(100);
      
      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete();
      }

      // Reset state
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err.message || 'Failed to upload file');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle file delete
  const handleDelete = async (attachment) => {
    if (!confirm(`Delete ${attachment.fileName}?`)) {
      return;
    }

    try {
      await deleteFile(attachment.id, attachment.storagePath);
      console.log('✅ File deleted successfully');
      
      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err) {
      console.error('❌ Delete error:', err);
      alert('Failed to delete file. Please try again.');
    }
  };

  // Get file icon
  const getFileIcon = (fileType) => {
    if (isImage(fileType)) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    } else {
      return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {canUpload && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 hover:border-green-500 hover:bg-gray-50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <Upload className="w-8 h-8 text-green-500 animate-bounce" />
              </div>
              <div className="text-gray-700 font-medium">
                Uploading... {Math.round(uploadProgress)}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="bg-green-500 h-full"
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <div className="text-gray-700 font-medium mb-1">
                {dragActive ? 'Drop file here' : 'Click or drag file to upload'}
              </div>
              <div className="text-sm text-gray-500">
                Max 10MB • Images, PDFs, Documents • {existingAttachments.length}/{maxFiles} files
              </div>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* File limit reached message */}
      {!canUpload && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg text-sm">
          Maximum {maxFiles} files per task reached. Delete a file to upload more.
        </div>
      )}

      {/* Existing attachments list */}
      {existingAttachments.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-700">
            Attachments ({existingAttachments.length})
          </div>
          
          <AnimatePresence>
            {existingAttachments.map((attachment) => (
              <motion.div
                key={attachment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
              >
                {/* File icon/preview */}
                <div className="flex-shrink-0">
                  {isImage(attachment.fileType) ? (
                    <img
                      src={attachment.downloadURL}
                      alt={attachment.fileName}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded">
                      {getFileIcon(attachment.fileType)}
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {attachment.fileName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(attachment.fileSize)} • 
                    {attachment.uploadedAt && ` ${new Date(attachment.uploadedAt).toLocaleDateString()}`}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <a
                    href={attachment.downloadURL}
                    download={attachment.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  
                  <button
                    onClick={() => handleDelete(attachment)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default AttachmentUploader;
