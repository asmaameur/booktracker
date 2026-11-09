import { useRef, useState } from 'react';
import { CircleCheck, Upload } from 'lucide-react';
import Button from '../ui/Button';
import { uploadsApi } from '../../api';
import { useToast } from '../../context/ToastContext';

// Limits match the server (backend/src/utils/uploads.js).
const KINDS = {
  cover: {
    accept: 'image/jpeg,image/png,image/webp',
    types: ['image/jpeg', 'image/png', 'image/webp'],
    maxMb: 5,
    label: 'Upload an image',
    describe: 'JPG, PNG or WebP, up to 5 MB',
  },
  pdf: {
    accept: 'application/pdf',
    types: ['application/pdf'],
    maxMb: 100,
    label: 'Upload a PDF',
    describe: 'PDF, up to 100 MB',
  },
};

// Picks a file, uploads it to the server and hands back its URL, which the
// form then stores like a pasted link.
export default function UploadButton({ kind, onUploaded, disabled = false }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState(null);
  const config = KINDS[kind];

  const onChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!config.types.includes(file.type)) {
      toast.error(`Please choose a file of this type: ${config.describe}.`);
      return;
    }
    if (file.size > config.maxMb * 1024 * 1024) {
      toast.error(`This file is too large. The limit is ${config.maxMb} MB.`);
      return;
    }

    setUploading(true);
    try {
      const { url } = await uploadsApi[kind](file);
      setFileName(file.name);
      onUploaded(url);
      toast.success(`${file.name} uploaded.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-button">
      <input
        ref={inputRef}
        type="file"
        accept={config.accept}
        onChange={onChange}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        variant="secondary"
        size="sm"
        icon={Upload}
        loading={uploading}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading…' : config.label}
      </Button>
      <span className="upload-button__note" aria-live="polite">
        {fileName ? (
          <>
            <CircleCheck aria-hidden="true" />
            {fileName}
          </>
        ) : (
          `${config.describe}, or paste a link above`
        )}
      </span>
    </div>
  );
}
