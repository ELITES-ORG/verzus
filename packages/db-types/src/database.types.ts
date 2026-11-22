
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "allies": {
                  Row: {
                    "addressee_id": string,"created_at": string,"requester_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "addressee_id": string,"created_at"?: string,"requester_id": string,"status"?: string
                  }
                  Update: {
                    "addressee_id"?: string,"created_at"?: string,"requester_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "allies_addressee_id_fkey"
      columns: ["addressee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "allies_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "booked_by": string | null,"court_id": string,"created_at": string,"created_by": string | null,"during": unknown,"hold_expires_at": string | null,"id": string,"note": string | null,"price_cents": number | null,"source": Database["public"]['Enums']["booking_source"],"status": Database["public"]['Enums']["booking_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booked_by"?: string | null,"court_id": string,"created_at"?: string,"created_by"?: string | null,"during": unknown,"hold_expires_at"?: string | null,"id"?: string,"note"?: string | null,"price_cents"?: number | null,"source": Database["public"]['Enums']["booking_source"],"status": Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Update: {
                    "booked_by"?: string | null,"court_id"?: string,"created_at"?: string,"created_by"?: string | null,"during"?: unknown,"hold_expires_at"?: string | null,"id"?: string,"note"?: string | null,"price_cents"?: number | null,"source"?: Database["public"]['Enums']["booking_source"],"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_booked_by_fkey"
      columns: ["booked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"courts": {
                  Row: {
                    "created_at": string,"currency": string,"hourly_rate_cents": number,"id": string,"is_active": boolean,"name": string,"photo_paths": (string)[],"sport": Database["public"]['Enums']["sport"],"venue_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"hourly_rate_cents": number,"id"?: string,"is_active"?: boolean,"name": string,"photo_paths"?: (string)[],"sport": Database["public"]['Enums']["sport"],"venue_id": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"hourly_rate_cents"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"photo_paths"?: (string)[],"sport"?: Database["public"]['Enums']["sport"],"venue_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "courts_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"disputes": {
                  Row: {
                    "created_at": string,"id": string,"match_id": string,"raised_by": string,"reason": string,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"match_id": string,"raised_by": string,"reason": string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"match_id"?: string,"raised_by"?: string,"reason"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "disputes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ledger_entries": {
                  Row: {
                    "account": Database["public"]['Enums']["ledger_account"],"account_id": string | null,"amount_cents": number,"booking_id": string | null,"created_at": string,"currency": string,"id": number,"kind": string,"match_id": string | null,"payment_id": string | null,"txn_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account": Database["public"]['Enums']["ledger_account"],"account_id"?: string | null,"amount_cents": number,"booking_id"?: string | null,"created_at"?: string,"currency": string,"id"?: never,"kind": string,"match_id"?: string | null,"payment_id"?: string | null,"txn_id": string
                  }
                  Update: {
                    "account"?: Database["public"]['Enums']["ledger_account"],"account_id"?: string | null,"amount_cents"?: number,"booking_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: never,"kind"?: string,"match_id"?: string | null,"payment_id"?: string | null,"txn_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_entries_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"match_invites": {
                  Row: {
                    "invited_at": string,"match_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "invited_at"?: string,"match_id": string,"user_id": string
                  }
                  Update: {
                    "invited_at"?: string,"match_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_invites_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"match_participants": {
                  Row: {
                    "attended": boolean | null,"hold_expires_at": string | null,"joined_at": string,"match_id": string,"share_cents": number,"status": Database["public"]['Enums']["participant_status"],"team": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attended"?: boolean | null,"hold_expires_at"?: string | null,"joined_at"?: string,"match_id": string,"share_cents": number,"status": Database["public"]['Enums']["participant_status"],"team": number,"user_id": string
                  }
                  Update: {
                    "attended"?: boolean | null,"hold_expires_at"?: string | null,"joined_at"?: string,"match_id"?: string,"share_cents"?: number,"status"?: Database["public"]['Enums']["participant_status"],"team"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_participants_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "booking_id": string,"court_id": string,"created_at": string,"created_by": string,"ends_at": string,"id": string,"mode": Database["public"]['Enums']["match_mode"],"opened_public_at": string | null,"sport": Database["public"]['Enums']["sport"],"starts_at": string,"status": Database["public"]['Enums']["match_status"],"team_size": number,"updated_at": string,"venue_id": string,"winning_team": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"court_id": string,"created_at"?: string,"created_by": string,"ends_at": string,"id"?: string,"mode": Database["public"]['Enums']["match_mode"],"opened_public_at"?: string | null,"sport": Database["public"]['Enums']["sport"],"starts_at": string,"status"?: Database["public"]['Enums']["match_status"],"team_size": number,"updated_at"?: string,"venue_id": string,"winning_team"?: number | null
                  }
                  Update: {
                    "booking_id"?: string,"court_id"?: string,"created_at"?: string,"created_by"?: string,"ends_at"?: string,"id"?: string,"mode"?: Database["public"]['Enums']["match_mode"],"opened_public_at"?: string | null,"sport"?: Database["public"]['Enums']["sport"],"starts_at"?: string,"status"?: Database["public"]['Enums']["match_status"],"team_size"?: number,"updated_at"?: string,"venue_id"?: string,"winning_team"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"opening_hours": {
                  Row: {
                    "closes": string,"opens": string,"venue_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closes": string,"opens": string,"venue_id": string,"weekday": number
                  }
                  Update: {
                    "closes"?: string,"opens"?: string,"venue_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "opening_hours_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"booking_id": string | null,"created_at": string,"currency": string,"id": string,"match_id": string | null,"provider": string,"provider_ref": string | null,"purpose": string,"status": Database["public"]['Enums']["payment_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"booking_id"?: string | null,"created_at"?: string,"currency": string,"id"?: string,"match_id"?: string | null,"provider": string,"provider_ref"?: string | null,"purpose": string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"booking_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"match_id"?: string | null,"provider"?: string,"provider_ref"?: string | null,"purpose"?: string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payouts": {
                  Row: {
                    "amount_cents": number,"created_at": string,"currency": string,"id": string,"provider_ref": string | null,"status": string,"venue_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"currency": string,"id"?: string,"provider_ref"?: string | null,"status"?: string,"venue_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"provider_ref"?: string | null,"status"?: string,"venue_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payouts_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"display_name": string,"home_city": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"home_city"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"home_city"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"token": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"token": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rating_history": {
                  Row: {
                    "created_at": string,"id": number,"match_id": string | null,"mode": Database["public"]['Enums']["match_mode"],"mu_after": number,"mu_before": number,"reason": string,"sigma_after": number,"sigma_before": number,"sport": Database["public"]['Enums']["sport"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"match_id"?: string | null,"mode": Database["public"]['Enums']["match_mode"],"mu_after": number,"mu_before": number,"reason": string,"sigma_after": number,"sigma_before": number,"sport": Database["public"]['Enums']["sport"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"match_id"?: string | null,"mode"?: Database["public"]['Enums']["match_mode"],"mu_after"?: number,"mu_before"?: number,"reason"?: string,"sigma_after"?: number,"sigma_before"?: number,"sport"?: Database["public"]['Enums']["sport"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rating_history_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rating_history_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ratings": {
                  Row: {
                    "conservative_score": number | null,"games_played": number,"last_played_at": string | null,"mode": Database["public"]['Enums']["match_mode"],"mu": number,"self_assessment": Database["public"]['Enums']["self_assessment"],"sigma": number,"sport": Database["public"]['Enums']["sport"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conservative_score"?: never,"games_played"?: number,"last_played_at"?: string | null,"mode": Database["public"]['Enums']["match_mode"],"mu": number,"self_assessment": Database["public"]['Enums']["self_assessment"],"sigma": number,"sport": Database["public"]['Enums']["sport"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "conservative_score"?: never,"games_played"?: number,"last_played_at"?: string | null,"mode"?: Database["public"]['Enums']["match_mode"],"mu"?: number,"self_assessment"?: Database["public"]['Enums']["self_assessment"],"sigma"?: number,"sport"?: Database["public"]['Enums']["sport"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ratings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"result_confirmations": {
                  Row: {
                    "confirmed_at": string,"match_id": string,"user_id": string,"winning_team": number
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string,"match_id": string,"user_id": string,"winning_team": number
                  }
                  Update: {
                    "confirmed_at"?: string,"match_id"?: string,"user_id"?: string,"winning_team"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "result_confirmations_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_confirmations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seasons": {
                  Row: {
                    "ends_at": string | null,"id": string,"name": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_at"?: string | null,"id"?: string,"name": string,"starts_at": string
                  }
                  Update: {
                    "ends_at"?: string | null,"id"?: string,"name"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"venue_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"note": string | null,"redeemed_at": string | null,"redeemed_by": string | null,"token": string,"venue_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"note"?: string | null,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"token"?: string,"venue_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"note"?: string | null,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"token"?: string,"venue_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "venue_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_invites_redeemed_by_fkey"
      columns: ["redeemed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_invites_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"venue_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["venue_role"],"user_id": string,"venue_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["venue_role"],"user_id": string,"venue_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["venue_role"],"user_id"?: string,"venue_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venue_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_members_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"venue_staff_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"note": string | null,"redeemed_at": string | null,"redeemed_by": string | null,"token": string,"venue_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"note"?: string | null,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"token"?: string,"venue_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"note"?: string | null,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"token"?: string,"venue_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venue_staff_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_staff_invites_redeemed_by_fkey"
      columns: ["redeemed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_staff_invites_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"venues": {
                  Row: {
                    "address": string | null,"barangay": string | null,"city": string | null,"cover_path": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_published": boolean | null,"lat": number | null,"lng": number | null,"location": unknown,"logo_path": string | null,"name": string,"phone": string | null,"photo_paths": (string)[],"province": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["venue_status"],"submitted_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"barangay"?: string | null,"city"?: string | null,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_published"?: never,"lat"?: never,"lng"?: never,"location"?: unknown,"logo_path"?: string | null,"name": string,"phone"?: string | null,"photo_paths"?: (string)[],"province"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["venue_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"barangay"?: string | null,"city"?: string | null,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_published"?: never,"lat"?: never,"lng"?: never,"location"?: unknown,"logo_path"?: string | null,"name"?: string,"phone"?: string | null,"photo_paths"?: (string)[],"province"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["venue_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venues_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venues_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "event_id": string,"payload": NonNullable<Json>,"provider": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"payload": NonNullable<Json>,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"payload"?: NonNullable<Json>,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_see_match":
{ Args: { "p_match_id": string }; Returns: boolean
                           },
"court_busy_ranges":
{ Args: { "p_court_id": string,"p_from": string,"p_to": string }; Returns: {
              "ends_at": string,"starts_at": string
            }[]
                           },
"court_venue":
{ Args: { "p_court_id": string }; Returns: string
                           },
"expire_holds":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_match_participant":
{ Args: { "p_match_id": string }; Returns: boolean
                           },
"is_owner_of_venue_folder":
{ Args: { "p_name": string }; Returns: boolean
                           },
"is_venue_member":
{ Args: { "p_owner_only"?: boolean,"p_venue_id": string }; Returns: boolean
                           },
"paths_in_venue_folder":
{ Args: { "p_paths": (string)[],"p_venue_id": string }; Returns: boolean
                           },
"player_reliability":
{ Args: { "p_user_ids": (string)[] }; Returns: {
              "matches_attended": number,"matches_recorded": number,"reliability_pct": number,"user_id": string
            }[]
                           },
"redeem_staff_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"redeem_venue_invite":
{ Args: { "p_token": string,"p_venue_name": string }; Returns: string
                           },
"venue_people":
{ Args: { "p_venue_id": string }; Returns: {
              "display_name": string,"email": string,"joined_at": string,"role": Database["public"]['Enums']["venue_role"],"user_id": string
            }[]
                           },
"venues_near":
{ Args: { "p_lat": number,"p_lng": number,"p_radius_m"?: number,"p_sport"?: Database["public"]['Enums']["sport"] }; Returns: {
              "address": string,"city": string,"distance_m": number,"id": string,"min_hourly_rate_cents": number,"name": string,"photo_paths": (string)[]
            }[]
                           }
          }
          Enums: {
            "booking_source": "app"|"walk_in"|"phone"|"block","booking_status": "held"|"confirmed"|"cancelled"|"expired","ledger_account": "player"|"venue"|"platform"|"provider_clearing","match_mode": "ranked"|"casual","match_status": "open_allies"|"open_public"|"full"|"played"|"awaiting_confirmation"|"rated"|"disputed"|"resolved"|"cancelled","participant_status": "held"|"paid"|"left"|"expired"|"refunded","payment_status": "pending"|"succeeded"|"failed"|"refunded","self_assessment": "beginner"|"intermediate"|"advanced","sport": "basketball"|"badminton"|"futsal"|"tennis"|"volleyball"|"pickleball","venue_role": "owner"|"staff","venue_status": "draft"|"submitted"|"live"|"suspended"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "booking_source": ["app", "walk_in", "phone", "block"],"booking_status": ["held", "confirmed", "cancelled", "expired"],"ledger_account": ["player", "venue", "platform", "provider_clearing"],"match_mode": ["ranked", "casual"],"match_status": ["open_allies", "open_public", "full", "played", "awaiting_confirmation", "rated", "disputed", "resolved", "cancelled"],"participant_status": ["held", "paid", "left", "expired", "refunded"],"payment_status": ["pending", "succeeded", "failed", "refunded"],"self_assessment": ["beginner", "intermediate", "advanced"],"sport": ["basketball", "badminton", "futsal", "tennis", "volleyball", "pickleball"],"venue_role": ["owner", "staff"],"venue_status": ["draft", "submitted", "live", "suspended"]
          }
        }
} as const
