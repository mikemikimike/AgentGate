import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  minWidth?: string;
  className?: string;
  hideBelow1280?: boolean;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ data, columns, onRowClick }: DataTableProps<T>) {
  return (
    <div className="w-full border border-ln rounded-[8px] bg-pn overflow-x-auto">
      <table className="w-full text-left border-collapse table-auto">
        <thead className="bg-pn border-b border-ln select-none sticky top-0 z-10">
          <tr className="h-[28px]">
            {columns.map((c, idx) => (
              <th 
                key={c.key} 
                className={`py-0 text-[11.5px] font-medium text-t3 whitespace-nowrap leading-none ${
                  idx === 0 ? 'pl-[20px] pr-[10px]' : 'px-[10px]'
                } ${c.hideBelow1280 ? 'hidden xl:table-cell' : ''} ${c.className || ''}`}
                style={{ width: c.width, minWidth: c.minWidth }}
              >
                {c.header}
              </th>
            ))}
            {onRowClick && (
              <th 
                className="py-0 pr-[20px] pl-[4px] leading-none text-right" 
                style={{ width: '20px', minWidth: '20px' }}
              />
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr 
              key={i} 
              className={`group h-[34px] border-b border-ln last:border-b-0 transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-hv' : ''
              }`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((c, idx) => (
                <td 
                  key={c.key} 
                  className={`py-0 text-[13px] align-middle whitespace-nowrap ${
                    idx === 0 ? 'pl-[20px] pr-[10px]' : 'px-[10px]'
                  } ${c.hideBelow1280 ? 'hidden xl:table-cell' : ''} ${c.className || ''}`}
                  style={{ width: c.width, minWidth: c.minWidth }}
                >
                  {c.render(row)}
                </td>
              ))}
              {onRowClick && (
                <td 
                  className="py-0 pr-[20px] pl-[4px] text-right align-middle"
                  style={{ width: '20px', minWidth: '20px' }}
                >
                  <ChevronRight 
                    size={14} 
                    strokeWidth={1.6} 
                    className="inline-block text-t3 opacity-0 group-hover:opacity-100 transition-opacity" 
                  />
                </td>
              )}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td 
                colSpan={columns.length + (onRowClick ? 1 : 0)} 
                className="px-[20px] py-[36px] text-center text-t3 text-[13px]"
              >
                No matching decisions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

