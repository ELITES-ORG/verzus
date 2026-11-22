import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@verzus/db-types';
import { isPhMobile } from '@verzus/schemas/phone';
import { supabase } from '../../lib/supabase';

export type Venue = Pick<
  Tables<'venues'>,
  | 'id'
  | 'name'
  | 'description'
  | 'phone'
  | 'address'
  | 'city'
  | 'province'
  | 'barangay'
  | 'lat'
  | 'lng'
  | 'logo_path'
  | 'cover_path'
  | 'photo_paths'
  | 'status'
  | 'review_note'
  | 'submitted_at'
>;
export type Court = Pick<Tables<'courts'>, 'id' | 'name' | 'sport' | 'hourly_rate_cents' | 'is_active' | 'photo_paths'>;
export type Hours = Pick<Tables<'opening_hours'>, 'weekday' | 'opens' | 'closes'>;

export interface Setup {
  venue: Venue;
  courts: Court[];
  hours: Hours[];
}

/** Everything the setup wizard shows for one venue. RLS limits it to the venue's members. */
export function useSetup(venueId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['setup', venueId],
    queryFn: async (): Promise<Setup | null> => {
      const [venue, courts, hours] = await Promise.all([
        supabase
          .from('venues')
          .select(
            'id, name, description, phone, address, city, province, barangay, lat, lng, logo_path, cover_path, photo_paths, status, review_note, submitted_at',
          )
          .eq('id', venueId)
          .maybeSingle(),
        supabase
          .from('courts')
          .select('id, name, sport, hourly_rate_cents, is_active, photo_paths')
          .eq('venue_id', venueId)
          .order('created_at'),
        supabase.from('opening_hours').select('weekday, opens, closes').eq('venue_id', venueId).order('weekday'),
      ]);
      if (venue.error) throw venue.error;
      if (courts.error) throw courts.error;
      if (hours.error) throw hours.error;
      if (!venue.data) return null;
      return { venue: venue.data, courts: courts.data, hours: hours.data };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['setup', venueId] });
  return { ...query, refresh };
}

/** What each step needs before the venue can be submitted (mirrors the database's submit check). */
export function progress(s: Setup) {
  return {
    basics: s.venue.name.trim().length >= 2 && isPhMobile(s.venue.phone ?? ''),
    location: s.venue.lat != null && Boolean(s.venue.address?.trim()) && Boolean(s.venue.city?.trim()),
    // At least one court open for booking, and a photo of every open court (the database checks
    // the same on submit).
    courts: s.courts.some((c) => c.is_active) && s.courts.every((c) => !c.is_active || c.photo_paths.length > 0),
    hours: s.hours.length > 0,
    photos: Boolean(s.venue.cover_path),
  };
}

export const peso = (cents: number) => `₱${(cents / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
