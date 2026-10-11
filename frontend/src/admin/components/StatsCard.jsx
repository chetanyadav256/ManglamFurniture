export default function StatsCard({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-xl border border-sand/80 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium text-bark">{label}</h2>
        <span className="flex size-10 items-center justify-center rounded-lg bg-cream text-walnut">
          <Icon size={20} strokeWidth={1.5} />
        </span>
      </div>
      <p className="mt-3 font-display text-5xl leading-none text-walnut">{value}</p>
      <p className="mt-3 text-[11px] leading-5 text-bark">{description}</p>
    </div>
  );
}
