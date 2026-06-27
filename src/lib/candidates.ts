import { Position } from './supabase'

export interface CandidateSeed {
  name: string
  position: Position
  department: string
  level: string
  manifesto: string
}

export const PLACEHOLDER_CANDIDATES: CandidateSeed[] = [
  // President
  {
    name: 'Adeleke Tunde',
    position: 'President',
    department: 'Civil Engineering',
    level: '400',
    manifesto: 'I will improve student welfare, create more industry partnerships, and ensure every SEET student has access to the tools they need to succeed.',
  },
  {
    name: 'Okafor Chisom',
    position: 'President',
    department: 'Electrical Engineering',
    level: '500',
    manifesto: 'My vision is a united SEET community with a strong voice, better facilities, and career support for every student.',
  },

  // Vice President
  {
    name: 'Bello Fatima',
    position: 'Vice President',
    department: 'Mechanical Engineering',
    level: '400',
    manifesto: 'I will work closely with the President to ensure smooth governance and represent your interests at every level.',
  },
  {
    name: 'Nwosu Emmanuel',
    position: 'Vice President',
    department: 'Computer Engineering',
    level: '400',
    manifesto: 'My focus will be on academic support, mentorship programs, and bridging the gap between students and faculty.',
  },

  // Secretary General
  {
    name: 'Adeyemi Blessing',
    position: 'Secretary General',
    department: 'Civil Engineering',
    level: '300',
    manifesto: 'Transparent record-keeping, efficient communication, and organized governance — that is my commitment to SEET.',
  },
  {
    name: 'Ibrahim Musa',
    position: 'Secretary General',
    department: 'Chemical Engineering',
    level: '400',
    manifesto: 'I will ensure every meeting, decision, and communication is properly documented and accessible to all students.',
  },

  // Assistant Secretary General
  {
    name: 'Eze Chidimma',
    position: 'Assistant Secretary General',
    department: 'Electrical Engineering',
    level: '300',
    manifesto: 'I will support the Secretary General and ensure no student voice is left unheard in our governance process.',
  },
  {
    name: 'Lawal Abdullahi',
    position: 'Assistant Secretary General',
    department: 'Mechanical Engineering',
    level: '300',
    manifesto: 'Accuracy, diligence, and integrity — these are the values I bring to this role.',
  },

  // Financial Secretary
  {
    name: 'Oluwole Seun',
    position: 'Financial Secretary',
    department: 'Computer Engineering',
    level: '400',
    manifesto: 'Every naira collected will be accounted for. I will publish clear financial reports and fight against mismanagement.',
  },
  {
    name: 'Amadi Precious',
    position: 'Financial Secretary',
    department: 'Civil Engineering',
    level: '400',
    manifesto: "I will ensure our association's finances are transparent, auditable, and used for the benefit of all students.",  },

  // PRO
  {
    name: 'Yakubu Sandra',
    position: 'PRO',
    department: 'Chemical Engineering',
    level: '300',
    manifesto: "I will build SEET's presence online and offline — keeping students informed, engaged, and proud of their school.",
  },
  {
    name: 'Obi Kelechi',
    position: 'PRO',
    department: 'Electrical Engineering',
    level: '300',
    manifesto: 'My goal is to make SEET the most visible and respected engineering faculty in this university.',
  },

  // Director of Sports
  {
    name: 'Garba Yusuf',
    position: 'Director of Sports',
    department: 'Mechanical Engineering',
    level: '400',
    manifesto: 'Sports unify us. I will organize more inter-departmental competitions and get SEET back to the top of the university sports table.',
  },
  {
    name: 'Nkem Uche',
    position: 'Director of Sports',
    department: 'Civil Engineering',
    level: '300',
    manifesto: 'From football to chess, I will ensure every student has a sport to call their own within SEET.',
  },

  // Director of Social
  {
    name: 'Abiodun Tobiloba',
    position: 'Director of Social',
    department: 'Computer Engineering',
    level: '300',
    manifesto: 'More events, better vibes. I will create memorable social experiences that bring SEET students together throughout the year.',
  },
  {
    name: 'Onyekachi Miriam',
    position: 'Director of Social',
    department: 'Chemical Engineering',
    level: '400',
    manifesto: 'I will plan socials that every student wants to attend — inclusive, exciting, and truly SEET.',
  },
]
