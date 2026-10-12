import { Search, SlidersHorizontal } from 'lucide-react';

export function FilterBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-12 p-12 bg-pn border border-ln rounded-8 shadow-sm">
      <div className="flex flex-wrap items-center gap-10">
        <div className="flex bg-sl border border-ln rounded-6 p-2 text-[12px] font-medium">
          <button className="px-12 py-4 rounded-4 bg-pn text-tx shadow-sm font-semibold">All Time</button>
          <button className="px-12 py-4 rounded-4 text-t2 hover:text-tx">Past 24h</button>
          <button className="px-12 py-4 rounded-4 text-t2 hover:text-tx">Past 7d</button>
        </div>

        <div className="h-20 w-[1px] bg-ln mx-2 hidden sm:block" />

        <div className="flex items-center gap-8">
          <button className="h-32 px-12 text-[12px] font-medium text-tx bg-bg border border-ln rounded-6 hover:bg-hv flex items-center gap-6">
            <SlidersHorizontal size={13} className="text-t3" />
            Filter by Verdict
          </button>
          <button className="h-32 px-12 text-[12px] font-medium text-tx bg-bg border border-ln rounded-6 hover:bg-hv">
            All Tools
          </button>
        </div>
      </div>

      <div className="relative min-w-[240px] flex-1 sm:flex-initial">
        <Search size={14} className="absolute left-10 top-1/2 -translate-y-1/2 text-t3" />
        <input 
          type="text" 
          placeholder="Search commands, sessions, tools..." 
          className="w-full h-32 bg-bg border border-ln rounded-6 pl-32 pr-12 text-[13px] text-tx placeholder:text-t3 focus:border-ac focus:ring-1 focus:ring-ac transition-all"
        />
      </div>
    </div>
  );
}
