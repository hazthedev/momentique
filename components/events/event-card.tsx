// ============================================
// Galeria - Event Card Component
// ============================================

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Users, Image as ImageIcon, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { IEvent } from '@/lib/types';

interface EventCardProps {
  event: IEvent;
  photoCount?: number;
  onEdit?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  showActions?: boolean;
  className?: string;
}

const eventConfig = {
  birthday: { icon: '', label: 'Birthday', color: 'bg-pink-500' },
  wedding: { icon: '', label: 'Wedding', color: 'bg-rose-500' },
  corporate: { icon: '', label: 'Corporate', color: 'bg-blue-500' },
  other: { icon: '', label: 'Other', color: 'bg-gray-500' },
};

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  active: { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  ended: { label: 'Ended', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

export function EventCard({
  event,
  photoCount = 0,
  onEdit,
  onDelete,
  showActions = true,
  className,
}: EventCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const eventDate = new Date(event.event_date);
  const isPastEvent = eventDate < new Date();
  const config = eventConfig[event.event_type];
  const statusConfigItem = statusConfig[event.status];

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={clsx(
      'group relative rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800',
      className
    )}>
      {/* Card Header with Cover Image Placeholder */}
      <Link href={`/organizer/events/${event.id}`} className="block">
        <div className="relative h-32 overflow-hidden rounded-t-2xl bg-gradient-to-br from-violet-500 to-pink-500">
          {event.settings?.theme?.logo_url && (
            <Image
              src={event.settings.theme.logo_url}
              alt={event.name}
              fill
              className="object-cover opacity-20"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white/90">
              {event.name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Status Badge */}
          <div className="absolute top-3 left-3">
            <span className={clsx(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
              statusConfigItem.color
            )}>
              {statusConfigItem.label}
            </span>
          </div>

          {/* Event Type Badge */}
          <div className="absolute top-3 right-3">
            <span className={clsx(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white',
              config.color
            )}>
              {config.label}
            </span>
          </div>
        </div>
      </Link>

      {/* Card Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/organizer/events/${event.id}`}>
              <h3 className="truncate text-lg font-semibold text-gray-900 transition-colors hover:text-violet-600 dark:text-gray-100 dark:hover:text-violet-400">
                {event.name}
              </h3>
            </Link>
            {event.description && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                {event.description}
              </p>
            )}
          </div>

          {/* Actions Dropdown */}
          {showActions && (onEdit || onDelete) && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  'transition-colors',
                  'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
                  'dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
                )}
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <Link
                    href={`/organizer/events/${event.id}`}
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Eye className="h-4 w-4" />
                    View Event
                  </Link>
                  {onEdit && (
                    <button
                      onClick={() => {
                        onEdit(event.id);
                        setIsDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        onDelete(event.id);
                        setIsDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Event Details */}
        <div className="mt-4 space-y-2">
          {/* Date & Time */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className={clsx(isPastEvent && 'text-orange-600 dark:text-orange-400')}>
              {formatDate(eventDate)}
              {isPastEvent && ' (Past)'}
            </span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {/* Hashtag */}
          {event.custom_hashtag && (
            <div className="text-sm text-violet-600 dark:text-violet-400">
              #{event.custom_hashtag}
            </div>
          )}
        </div>

        {/* Stats Footer */}
        <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-700">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <ImageIcon className="h-4 w-4" />
            <span>{photoCount} photos</span>
          </div>
          {event.expected_guests && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <Users className="h-4 w-4" />
              <span>{event.expected_guests} guests</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventCard;
