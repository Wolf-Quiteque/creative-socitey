export default function Loading() {
  return (
    <div className="animate-pulse-soft">
      <div className="mb-3 h-4 w-24 rounded-full bg-sand" />
      <div className="mb-8 h-9 w-64 rounded-2xl bg-sand" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-sand" />
        ))}
      </div>
      <div className="mt-4 h-72 rounded-2xl bg-sand" />
    </div>
  );
}
