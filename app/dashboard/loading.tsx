export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar skeleton */}
      <div className="w-64 shrink-0 border-r border-border bg-card p-4 space-y-3 hidden md:block">
        <div className="skeleton h-10 rounded-xl mb-6" />
        <div className="skeleton h-8 rounded-lg" />
        <div className="skeleton h-8 rounded-lg" />
        <div className="skeleton h-8 rounded-lg" />
        <div className="skeleton h-8 rounded-lg" />
        <div className="skeleton h-8 rounded-lg" />
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  );
}
