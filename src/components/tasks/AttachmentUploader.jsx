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
    if (!window.confirm(`Delete ${attachment.fileName}?`)) {
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
      return <ImageIcon className="w-5 h-5 text-primary" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-destructive" />;
    } else {
      return <File className="w-5 h-5 text-muted-foreground" />;
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
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-success/30 bg-success'
              : 'border-border hover:border-success hover:bg-muted'
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
                <Upload className="w-8 h-8 text-success animate-bounce" />
              </div>
              <div className="text-foreground font-medium">
                Uploading... {Math.round(uploadProgress)}%
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="bg-success h-full"
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <div className="text-foreground font-medium mb-1">
                {dragActive ? 'Drop file here' : 'Click or drag file to upload'}
              </div>
              <div className="text-sm text-muted-foreground">
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
          className="bg-destructive border border-destructive/30 text-destructive px-4 py-2 rounded-xl text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* File limit reached message */}
      {!canUpload && (
        <div className="bg-warning border border-warning/30 text-warning px-4 py-2 rounded-xl text-sm">
          Maximum {maxFiles} files per task reached. Delete a file to upload more.
        </div>
      )}

      {/* Existing attachments list */}
      {existingAttachments.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">
            Attachments ({existingAttachments.length})
          </div>
          
          <AnimatePresence>
            {existingAttachments.map((attachment) => (
              <motion.div
                key={attachment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 p-3 bg-muted border border-border rounded-xl hover:shadow-sm transition-shadow"
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
                    <div className="w-12 h-12 flex items-center justify-center bg-card border border-border rounded">
                      {getFileIcon(attachment.fileType)}
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {attachment.fileName}
                  </div>
                  <div className="text-sm text-muted-foreground">
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
                    className="p-2 text-muted-foreground hover:text-primary transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  
                  <button
                    onClick={() => handleDelete(attachment)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
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
