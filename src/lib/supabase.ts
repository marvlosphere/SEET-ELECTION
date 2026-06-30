// Types only — safe to import anywhere including frontend pages

export type Position =
  | 'President'
  | 'Vice President'
  | 'General Secretary'
  | 'Assistant General Secretary'
  | 'Financial Secretary'
  | 'PRO I'
  | 'PRO II'
  | 'Treasurer'
  | 'Welfare Director'
  | 'Sports Director'
  | 'Social Director'

export const POSITIONS: Position[] = [
  'President',
  'Vice President',
  'General Secretary',
  'Assistant General Secretary',
  'Financial Secretary',
  'PRO I',
  'PRO II',
  'Treasurer',
  'Welfare Director',
  'Sports Director',
  'Social Director',
]

export interface Candidate {
  id: string
  name: string
  position: Position
  department: string
  level: string
  manifesto: string
  photo_url: string | null
  created_at: string
}

export interface Voter {
  id: string
  matric_number: string
  full_name: string
  department: string
  level: string
  phone: string
  token: string
  token_used: boolean
  has_voted: boolean
  created_at: string
}

export interface Vote {
  id: string
  voter_id: string
  candidate_id: string
  position: Position
  created_at: string
}
