import { categories as sampleCategories, materials, priceOptions } from '../data/catalog';

export default function FilterControls({ filters, onChange, prefix = 'filter', categories = sampleCategories, isSample = true }) {
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="eyebrow mb-3 text-walnut">Category</legend>
        <div className="space-y-1">
          {[{ id: '', name: 'All furniture' }, ...categories].map((category) => (
            <label
              key={category.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 text-xs text-bark"
            >
              <input
                type="radio"
                name={`${prefix}-category`}
                value={category.id}
                checked={filters.category === category.id}
                onChange={() => onChange('category', category.id)}
                className="size-4 accent-walnut"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="border-t border-sand pt-6">
        <label htmlFor={`${prefix}-material`} className="eyebrow mb-3 block text-walnut">
          Material
        </label>
        <select
          id={`${prefix}-material`}
          value={filters.material}
          onChange={(event) => onChange('material', event.target.value)}
          className="field"
        >
          <option value="">All materials</option>
          {materials.map((material) => (
            <option key={material}>{material}</option>
          ))}
        </select>
      </div>
      <div className="border-t border-sand pt-6">
        <label htmlFor={`${prefix}-price`} className="eyebrow mb-3 block text-walnut">
          Price range
        </label>
        <select
          id={`${prefix}-price`}
          value={filters.price}
          onChange={(event) => onChange('price', event.target.value)}
          className="field"
        >
          {priceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-3 text-[10px] leading-5 text-bark">
          {isSample ? 'Prices shown are illustrative sample prices.' : 'Contact the showroom to confirm prices and availability.'}
        </p>
      </div>
    </div>
  );
}
