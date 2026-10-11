import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { normalizeTag } from '../services/adminMockService';

export default function TagInput({ tags, onChange, disabled }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  function add() {
    const tag = normalizeTag(draft);
    if (!tag) {
      setError('Type a tag before adding it.');
      return;
    }
    if (tag.length > 40) {
      setError('Keep each tag to 40 characters or fewer.');
      return;
    }
    if (tags.includes(tag)) {
      setError('This tag has already been added.');
      return;
    }
    if (tags.length >= 12) {
      setError('You can add up to 12 tags.');
      return;
    }
    onChange([...tags, tag]);
    setDraft('');
    setError('');
  }
  return (
    <div>
      <label htmlFor="product-tag-input" className="mb-2 block text-xs font-medium text-walnut">
        Product tags
      </label>
      <div className="flex gap-2">
        <input
          id="product-tag-input"
          className="field rounded-md"
          value={draft}
          disabled={disabled}
          placeholder="e.g. wooden dining chair"
          maxLength={80}
          aria-describedby="product-tag-help"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="btn-outline rounded-md px-4"
          onClick={add}
        >
          <Plus size={15} />
          Add
        </button>
      </div>
      <p id="product-tag-help" className="mt-2 text-[11px] leading-6 text-bark">
        Press Enter or Add. Tags use lowercase, consistent spacing, and no duplicates. Up to 12
        tags.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex max-w-full items-center rounded-full bg-cream pl-3 text-xs text-walnut"
          >
            <span className="min-w-0 break-words">{tag}</span>
            <button
              type="button"
              disabled={disabled}
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
              aria-label={`Remove tag ${tag}`}
              onClick={() => {
                onChange(tags.filter((value) => value !== tag));
                setError('');
              }}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
