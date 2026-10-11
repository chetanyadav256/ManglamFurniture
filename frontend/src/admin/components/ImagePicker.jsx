import { useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { IMAGE_LIMIT, readPreviewImage } from '../services/adminMockService';

export default function ImagePicker({ images, onChange, disabled, onBusyChange, error }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  async function select(event) {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    if (images.length + files.length > IMAGE_LIMIT) {
      setUploadError(
        `Choose no more than ${IMAGE_LIMIT - images.length} additional images. The limit is ${IMAGE_LIMIT}.`,
      );
      return;
    }
    setBusy(true);
    onBusyChange(true);
    setUploadError('');
    try {
      const results = await Promise.allSettled(files.map(readPreviewImage));
      const valid = results.filter((item) => item.status === 'fulfilled').map((item) => item.value);
      if (valid.length) onChange([...images, ...valid]);
      setUploadError(
        results
          .filter((item) => item.status === 'rejected')
          .map((item) => item.reason.message)
          .join(' '),
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div>
      <h2 className="font-display text-2xl text-walnut">Let the piece speak.</h2>
      <p className="mb-5 mt-2 text-xs leading-6 text-bark">
        Add product images and choose the main catalog photograph.
      </p>
      <input
        ref={input}
        id="product-images"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={select}
        disabled={disabled || busy}
        aria-label="Select product images"
        aria-invalid={Boolean(error)}
        aria-describedby="image-help"
      />
      <button
        type="button"
        disabled={disabled || busy || images.length >= IMAGE_LIMIT}
        onClick={() => input.current.click()}
        className="flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-warm bg-cream/50 px-4 py-6 text-center disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle className="animate-spin text-walnut" size={26} />
        ) : (
          <ImagePlus size={27} strokeWidth={1.4} className="text-walnut" />
        )}
        <span className="text-sm text-walnut">
          {busy ? 'Preparing preview images…' : 'Choose product images'}
        </span>
        <span id="image-help" className="text-[11px] leading-6 text-bark">
          JPEG, PNG or WebP · Up to 5 MB each · {images.length}/{IMAGE_LIMIT} images
        </span>
      </button>
      {(error || uploadError) && (
        <p role="alert" className="mt-3 text-xs leading-6 text-red-700">
          {error || uploadError}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`min-w-0 overflow-hidden rounded-lg border bg-white ${index === 0 ? 'border-walnut' : 'border-sand'}`}
          >
            <div className="relative aspect-square overflow-hidden bg-cream">
              <img
                src={image.src}
                alt={`Product preview ${index + 1}: ${image.label}`}
                className="h-full w-full object-cover"
                style={{
                  objectPosition: image.position || 'center',
                  transform: `scale(${image.zoom || 1})`,
                }}
              />
              <button
                type="button"
                disabled={disabled || busy}
                className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full bg-white/95 text-walnut shadow-sm"
                aria-label={`Remove image ${index + 1}`}
                onClick={() => onChange(images.filter((item) => item.id !== image.id))}
              >
                <X size={16} />
              </button>
            </div>
            <button
              type="button"
              disabled={disabled || busy || index === 0}
              className="flex min-h-11 w-full items-center justify-center gap-1 px-2 text-[11px] text-walnut disabled:cursor-default"
              aria-label={
                index === 0 ? `Image ${index + 1} is main image` : `Set image ${index + 1} as main`
              }
              onClick={() => onChange([image, ...images.filter((item) => item.id !== image.id)])}
            >
              {index === 0 ? (
                <>
                  <Check size={14} />
                  Main image
                </>
              ) : (
                'Set as main'
              )}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-6 text-bark">
        Images stay in this browser’s memory. Nothing is uploaded, and refreshing clears preview
        changes.
      </p>
    </div>
  );
}
