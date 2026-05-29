import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { fetchBulletins, type Bulletin } from '../utils/bulletinService';

/**
 * Displays active bulletins for this project as info notices. Renders nothing
 * while loading or when there are no bulletins to show.
 */
export default function BulletinNotice() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);

  useEffect(() => {
    let isMounted = true;

    fetchBulletins()
      .then((data) => {
        if (isMounted) setBulletins(data);
      })
      .catch(() => {
        if (isMounted) setBulletins([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (bulletins.length === 0) return null;

  return (
    <div className="space-y-3">
      {bulletins.map((bulletin) => (
        <div
          key={bulletin.id}
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm"
          role="status"
        >
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            {bulletin.name && (
              <p className="text-sm font-semibold text-blue-900">{bulletin.name}</p>
            )}
            {bulletin.notes && (
              <p className="mt-1 text-sm leading-relaxed text-blue-800 whitespace-pre-line">
                {bulletin.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
